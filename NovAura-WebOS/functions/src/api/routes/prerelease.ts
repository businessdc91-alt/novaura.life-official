import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { sendPrereleaseNotification } from '../../services/emailService';

const router = Router();

/**
 * POST /prerelease/signup
 * Handle pre-release waitlist signups
 */
router.post('/signup', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const db = admin.firestore();
    
    // Save to Firestore waitlist
    await db.collection('prerelease_waitlist').doc(email).set({
      email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: 'landing_page'
    }, { merge: true });

    // Send notification to Dillan (Owner)
    try {
      await sendPrereleaseNotification(email);
    } catch (emailErr) {
      console.warn('[Prerelease] Notification failed to send but data was saved:', emailErr);
    }

    return res.json({ success: true, message: 'Signed up successfully' });
  } catch (error: any) {
    console.error('Prerelease signup error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
