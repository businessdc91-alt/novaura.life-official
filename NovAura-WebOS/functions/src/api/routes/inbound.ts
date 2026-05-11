import { Router } from 'express';
import * as admin from 'firebase-admin';
import { inboxService } from '../../services/inboxService';

const router = Router();
const db = admin.firestore();

/**
 * Inbound Email Webhook Handler
 * Currently supports: Unified Webhook Payloads / Resend Webhooks
 */
router.post('/email', async (req, res) => {
  console.log('[Inbound] Received incoming email payload');
  
  try {
    // 1. Normalize payload based on provider
    const body = req.body;
    let to: string = body.to || '';
    let from: string = body.from || '';
    let subject: string = body.subject || '(No Subject)';
    let text: string = body.text || '';
    let html: string = body.html || '';

    // 2. Identify the target @novaura.life user
    // Format is usually "User Name <handle@novaura.life>" or just "handle@novaura.life"
    const handleMatch = to.match(/[a-zA-Z0-9._%+-]+@novaura\.life/);
    if (!handleMatch) {
      console.warn('[Inbound] Could not identify native recipient handle:', to);
      return res.status(200).send('Ignored: Not a native handle');
    }

    const recipientHandle = handleMatch[0].toLowerCase();
    
    // 3. Find the user associated with this handle in Firestore
    // We look for a user where user_mail_accounts has this handle as a 'native' provider
    const userSnapshot = await db.collection('user_mail_accounts')
      .where('email', '==', recipientHandle)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      console.warn('[Inbound] Handle not claimed by any user:', recipientHandle);
      // We return 200 to acknowledge receipt even if no user exists, to prevent retries
      return res.status(200).send('Ignored: Handle not claimed');
    }

    const accountData = userSnapshot.docs[0].data();
    const userId = accountData.userId;

    // 4. Ingest into the Unified Inbox
    await inboxService.addMessage(userId, {
      accountId: userSnapshot.docs[0].id,
      from: {
        name: from.includes('<') ? from.split('<')[0].trim() : from.split('@')[0],
        address: from.includes('<') ? from.match(/<([^>]+)>/)?.[1] || from : from
      },
      to: [{ name: '', address: recipientHandle }],
      subject,
      snippet: text.slice(0, 100),
      body: text,
      html,
      receivedAt: new Date(),
      isRead: false,
      folder: 'inbox',
      provider: 'native'
    });

    console.log(`[Inbound] Successfully routed mail to ${recipientHandle} (User: ${userId})`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Inbound] Error processing mail:', err);
    // Return 200 because we don't want the sender to retry endlessly on logic errors
    return res.status(200).send('Error processed');
  }
});

export default router;
