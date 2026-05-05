import { Router } from 'express';
import * as admin from 'firebase-admin';
import { inboxService } from '../../services/inboxService';
import { emailService } from '../../services/emailService';
import { syncService } from '../../services/syncService';
import { requireAuth } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limiter';

const router = Router();

// ─── Validation Helpers ─────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAX_SUBJECT_LENGTH = 998; // RFC 2822 limit
const MAX_BODY_LENGTH = 50_000; // ~50KB reasonable limit
const MAX_TO_LENGTH = 500; // Comma-separated list limit

function validateEmailInput(body: any): { valid: boolean; error?: string } {
  const { to, subject, body: textBody } = body;

  if (!to || typeof to !== 'string') {
    return { valid: false, error: 'Recipient (to) is required' };
  }

  const toTrimmed = to.trim();
  if (toTrimmed.length > MAX_TO_LENGTH) {
    return { valid: false, error: 'Recipient list too long' };
  }

  // Validate each recipient in comma-separated list
  const recipients = toTrimmed.split(',').map(r => r.trim()).filter(Boolean);
  if (recipients.length === 0) {
    return { valid: false, error: 'At least one recipient is required' };
  }
  if (recipients.length > 10) {
    return { valid: false, error: 'Maximum 10 recipients allowed' };
  }
  for (const recipient of recipients) {
    if (!EMAIL_REGEX.test(recipient)) {
      return { valid: false, error: `Invalid email address: ${recipient}` };
    }
  }

  if (!subject || typeof subject !== 'string') {
    return { valid: false, error: 'Subject is required' };
  }
  if (subject.trim().length === 0) {
    return { valid: false, error: 'Subject cannot be empty' };
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return { valid: false, error: `Subject exceeds ${MAX_SUBJECT_LENGTH} characters` };
  }

  if (!textBody || typeof textBody !== 'string') {
    return { valid: false, error: 'Body is required' };
  }
  if (textBody.length > MAX_BODY_LENGTH) {
    return { valid: false, error: `Body exceeds ${MAX_BODY_LENGTH} characters` };
  }

  return { valid: true };
}

// ─── GET /email/accounts ────────────────────────────────────────────────────
/**
 * GET /email/accounts
 * Fetch user's linked email accounts
 */
router.get('/accounts', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;

    const snapshot = await admin.firestore()
      .collection('user_mail_accounts')
      .where('userId', '==', userId)
      .get();

    const accounts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json({ success: true, accounts });
  } catch (err: any) {
    console.error('[Email] Failed to fetch accounts:', err);
    return res.status(500).json({ error: 'Failed to fetch accounts', detail: err.message });
  }
});

// ─── GET /email/inbox ───────────────────────────────────────────────────────
/**
 * GET /email/inbox
 * Fetch the unified inbox
 */
router.get('/inbox', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const folder = (req.query.folder as string) || 'inbox';
    const accountId = (req.query.accountId as string) || 'all';

    const emails = await inboxService.getInbox(userId, limit, folder as any, accountId);

    return res.json({ success: true, emails });
  } catch (err: any) {
    console.error('[Email] Inbox fetch failed:', err);
    return res.status(500).json({ error: 'Inbox fetch failed', detail: err.message });
  }
});

// ─── POST /email/send ───────────────────────────────────────────────────────
/**
 * POST /email/send
 * Enhanced send that saves to 'sent' folder
 */
router.post('/send', requireAuth, rateLimitMiddleware('email'), async (req, res) => {
  try {
    const validation = validateEmailInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
      return;
    }

    const { to, subject, body, html, fromName } = req.body;
    const userId = req.userId!;

    const result = await emailService.sendEmail({
      to: to.trim(),
      subject: subject.trim(),
      text: body.trim(),
      html: html || body.trim(),
      userId,
      fromName: fromName?.trim(),
      category: 'transactional'
    });

    if (result.success) {
      // Find native account for user
      const accSnap = await admin.firestore().collection('user_mail_accounts')
        .where('userId', '==', userId)
        .where('provider', '==', 'native')
        .limit(1)
        .get();

      const fromAddress = accSnap.empty
        ? `${userId.substring(0, 8)}@novaura.life`
        : accSnap.docs[0].data().email;

      // Save to Sent folder
      await inboxService.addMessage(userId, {
        accountId: accSnap.empty ? 'internal' : accSnap.docs[0].id,
        from: { name: fromName?.trim() || 'NovAura User', address: fromAddress },
        to: [to.trim()],
        subject: subject.trim(),
        snippet: body.trim().substring(0, 200),
        body: body.trim(),
        receivedAt: new Date(),
        isRead: true,
        folder: 'sent',
        hasAttachments: false
      });
    }

    return res.json(result);
  } catch (err: any) {
    console.error('[Email] Send failed:', err);
    return res.status(500).json({ error: 'Send failed', detail: err.message });
  }
});

