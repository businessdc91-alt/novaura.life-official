import * as admin from 'firebase-admin';
import { inboxService } from './inboxService';
import { secretService } from './secretService';

/**
 * SyncService handles fetching emails from external providers (Gmail, Titan, Hotmail, etc.)
 * and aggregating them into the unified NovAura Inbox.
 */
export class SyncService {
  private static instance: SyncService;
  private db = admin.firestore();

  private constructor() {}

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Sync all accounts for a specific user
   */
  public async syncUser(userId: string): Promise<{ success: boolean; syncedCount: number }> {
    const accountsSnapshot = await this.db.collection('user_mail_accounts')
      .where('userId', '==', userId)
      .get();

    let totalSynced = 0;
    for (const doc of accountsSnapshot.docs) {
      const account = doc.data();
      const count = await this.syncAccount(userId, doc.id, account);
      totalSynced += count;
    }

    return { success: true, syncedCount: totalSynced };
  }

  /**
   * Sync a specific account (IMAP/Gmail)
   */
  private async syncAccount(userId: string, accountId: string, account: any): Promise<number> {
    console.log(`[Sync] Syncing account ${account.email} (${account.provider})`);
    
    const decryptedCreds = JSON.parse(secretService.decrypt(account.credentials));
    let syncedCount = 0;

    if (account.provider === 'imap') {
      syncedCount = await this.syncImap(userId, accountId, account.email, decryptedCreds);
    } else if (account.provider === 'gmail') {
      // Gmail logic using googleapis would go here
      // For now, let's focus on universal IMAP for Titan/Hotmail/etc.
    }

    // Update lastSync timestamp
    await this.db.collection('user_mail_accounts').doc(accountId).update({
      lastSync: admin.firestore.FieldValue.serverTimestamp()
    });

    return syncedCount;
  }

  /**
   * IMAP Sync Implementation using ImapFlow
   */
  private async syncImap(userId: string, accountId: string, email: string, creds: any): Promise<number> {
    const { ImapFlow } = require('imapflow');
    const { simpleParser } = require('mailparser');

    const client = new ImapFlow({
      host: creds.host,
      port: creds.port || 993,
      secure: creds.secure !== false,
      auth: {
        user: creds.user || email,
        pass: creds.pass
      },
      logger: false
    });

    let count = 0;
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      
      try {
        // Fetch last 20 messages or messages since a specific date/UID
        // In a production app, we'd store the last UID to avoid duplicates
        for await (const message of client.fetch('1:*', { envelope: true, source: true })) {
          const parsed = await (simpleParser as any)(message.source);
          
          // Check if already exists (idempotency)
          const existing = await this.db.collection('user_emails')
            .where('userId', '==', userId)
            .where('externalId', '==', message.uid.toString())
            .where('accountId', '==', accountId)
            .limit(1)
            .get();

          if (existing.empty) {
            await inboxService.saveEmail({
              userId,
              accountId,
              from: { 
                name: parsed.from?.value[0]?.name || '', 
                address: parsed.from?.value[0]?.address || '' 
              },
              to: (parsed.to as any)?.value?.map((v: any) => v.address) || [],
              subject: parsed.subject || '(No Subject)',
              snippet: parsed.text?.substring(0, 150) || '',
              body: parsed.html || parsed.text || '',
              receivedAt: parsed.date || new Date(),
              isRead: false,
              folder: 'inbox',
              hasAttachments: (parsed.attachments?.length || 0) > 0,
              externalId: message.uid.toString()
            });
            count++;
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      console.error(`[Sync] IMAP error for ${email}:`, err);
    }
    return count;
  }
}

export const syncService = SyncService.getInstance();
