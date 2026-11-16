import { apiClient } from './apiClient';

export interface EmailMessage {
  id: string;
  accountId: string;
  from: { name: string; address: string };
  to: Array<{ name: string; address: string }> | string[];
  subject: string;
  snippet: string;
  body: string;
  html?: string;
  receivedAt: string | Date;
  isRead: boolean;
  folder: 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash';
  hasAttachments: boolean;
  provider?: string;
}

export interface MailAccount {
  id: string;
  email: string;
  provider: 'native' | 'gmail' | 'imap' | 'outlook';
  isDefault: boolean;
}

class SovereignEmailService {
  /**
   * Fetch user's linked email accounts
   */
  async getAccounts(): Promise<MailAccount[]> {
    const response = await apiClient.get('/email/accounts');
    return response.accounts;
  }

  /**
   * Fetch the unified inbox
   */
  async getInbox(folder: string = 'inbox', limit: number = 50, accountId: string = 'all'): Promise<EmailMessage[]> {
    const response = await apiClient.get(`/email/inbox?folder=${folder}&limit=${limit}&accountId=${accountId}`);
    return response.emails;
  }

  /**
   * Send an email
   */
  async sendEmail(data: {
    to: string;
    subject: string;
    body: string;
    html?: string;
    fromName?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    return apiClient.post('/email/send', data);
  }

  /**
   * Claim a native @novaura.life handle
   */
  async claimHandle(handle: string): Promise<{ success: boolean; email: string }> {
    return apiClient.post('/email/claim', { handle });
  }

  /**
   * Mark as read/unread
   */
  async markAsRead(id: string, isRead: boolean): Promise<void> {
    await apiClient.patch(`/email/messages/${id}`, { isRead });
  }

  /**
   * Move to folder (e.g. trash, spam)
   */
  async moveToFolder(id: string, folder: string): Promise<void> {
    await apiClient.patch(`/email/messages/${id}`, { folder });
  }

  /**
   * Trigger a manual sync of external accounts
   */
  async sync(): Promise<{ success: boolean }> {
    return apiClient.post('/email/sync', {});
  }

  /**
   * Get Aura AI Insight for a specific thread/message
   */
  async getAuraInsight(emailId: string): Promise<{ summary: string; intent: string; suggestedActions: string[] }> {
    // This calls the AI route which analyzes the email content
    return apiClient.get(`/ai/analyze-email?id=${emailId}`);
  }
}

export const sovereignEmailService = new SovereignEmailService();
