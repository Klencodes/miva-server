const { google } = require('googleapis');
const { oauth2Client, setCredentials, refreshToken } = require('../config/googleConfig');

class GmailService {
  constructor() {
    this.gmail = null;
  }

  initialize(authTokens) {
    setCredentials(authTokens);
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    return this;
  }

  async refreshAccessToken(refreshTokenStr) {
    const newTokens = await refreshToken(refreshTokenStr);
    setCredentials(newTokens);
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    return newTokens;
  }

  async getMessages(userId = 'me', maxResults = 50, query = '') {
    try {
      const response = await this.gmail.users.messages.list({
        userId,
        maxResults,
        q: query || 'in:inbox'
      });

      const messages = response.data.messages || [];
      const fullMessages = await Promise.all(
        messages.map(async (msg) => {
          const fullMsg = await this.gmail.users.messages.get({
            userId,
            id: msg.id,
            format: 'full'
          });
          return this.parseMessage(fullMsg.data);
        })
      );

      return fullMessages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  async getMessageById(userId = 'me', messageId) {
    try {
      const response = await this.gmail.users.messages.get({
        userId,
        id: messageId,
        format: 'full'
      });
      return this.parseMessage(response.data);
    } catch (error) {
      console.error('Error fetching message:', error);
      throw error;
    }
  }

  async getThreadMessages(userId = 'me', threadId) {
    try {
      const response = await this.gmail.users.threads.get({
        userId,
        id: threadId,
        format: 'full'
      });
      return response.data.messages.map(msg => this.parseMessage(msg));
    } catch (error) {
      console.error('Error fetching thread:', error);
      throw error;
    }
  }

  parseMessage(message) {
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
    let plainText = '';

    const getBody = (part) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
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
    
    // Clean HTML if needed
    if (content.includes('<html')) {
      plainText = content.replace(/<[^>]*>/g, '').trim();
    } else {
      plainText = content;
    }

    const labels = message.labelIds || [];
    const hasAttachments = message.payload.parts?.some(p => p.filename && p.filename.length > 0) || false;

    return {
      id: message.id,
      threadId: message.threadId,
      from: { name: fromName, email: fromEmail },
      to: to.split(',').map(t => t.trim()),
      subject,
      preview: plainText.substring(0, 150),
      content: plainText,
      date: new Date(date).toLocaleDateString(),
      time: new Date(date).toLocaleTimeString(),
      read: !labels.includes('UNREAD'),
      starred: labels.includes('STARRED'),
      hasAttachments,
      labels
    };
  }

  async sendMessage(userId = 'me', to, subject, body, threadId = null) {
    try {
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
        userId,
        requestBody: { raw: encodedEmail }
      };

      if (threadId) {
        requestBody.requestBody.threadId = threadId;
      }

      const response = await this.gmail.users.messages.send(requestBody);
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async replyToMessage(userId = 'me', originalMessage, replyBody) {
    const quotedContent = originalMessage.content
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
    
    const fullReply = `${replyBody}\n\nOn ${originalMessage.date} at ${originalMessage.time}, ${originalMessage.from.name} wrote:\n${quotedContent}`;
    
    return this.sendMessage(
      userId,
      originalMessage.from.email,
      originalMessage.subject.startsWith('Re:') ? originalMessage.subject : `Re: ${originalMessage.subject}`,
      fullReply,
      originalMessage.threadId
    );
  }

  async modifyMessage(userId = 'me', messageId, addLabels = [], removeLabels = []) {
    try {
      await this.gmail.users.messages.modify({
        userId,
        id: messageId,
        requestBody: {
          addLabelIds: addLabels,
          removeLabelIds: removeLabels
        }
      });
      return { success: true };
    } catch (error) {
      console.error('Error modifying message:', error);
      throw error;
    }
  }

  async markAsRead(userId = 'me', messageId) {
    return this.modifyMessage(userId, messageId, [], ['UNREAD']);
  }

  async markAsUnread(userId = 'me', messageId) {
    return this.modifyMessage(userId, messageId, ['UNREAD'], []);
  }

  async toggleStar(userId = 'me', messageId, starred) {
    return this.modifyMessage(
      userId, 
      messageId, 
      starred ? ['STARRED'] : [], 
      starred ? [] : ['STARRED']
    );
  }

  async archiveMessage(userId = 'me', messageId) {
    return this.modifyMessage(userId, messageId, [], ['INBOX']);
  }

  async trashMessage(userId = 'me', messageId) {
    try {
      await this.gmail.users.messages.trash({
        userId,
        id: messageId
      });
      return { success: true };
    } catch (error) {
      console.error('Error trashing message:', error);
      throw error;
    }
  }

  async getLabels(userId = 'me') {
    try {
      const response = await this.gmail.users.labels.list({ userId });
      return response.data.labels;
    } catch (error) {
      console.error('Error fetching labels:', error);
      throw error;
    }
  }

  async getUserProfile(userId = 'me') {
    try {
      const response = await this.gmail.users.getProfile({ userId });
      return response.data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  }
}

module.exports = new GmailService();