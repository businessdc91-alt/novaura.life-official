import { kernelStorage } from '@/kernel/kernelStorage.js';
export interface MailAccount {
  id: string;
  email: string;
  provider: 'titan' | 'gmail' | 'custom';
  smtpHost?: string;
  smtpPort?: number;
  isCompanyAccount: boolean;
}

export interface EmailMessage {
  id: string;
  accountId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  status: 'draft' | 'sent' | 'received';
  isAgentic?: boolean; // If true, Aura sent this autonomously
  createdAt: string;
}

const STORAGE_KEYS = {
  mailAccounts: 'novaura_mail_accounts_', 
  emails: 'novaura_emails_',
};

class MailService {
  private getAccountKey(userId: string) { return `${STORAGE_KEYS.mailAccounts}${userId}`; }
  private getEmailKey(userId: string) { return `${STORAGE_KEYS.emails}${userId}`; }

  getAccounts(userId: string): MailAccount[] {
    const data = kernelStorage.getItem(this.getAccountKey(userId));
    return data ? JSON.parse(data) : [];
  }

  getEmails(userId: string): EmailMessage[] {
    const data = kernelStorage.getItem(this.getEmailKey(userId));
    return data ? JSON.parse(data) : [];
  }

  async syncAccounts(userId: string, token?: string): Promise<MailAccount[]> {
    if (token) {
      try {
        const res = await fetch('/api/email/accounts', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.accounts && Array.isArray(data.accounts)) {
            const mapped = data.accounts.map((acc: any) => ({
              id: acc.id || acc.accountId,
              email: acc.email,
              provider: acc.provider || 'titan',
              isCompanyAccount: acc.email?.endsWith('@novaura.life') || false
            }));
            kernelStorage.setItem(this.getAccountKey(userId), JSON.stringify(mapped));
            return mapped;
          }
        }
      } catch (err) {
        console.warn('[MailService] Failed to fetch accounts from backend API, using cached:', err);
      }
    }
    return this.getAccounts(userId);
  }

  async syncEmails(userId: string, token?: string): Promise<EmailMessage[]> {
    if (token) {
      try {
        const res = await fetch('/api/email/inbox?limit=50&folder=inbox', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.emails && Array.isArray(data.emails)) {
            const mapped = data.emails.map((m: any) => ({
              id: m.id,
              accountId: m.accountId || 'acc-1',
              from: typeof m.from === 'object' ? `${m.from.name || ''} <${m.from.address || ''}>` : (m.from || 'Unknown'),
              to: typeof m.to === 'object' ? m.to.address : (m.to || ''),
              subject: m.subject || 'No Subject',
              body: m.snippet || m.body || m.text || '',
              status: m.folder || 'received',
              isAgentic: m.category === 'agentic',
              createdAt: m.receivedAt?.seconds ? new Date(m.receivedAt.seconds * 1000).toISOString() : new Date().toISOString()
            }));
            kernelStorage.setItem(this.getEmailKey(userId), JSON.stringify(mapped));
            return mapped;
          }
        }
      } catch (err) {
        console.warn('[MailService] Failed to fetch emails from backend API, using cached:', err);
      }
    }
    return this.getEmails(userId);
  }

  saveAccount(userId: string, account: MailAccount) {
    const accounts = this.getAccounts(userId);
    const existingIndex = accounts.findIndex(a => a.id === account.id);
    if (existingIndex >= 0) accounts[existingIndex] = account;
    else accounts.push(account);
    kernelStorage.setItem(this.getAccountKey(userId), JSON.stringify(accounts));
  }

  async sendEmailLive(userId: string, email: Omit<EmailMessage, 'id' | 'createdAt'>, token?: string): Promise<EmailMessage> {
    if (token) {
      try {
        const res = await fetch('/api/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            to: email.to,
            subject: email.subject,
            body: email.body,
            fromName: email.from || 'NovAura User'
          })
        });
        if (res.ok) {
          console.log('[MailService] Email sent via backend API');
        }
      } catch (err) {
        console.warn('[MailService] Live send failed, saving to local cache:', err);
      }
    }
    return this.sendEmail(userId, email);
  }

  sendEmail(userId: string, email: Omit<EmailMessage, 'id' | 'createdAt'>): EmailMessage {
    const emails = this.getEmails(userId);
    const newEmail: EmailMessage = {
      ...email,
      id: `mail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    emails.push(newEmail);
    kernelStorage.setItem(this.getEmailKey(userId), JSON.stringify(emails));
    
    console.log('EMAIL SENT:', newEmail);
    return newEmail;
  }

  // Agentic Outreach Logic
  async runOutreachChain(userId: string, accountId: string, campaignData: { targets: string[], goal: string }) {
    const account = this.getAccounts(userId).find(a => a.id === accountId);
    if (!account) throw new Error("Mail account not found");

    for (const target of campaignData.targets) {
      // Aura drafting logic would go here
      const subject = `Collaborating on ${campaignData.goal}`;
      const body = `Hello, I'm Aura, the Digital Ambassador for NovAura platfrom. We saw your impressive projects...`;
      
      this.sendEmail(userId, {
        accountId,
        from: account.email,
        to: target,
        subject,
        body,
        status: 'sent',
        isAgentic: true
      });
    }
  }
}

export const mailService = new MailService();