// ─── POST /email/accounts ───────────────────────────────────────────────────
/**
 * POST /email/accounts
 * Link external Gmail/IMAP account
 */
router.post('/accounts', requireAuth, async (req, res) => {
  try {
    const { provider, email, credentials } = req.body;
    const userId = req.userId!;

    if (!provider || !['gmail', 'outlook', 'imap'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid or missing provider. Must be gmail, outlook, or imap' });
      return;
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Valid email address is required' });
      return;
    }

    if (!credentials || typeof credentials !== 'object') {
      return res.status(400).json({ error: 'Credentials are required' });
      return;
    }

    const accountId = await inboxService.addExternalAccount(userId, {
      provider,
      email,
      credentials
    });

    return res.json({ success: true, accountId });
  } catch (err: any) {
    console.error('[Email] Failed to link account:', err);
    return res.status(500).json({ error: 'Failed to link account', detail: err.message });
  }
});

// ─── PATCH /email/messages/:id ──────────────────────────────────────────────
/**
 * PATCH /email/messages/:id
 * Mark as read, move to trash, etc.
 */
router.patch('/messages/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead, folder } = req.body;
    const userId = req.userId!;

    // Verify ownership before modifying
    const msgDoc = await admin.firestore().collection('user_emails').doc(id).get();
    if (!msgDoc.exists) {
      return res.status(404).json({ error: 'Message not found' });
      return;
    }
    if (msgDoc.data()?.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (isRead !== undefined) await inboxService.markAsRead(id, isRead);
    if (folder) {
      const validFolders = ['inbox', 'sent', 'drafts', 'spam', 'trash'];
      if (!validFolders.includes(folder)) {
        return res.status(400).json({ error: `Invalid folder. Must be one of: ${validFolders.join(', ')}` });
        return;
      }
      await inboxService.moveToFolder(id, folder);
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Email] Update failed:', err);
    return res.status(500).json({ error: 'Update failed', detail: err.message });
  }
});

// ─── POST /email/sync ───────────────────────────────────────────────────────
/**
 * POST /email/sync
 * Trigger a background sync for the user
 */
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const result = await syncService.syncUser(userId);
    return res.json(result);
  } catch (err: any) {
    console.error('[Email] Sync failed:', err);
    return res.status(500).json({ error: 'Sync failed', detail: err.message });
  }
});

// ─── POST /email/claim ──────────────────────────────────────────────────────
/**
 * POST /email/claim
 * Claim a native @novaura.life handle
 */
router.post('/claim', requireAuth, async (req, res) => {
  try {
    const { handle } = req.body;
    const userId = req.userId!;

    if (!handle || !/^[a-zA-Z0-9._-]+$/.test(handle)) {
      return res.status(400).json({ error: 'Invalid handle format' });
    }

    const email = `${handle.toLowerCase()}@novaura.life`;

    // Check availability
    const exists = await admin.firestore().collection('user_mail_accounts')
      .where('email', '==', email)
      .get();

    if (!exists.empty) return res.status(409).json({ error: 'Handle already claimed' });

    // Claim it
    await admin.firestore().collection('user_mail_accounts').add({
      userId,
      email,
      provider: 'native',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isDefault: true
    });

    return res.json({ success: true, email });
  } catch (err: any) {
    console.error('[Email] Claim failed:', err);
    return res.status(500).json({ error: 'Claim failed', detail: err.message });
  }
});

// ─── GET /email/health ──────────────────────────────────────────────────────
/**
 * GET /email/health
 * SMTP transport health check
 */
router.get('/health', async (req, res) => {
  try {
    const healthy = await emailService.verifyTransport();
    return res.json({
      success: healthy,
      service: 'email',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(503).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
