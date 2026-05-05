import { secretService } from './secretService';
import * as admin from 'firebase-admin';

/**
 * NovAura Email Service — Automated Grid Routing
 * 
 * Supports:
 * Supports:
 * - Platform Fallback (SMTP)
 * - BYOK (User provides their own SMTP/Resend/Postmark keys)
 * - Intelligent Routing (Transactional vs. Marketing vs. Swarm Notifications)
 * - Retry Logic with Exponential Backoff
 * - Transport Verification
 */
export class EmailService {
  private static instance: EmailService;
  private platformTransport: any = null;
  private lastVerifyTime = 0;
  private readonly VERIFY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Initialize the platform-wide fallback transport
   */
  private async getPlatformTransport(): Promise<any> {
    if (this.platformTransport) return this.platformTransport;
    const nodemailer = require('nodemailer');

    const host = await secretService.getSecret('SMTP_HOST');
    const port = parseInt(await secretService.getSecret('SMTP_PORT') || '587');
    const user = await secretService.getSecret('SMTP_USER');
    const pass = await secretService.getSecret('SMTP_PASS');

    if (!user || !pass) {
      console.warn('[Email] Platform SMTP keys missing. Email functionality degraded.');
    }

    this.platformTransport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      pool: true, // Use pooled connections for better throughput
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
    } as any);

    return this.platformTransport;
  }

  /**
   * Verify that the platform transport is healthy
   */
  public async verifyTransport(): Promise<boolean> {
    try {
      const transport = await this.getPlatformTransport();
      const result = await transport.verify();
      this.lastVerifyTime = Date.now();
      return result === true;
    } catch (err: any) {
      console.error('[Email] Transport verification failed:', err.message);
      // Clear cached transport so it can be reinitialized
      this.platformTransport = null;
      return false;
    }
  }

  /**
   * Get a transport for a specific user (BYOK)
   */
  private async getUserTransport(userId: string): Promise<{ transport: any; fromAddress: string } | null> {
    const nodemailer = require('nodemailer');
    try {
      const doc = await admin.firestore().collection('vault_user_api_keys').doc(userId).get();
      const emailConfig = doc.data()?.email_config;

      if (emailConfig && emailConfig.key) {
        const decryptedKey = secretService.decrypt(emailConfig.key);
        
        // Handle different providers
        // Reserved for future sovereign provider logic
        if (emailConfig.provider === 'smtp') {
          return {
            transport: nodemailer.createTransport({
              host: emailConfig.host,
              port: emailConfig.port,
              secure: emailConfig.port === 465,
              auth: { user: emailConfig.user, pass: decryptedKey }
            }),
            fromAddress: emailConfig.fromAddress || `${emailConfig.user}@${emailConfig.host}`
          };
        }
      }
    } catch (err) {
      console.error('[Email] Failed to load user transport:', err);
    }
    return null;
  }

  /**
   * Main send method with intelligent routing and retry logic
   */
  public async sendEmail(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    userId?: string;
    fromName?: string;
    category?: 'transactional' | 'swarm' | 'alert';
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const maxRetries = 3;
    let lastError: string = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let transporter: any;
        let fromAddress: string;

        // 1. Try User BYOK Transport (Premium/Catalyst Tier)
        if (params.userId) {
          const userTransportData = await this.getUserTransport(params.userId);
          if (userTransportData) {
            transporter = userTransportData.transport;
            fromAddress = `"${params.fromName || 'NovAura Agent'}" <${userTransportData.fromAddress}>`;
          } else {
            // 2. Platform Branded Fallback (Ambassador Mode)
            transporter = await this.getPlatformTransport();
            const userDoc = await admin.firestore().collection('users').doc(params.userId).get();
            const username = userDoc.data()?.username || params.userId.substring(0, 8);
            const displayName = params.fromName || userDoc.data()?.displayName || 'User';
            
            // Force branding for lower tiers
            fromAddress = `"${displayName}" <${username}@novaura.life>`;
          }
        } else {
          transporter = await this.getPlatformTransport();
          fromAddress = `"NovAura Platform" <no-reply@novaura.life>`;
        }

        const info = await transporter.sendMail({
          from: fromAddress,
          to: params.to,
          subject: params.subject,
          text: params.text,
          html: params.html,
          headers: {
            'X-NovAura-Category': params.category || 'general',
            'X-NovAura-Retry': attempt > 1 ? String(attempt) : undefined
          }
        });

        console.log(`[Email] Sent: ${info.messageId} to ${params.to} (attempt ${attempt})`);
        return { success: true, messageId: info.messageId };
      } catch (err: any) {
        lastError = err.message;
        const isTransient = this.isTransientError(err);
        
        if (!isTransient || attempt === maxRetries) {
          console.error(`[Email] Send error (attempt ${attempt}):`, err.message);
          break;
        }

        // Exponential backoff: 500ms, 1000ms, 2000ms
        const delay = Math.pow(2, attempt - 1) * 500;
        console.warn(`[Email] Transient error, retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    return { success: false, error: lastError };
  }

  private isTransientError(err: any): boolean {
    const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'];
    const transientMessages = ['temporary', 'timeout', 'unavailable', 'rate limit', 'too many requests'];
    
    const code = err.code || '';
    const message = (err.message || '').toLowerCase();
    
    if (transientCodes.includes(code)) return true;
    return transientMessages.some(m => message.includes(m));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Specialized: Welcome Email
   */
  public async sendWelcomeEmail(to: string, displayName: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Welcome to the Frontier, ${displayName}!`,
      category: 'transactional',
      html: `
        <div style="font-family: sans-serif; background: #0a0a0f; color: #fff; padding: 40px; border-radius: 12px;">
          <h1 style="color: #4c65ff;">NovAura WebOS</h1>
          <p>Hello ${displayName},</p>
          <p>Your workspace is ready. The Frontier Swarm is standing by to build your vision.</p>
          <a href="https://novaura.life/desktop" style="display: inline-block; padding: 12px 24px; background: #4c65ff; color: #fff; text-decoration: none; border-radius: 6px;">Launch Command Station</a>
        </div>
      `
    });
  }

  /**
   * Specialized: Password Reset
   */
  public async sendPasswordResetEmail(to: string, displayName: string, link: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Reset your NovAura Access',
      category: 'transactional',
      html: `<p>Hello ${displayName},</p><p>Click below to reset your password:</p><a href="${link}">${link}</a>`
    });
  }

  /**
   * Specialized: Swarm Update (Engineering Log)
   */
  public async sendSwarmUpdateEmail(to: string, projectName: string, summary: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: `[Swarm Update] ${projectName}`,
      category: 'swarm',
      html: `
        <div style="font-family: monospace; background: #0a0a0f; color: #00f0ff; padding: 20px; border: 1px solid #00f0ff22;">
          <h2 style="border-bottom: 1px solid #00f0ff22; padding-bottom: 10px;">FRONTIER SWARM LOG</h2>
          <p><strong>Project:</strong> ${projectName}</p>
          <div style="color: #e0e0e0; margin-top: 20px;">
            ${summary.replace(/\n/g, '<br/>')}
          </div>
        </div>
      `
    });
  }

  public async sendTestEmail(to: string): Promise<void> {
    const res = await this.sendEmail({
      to,
      subject: 'NovAura SMTP Test',
      text: 'If you see this, your NovAura email routing is functional.',
      category: 'alert'
    });
    if (!res.success) throw new Error(res.error);
  }

  public async sendPrereleaseNotification(email: string): Promise<void> {
    await this.sendEmail({
      to: 'Dillan.Copeland@novaura.xyz',
      subject: `New Frontier Signup: ${email}`,
      category: 'transactional',
      html: `
        <div style="font-family: sans-serif; background: #0a0a0f; color: #fff; padding: 40px;">
          <h2 style="color: #4c65ff;">NovAura Waitlist</h2>
          <p>A new user has requested access to the frontier:</p>
          <p><strong>Email:</strong> ${email}</p>
        </div>
      `
    });
  }
}

export const emailService = EmailService.getInstance();
export const sendPrereleaseNotification = (email: string) => emailService.sendPrereleaseNotification(email);
