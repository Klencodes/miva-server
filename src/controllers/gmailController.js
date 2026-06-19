// backend/src/controllers/gmailController.js
const { google } = require('googleapis');

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
      res.json({ url });
    } catch (error) {
      console.error('Error getting auth URL:', error);
      res.status(500).json({ error: 'Failed to generate auth URL', details: error.message });
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
        return res.status(400).json({ error: 'Authorization code required' });
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
        return res.status(401).json({ error: 'Gmail not connected' });
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

      res.json({ messages: fullMessages, total: fullMessages.length });
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
    }
  }

  async getMessageById(req, res) {
    try {
      const userId = 'default_user';
      const { messageId } = req.params;
      const userData = userTokens.get(userId);
      
      if (!userData || !userData.tokens) {
        return res.status(401).json({ error: 'Gmail not connected' });
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
      res.json({ message });
    } catch (error) {
      console.error('Error getting message by ID:', error);
      res.status(500).json({ error: 'Failed to fetch message', details: error.message });
    }
  }

  async sendMessage(req, res) {
    try {
      const userId = 'default_user';
      const { to, subject, body, threadId } = req.body;
      const userData = userTokens.get(userId);
      
      if (!userData || !userData.tokens) {
        return res.status(401).json({ error: 'Gmail not connected' });
      }

      if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
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
      
      res.json({ 
        success: true, 
        messageId: response.data.id,
        threadId: response.data.threadId
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
  }

  async replyToMessage(req, res) {
    try {
      const userId = 'default_user';
      const { messageId, replyBody } = req.body;
      const userData = userTokens.get(userId);
      
      if (!userData || !userData.tokens) {
        return res.status(401).json({ error: 'Gmail not connected' });
      }

      if (!messageId || !replyBody) {
        return res.status(400).json({ error: 'Missing required fields: messageId, replyBody' });
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
      
      res.json({ 
        success: true, 
        messageId: response.data.id,
        threadId: response.data.threadId
      });
    } catch (error) {
      console.error('Error replying to message:', error);
      res.status(500).json({ error: 'Failed to send reply', details: error.message });
    }
  }

  async modifyMessage(req, res) {
    try {
      const userId = 'default_user';
      const { messageId, action } = req.body;
      const userData = userTokens.get(userId);
      
      if (!userData || !userData.tokens) {
        return res.status(401).json({ error: 'Gmail not connected' });
      }

      if (!messageId || !action) {
        return res.status(400).json({ error: 'Missing required fields: messageId, action' });
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
          return res.json({ success: true, action });
        default:
          return res.status(400).json({ error: 'Invalid action' });
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
      
      res.json({ success: true, action });
    } catch (error) {
      console.error('Error modifying message:', error);
      res.status(500).json({ error: 'Failed to modify message', details: error.message });
    }
  }

  async batchModifyMessages(req, res) {
    try {
      const userId = 'default_user';
      const { messageIds, action } = req.body;
      const userData = userTokens.get(userId);
      
      if (!userData || !userData.tokens) {
        return res.status(401).json({ error: 'Gmail not connected' });
      }

      if (!messageIds || !messageIds.length || !action) {
        return res.status(400).json({ error: 'Missing required fields: messageIds, action' });
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
      
      res.json({ success: true, results });
    } catch (error) {
      console.error('Error batch modifying messages:', error);
      res.status(500).json({ error: 'Failed to batch modify messages', details: error.message });
    }
  }

  async getUserProfile(req, res) {
    try {
      const userId = 'default_user';
      const userData = userTokens.get(userId);
      
      res.json({ 
        profile: { 
          emailAddress: userData?.email || 'Connected',
          messagesTotal: 0,
          threadsTotal: 0
        } 
      });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  async checkConnection(req, res) {
    try {
      const userId = 'default_user';
      const userData = userTokens.get(userId);
      
      res.json({ 
        connected: !!userData && !!userData.tokens,
        email: userData?.email || null
      });
    } catch (error) {
      res.json({ connected: false });
    }
  }

  async disconnectGmail(req, res) {
    try {
      const userId = 'default_user';
      userTokens.delete(userId);
      
      res.json({ success: true, message: 'Gmail disconnected successfully' });
    } catch (error) {
      console.error('Error disconnecting:', error);
      res.status(500).json({ error: 'Failed to disconnect' });
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