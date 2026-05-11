import * as admin from 'firebase-admin';
import { secretService } from './secretService';

export interface EmailMessage {
  id: string;
  userId: string;
  accountId: string; // 'internal' or an external account ID
  from: { name: string; address: string };
  to: Array<{ name: string; address: string }> | string[];
  subject: string;
  snippet: string;
  body: string;
  html?: string;
  receivedAt: Date;
  isRead: boolean;
  folder: 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash';
  hasAttachments: boolean;
  externalId?: string; // ID in Gmail/IMAP
  threadId?: string;
  provider?: string; // 'native', 'gmail', 'imap', etc.
}

/**
 * InboxService handles storage and retrieval of emails for the unified NovAura grid.
 */
export class InboxService {
  private static instance: InboxService;
  private db = admin.firestore();

  private constructor() {}

  public static getInstance(): InboxService {
    if (!InboxService.instance) {
      InboxService.instance = new InboxService();
    }
    return InboxService.instance;
  }

  /**
   * Save an email to the unified store
   */
  public async saveEmail(email: Omit<EmailMessage, 'id'>): Promise<string> {
    const docRef = await this.db.collection('user_emails').add({
      ...email,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  /**
   * Add a message to a user's inbox (convenience wrapper)
   */
  public async addMessage(
    userId: string,
    message: Omit<EmailMessage, 'id' | 'userId' | 'to' | 'hasAttachments'> & { to: Array<{ name: string; address: string }> | string[]; hasAttachments?: boolean }
  ): Promise<string> {
    return this.saveEmail({
      ...message,
      userId,
      hasAttachments: message.hasAttachments ?? false,
    } as Omit<EmailMessage, 'id'>);
  }

  /**
   * Fetch inbox for a user
   */
  public async getInbox(
    userId: string,
    limit = 50,
    folder: EmailMessage['folder'] | 'all' = 'inbox',
    accountId: string = 'all'
  ): Promise<EmailMessage[]> {
    let query: FirebaseFirestore.Query = this.db.collection('user_emails')
      .where('userId', '==', userId);

    if (folder !== 'all') {
      query = query.where('folder', '==', folder);
    }

    query = query.orderBy('receivedAt', 'desc').limit(limit);

    const snapshot = await query.get();
    let messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as EmailMessage));

    if (accountId !== 'all') {
      messages = messages.filter(m => m.accountId === accountId);
    }

    return messages;
  }

  /**
   * Mark email as read
   */
  public async markAsRead(emailId: string, isRead = true): Promise<void> {
    await this.db.collection('user_emails').doc(emailId).update({ isRead });
  }

  /**
   * Delete or Move to Trash
   */
  public async moveToFolder(emailId: string, folder: EmailMessage['folder']): Promise<void> {
    await this.db.collection('user_emails').doc(emailId).update({ folder });
  }

  /**
   * Connect an external account (Gmail/Outlook/IMAP)
   */
  public async addExternalAccount(userId: string, config: {
    provider: 'gmail' | 'outlook' | 'imap';
    email: string;
    credentials: any; // Encrypted blob or OAuth tokens
  }): Promise<string> {
    // Encrypt credentials before saving
    const encryptedCreds = secretService.encrypt(JSON.stringify(config.credentials));
    
    const docRef = await this.db.collection('user_mail_accounts').add({
      userId,
      provider: config.provider,
      email: config.email,
      credentials: encryptedCreds,
      lastSync: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return docRef.id;
  }
}

export const inboxService = InboxService.getInstance();
