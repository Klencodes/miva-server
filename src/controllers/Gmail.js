// controllers/gmailController.js
const { google } = require('googleapis');
const { ApiResponse, ErrorResponse } = require('../utils/response'); // Adjust path as needed

// Store tokens in memory (use database in production)
const userTokens = new Map();

class GmailController {
  constructor() {
    // Bind methods to ensure 'this' context is preserved
    this.getAuthUrl = this.getAuthUrl.bind(this);
    this.handleCallback = this.handleCallback.bind(this);
    this.getMessages = this.getMessages.bind(this);
    this.getMessageById = this.getMessageById.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.replyToMessage = this.replyToMessage.bind(this);
    this.modifyMessage = this.modifyMessage.bind(this);
    this.batchModifyMessages = this.batchModifyMessages.bind(this);
    this.getUserProfile = this.getUserProfile.bind(this);
    this.checkConnection = this.checkConnection.bind(this);
    this.disconnectGmail = this.disconnectGmail.bind(this);
    this.parseMessage = this.parseMessage.bind(this);
  }

  async getAuthUrl(req, res) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
      );

      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/gmail.labels'
        ],
        prompt: 'consent'
      });

      console.log('Generated auth URL');
      const response = new ApiResponse({ url }, "Auth URL generated successfully");
      return res.json(response);
    } catch (error) {
      console.error('Error getting auth URL:', error);
      const errorResponse = new ErrorResponse('Failed to generate auth URL');
      return res.status(500).json(errorResponse);
    }
  }

  async handleCallback(req, res) {
    try {
      const { code, error } = req.query;
      
      console.log('=== OAuth Callback Received ===');
      console.log('Code present:', !!code);
      
      if (error) {
        console.error('OAuth Error:', error);
        return res.redirect(`${process.env.FRONTEND_URL}/communications/messages?error=${error}`);
      }
      
      if (!code) {
        console.error('No code provided');
        const errorResponse = new ErrorResponse('Authorization code required');
        return res.status(400).json(errorResponse);
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
      );

      console.log('Exchanging code for tokens...');
      const { tokens } = await oauth2Client.getToken(code);
      console.log('Tokens received successfully');

      oauth2Client.setCredentials(tokens);
      
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('Connected to Gmail for:', profile.data.emailAddress);

      const userId = 'default_user';
      userTokens.set(userId, {
        tokens,
        oauthClient: oauth2Client,
        email: profile.data.emailAddress
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/communications/messages?gmail_connected=true&email=${encodeURIComponent(profile.data.emailAddress)}`;
      
      console.log('Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('Callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/communications/messages?error=auth_failed&details=${encodeURIComponent(error.message)}`);
    }
  }

  async getMessages(req, res) {
    try {
      const userId = 'default_user';
      const userData = userTokens.get(userId);
      
      if (!userData || !userData.tokens) {
        const errorResponse = new ErrorResponse('Gmail not connected');
        return res.status(401).json(errorResponse);
      }

      let { oauthClient, tokens } = userData;
      
      if (!oauthClient) {
        oauthClient = new google.auth.OAuth2(
          process.env.GMAIL_CLIENT_ID,
          process.env.GMAIL_CLIENT_SECRET,
          process.env.GMAIL_REDIRECT_URI
        );
        oauthClient.setCredentials(tokens);
        userData.oauthClient = oauthClient;
        userTokens.set(userId, userData);
      }
      
      // Check if token expired and refresh if needed
      if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
        console.log('Token expired, refreshing...');
        const { credentials } = await oauthClient.refreshAccessToken();
        oauthClient.setCredentials(credentials);
        userData.tokens = credentials;
        userTokens.set(userId, userData);
      }
      
      const gmail = google.gmail({ version: 'v1', auth: oauthClient });
      
      const { maxResults = 50, query = '' } = req.query;
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: parseInt(maxResults),
        q: query || 'in:inbox'
      });

      const messages = response.data.messages || [];
      const fullMessages = await Promise.all(
        messages.map(async (msg) => {
          const fullMsg = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });
          return this.parseMessage(fullMsg.data);
        })
      );

      const apiResponse = new ApiResponse(
        { messages: fullMessages, total: fullMessages.length },
        "Messages retrieved successfully"
      );
      return res.json(apiResponse);
    } catch (error) {
      console.error('Error getting messages:', error);
      const errorResponse = new ErrorResponse('Failed to fetch messages');
      return res.status(500).json(errorResponse);
    }
  }

  async getMessageById(req, res) {
    try {
      const userId = 'default_user';
      const { messageId } = req.params;
      const userData = userTokens.get(userId);
      
      if (!userData || !userData.tokens) {
        const errorResponse = new ErrorResponse('Gmail not connected');
        return res.status(401).json(errorResponse);
      }

      let { oauthClient, tokens } = userData;
      
      if (!oauthClient) {
        oauthClient = new google.auth.OAuth2(
          process.env.GMAIL_CLIENT_ID,
          process.env.GMAIL_CLIENT_SECRET,
          process.env.GMAIL_REDIRECT_URI
        );
        oauthClient.setCredentials(tokens);
        userData.oauthClient = oauthClient;
        userTokens.set(userId, userData);
      }
      
      const gmail = google.gmail({ version: 'v1', auth: oauthClient });
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const message = this.parseMessage(response.data);
      const apiResponse = new ApiResponse({ message }, "Message retrieved successfully");
      return res.json(apiResponse);
    } catch (error) {
      console.error('Error getting message by ID:', error);
      const errorResponse = new ErrorResponse('Failed to fetch message');
      return res.status(500).json(errorResponse);
    }
  }

  async sendMessage(req, res) {
    try {
      const userId = 'default_user';
      const { to, subject, body, threadId } = req.body;
      const userData = userTokens.get(userId);
      
      if (!userData || !userData.tokens) {
        const errorResponse = new ErrorResponse('Gmail not connected');
        return res.status(401).json(errorResponse);
      }

      if (!to || !subject || !body) {
        const errorResponse = new ErrorResponse('Missing required fields: to, subject, body');
        return res.status(400).json(errorResponse);
      }

      let { oauthClient, tokens } = userData;
      
      if (!oauthClient) {
        oauthClient = new google.auth.OAuth2(
          process.env.GMAIL_CLIENT_ID,
          process.env.GMAIL_CLIENT_SECRET,
          process.env.GMAIL_REDIRECT_URI
        );
        oauthClient.setCredentials(tokens);
        userData.oauthClient = oauthClient;
        userTokens.set(userId, userData);
      }
      
      const gmail = google.gmail({ version: 'v1', auth: oauthClient });
      
      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        body
      ].join('\n');

      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const requestBody = {
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      };

      if (threadId) {
        requestBody.requestBody.threadId = threadId;
      }

      const response = await gmail.users.messages.send(requestBody);
      
      const apiResponse = new ApiResponse(
        { 
          messageId: response.data.id,
          threadId: response.data.threadId
        },
        "Message sent successfully"
      );
      return res.json(apiResponse);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorResponse = new ErrorResponse('Failed to send message');
      return res.status(500).json(errorResponse);
    }
  }

  async replyToMessage(req, res) {
    try {
      const userId = 'default_user';
      const { messageId, replyBody } = req.body;
      const userData = userTokens.get(userId);
      
      if (!userData || !userData.tokens) {
        const errorResponse = new ErrorResponse('Gmail not connected');
        return res.status(401).json(errorResponse);
      }

      if (!messageId || !replyBody) {
        const errorResponse = new ErrorResponse('Missing required fields: messageId, replyBody');
        return res.status(400).json(errorResponse);
      }

      let { oauthClient, tokens } = userData;
      
      if (!oauthClient) {
        oauthClient = new google.auth.OAuth2(
          process.env.GMAIL_CLIENT_ID,
          process.env.GMAIL_CLIENT_SECRET,
          process.env.GMAIL_REDIRECT_URI
        );
        oauthClient.setCredentials(tokens);
        userData.oauthClient = oauthClient;
        userTokens.set(userId, userData);
      }
      
      const gmail = google.gmail({ version: 'v1', auth: oauthClient });
      
      const originalMsg = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const originalMessage = this.parseMessage(originalMsg.data);
      
      const quotedContent = originalMessage.content
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');
      
      const fullReply = `${replyBody}\n\nOn ${originalMessage.date} at ${originalMessage.time}, ${originalMessage.from.name} wrote:\n${quotedContent}`;
      
      const email = [
        `To: ${originalMessage.from.email}`,
        `Subject: Re: ${originalMessage.subject}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `In-Reply-To: ${originalMessage.id}`,
        `References: ${originalMessage.threadId}`,
        '',
        fullReply
      ].join('\n');

      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
          threadId: originalMessage.threadId
        }
      });
      
      const apiResponse = new ApiResponse(
        { 
          messageId: response.data.id,
          threadId: response.data.threadId
        },
        "Reply sent successfully"
      );
      return res.json(apiResponse);
    } catch (error) {
      console.error('Error replying to message:', error);
      const errorResponse = new ErrorResponse('Failed to send reply');
      return res.status(500).json(errorResponse);
    }
  }

  async modifyMessage(req, res) {
    try {
      const userId = 'default_user';
      const { messageId, action } = req.body;
      const userData = userTokens.get(userId);
      
      if (!userData || !userData.tokens) {
        const errorResponse = new ErrorResponse('Gmail not connected');
        return res.status(401).json(errorResponse);
      }

      if (!messageId || !action) {
        const errorResponse = new ErrorResponse('Missing required fields: messageId, action');
        return res.status(400).json(errorResponse);
      }

      let { oauthClient, tokens } = userData;
      
      if (!oauthClient) {
        oauthClient = new google.auth.OAuth2(
          process.env.GMAIL_CLIENT_ID,
          process.env.GMAIL_CLIENT_SECRET,
          process.env.GMAIL_REDIRECT_URI
        );
        oauthClient.setCredentials(tokens);
        userData.oauthClient = oauthClient;
        userTokens.set(userId, userData);
      }
      
      const gmail = google.gmail({ version: 'v1', auth: oauthClient });
      
      let addLabelIds = [];
      let removeLabelIds = [];
      
      switch (action) {
        case 'read':
          removeLabelIds = ['UNREAD'];
          break;
        case 'unread':
          addLabelIds = ['UNREAD'];
          break;
        case 'star':
          addLabelIds = ['STARRED'];
          break;
        case 'unstar':
          removeLabelIds = ['STARRED'];
          break;
        case 'archive':
          removeLabelIds = ['INBOX'];
          break;
        case 'trash':
          await gmail.users.messages.trash({
            userId: 'me',
            id: messageId
          });
          const trashResponse = new ApiResponse({ action }, "Message trashed successfully");
          return res.json(trashResponse);
        default:
          const errorResponse = new ErrorResponse('Invalid action');
          return res.status(400).json(errorResponse);
      }
      
      if (addLabelIds.length > 0 || removeLabelIds.length > 0) {
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            addLabelIds,
            removeLabelIds
          }
        });
      }
      
      const apiResponse = new ApiResponse({ action }, "Message modified successfully");
      return res.json(apiResponse);
    } catch (error) {
      console.error('Error modifying message:', error);
      const errorResponse = new ErrorResponse('Failed to modify message');
      return res.status(500).json(errorResponse);
    }
  }

  async batchModifyMessages(req, res) {
    try {
      const userId = 'default_user';
      const { messageIds, action } = req.body;
      const userData = userTokens.get(userId);
      
      if (!userData || !userData.tokens) {
        const errorResponse = new ErrorResponse('Gmail not connected');
        return res.status(401).json(errorResponse);
      }

      if (!messageIds || !messageIds.length || !action) {
        const errorResponse = new ErrorResponse('Missing required fields: messageIds, action');
        return res.status(400).json(errorResponse);
      }

      let { oauthClient, tokens } = userData;
      
      if (!oauthClient) {
        oauthClient = new google.auth.OAuth2(
          process.env.GMAIL_CLIENT_ID,
          process.env.GMAIL_CLIENT_SECRET,
          process.env.GMAIL_REDIRECT_URI
        );
        oauthClient.setCredentials(tokens);
        userData.oauthClient = oauthClient;
        userTokens.set(userId, userData);
      }
      
      const gmail = google.gmail({ version: 'v1', auth: oauthClient });
      
      const results = [];
      
      for (const messageId of messageIds) {
        try {
          let addLabelIds = [];
          let removeLabelIds = [];
          
          switch (action) {
            case 'read':
              removeLabelIds = ['UNREAD'];
              break;
            case 'unread':
              addLabelIds = ['UNREAD'];
              break;
            case 'star':
              addLabelIds = ['STARRED'];
              break;
            case 'unstar':
              removeLabelIds = ['STARRED'];
              break;
            case 'archive':
              removeLabelIds = ['INBOX'];
              break;
            case 'trash':
              await gmail.users.messages.trash({
                userId: 'me',
                id: messageId
              });
              results.push({ messageId, success: true });
              continue;
            default:
              results.push({ messageId, success: false, error: 'Invalid action' });
              continue;
          }
          
          await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
              addLabelIds,
              removeLabelIds
            }
          });
          
          results.push({ messageId, success: true });
        } catch (error) {
          results.push({ messageId, success: false, error: error.message });
        }
      }
      
      const apiResponse = new ApiResponse({ results }, "Batch modification completed");
      return res.json(apiResponse);
    } catch (error) {
      console.error('Error batch modifying messages:', error);
      const errorResponse = new ErrorResponse('Failed to batch modify messages');
      return res.status(500).json(errorResponse);
    }
  }

  async getUserProfile(req, res) {
    try {
      const userId = 'default_user';
      const userData = userTokens.get(userId);
      
      const apiResponse = new ApiResponse(
        { 
          profile: { 
            emailAddress: userData?.email || 'Connected',
            messagesTotal: 0,
            threadsTotal: 0
          } 
        },
        "Profile retrieved successfully"
      );
      return res.json(apiResponse);
    } catch (error) {
      console.error('Error getting profile:', error);
      const errorResponse = new ErrorResponse('Failed to get profile');
      return res.status(500).json(errorResponse);
    }
  }

  async checkConnection(req, res) {
    try {
      const userId = 'default_user';
      const userData = userTokens.get(userId);
      
      const apiResponse = new ApiResponse(
        { 
          connected: !!userData && !!userData.tokens,
          email: userData?.email || null
        },
        "Connection status retrieved"
      );
      return res.json(apiResponse);
    } catch (error) {
      const errorResponse = new ErrorResponse('Failed to check connection');
      return res.status(500).json(errorResponse);
    }
  }

  async disconnectGmail(req, res) {
    try {
      const userId = 'default_user';
      userTokens.delete(userId);
      
      const apiResponse = new ApiResponse(null, "Gmail disconnected successfully");
      return res.json(apiResponse);
    } catch (error) {
      console.error('Error disconnecting:', error);
      const errorResponse = new ErrorResponse('Failed to disconnect');
      return res.status(500).json(errorResponse);
    }
  }

  // Helper function to parse Gmail message
  parseMessage(message) {
    try {
      const headers = message.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || '';
      const to = headers.find(h => h.name === 'To')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
      const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();

      // Parse from header
      const fromMatch = from.match(/(.*?)\s*<(.+?)>/);
      const fromName = fromMatch ? fromMatch[1].trim() : from;
      const fromEmail = fromMatch ? fromMatch[2] : from;

      // Extract message body
      let content = '';
      
      const getBody = (part) => {
        if (!part) return '';
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) {
          for (const subPart of part.parts) {
            const result = getBody(subPart);
            if (result) return result;
          }
        }
        return '';
      };

      content = getBody(message.payload) || '';
      
      const labels = message.labelIds || [];
      const hasAttachments = message.payload.parts?.some(p => p.filename && p.filename.length > 0) || false;

      return {
        id: message.id,
        threadId: message.threadId,
        from: { name: fromName, email: fromEmail },
        to: to.split(',').map(t => t.trim()),
        subject,
        preview: content.substring(0, 150),
        content,
        date: new Date(date).toLocaleDateString(),
        time: new Date(date).toLocaleTimeString(),
        read: !labels.includes('UNREAD'),
        starred: labels.includes('STARRED'),
        hasAttachments,
        labels
      };
    } catch (error) {
      console.error('Error parsing message:', error);
      return {
        id: message.id || 'unknown',
        threadId: message.threadId || 'unknown',
        from: { name: 'Unknown', email: 'unknown' },
        to: [],
        subject: 'Error parsing message',
        preview: 'Unable to parse message content',
        content: '',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        read: true,
        starred: false,
        hasAttachments: false,
        labels: []
      };
    }
  }
}

module.exports = new GmailController();