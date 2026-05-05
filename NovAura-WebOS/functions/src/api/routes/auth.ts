import { Router } from 'express';
import * as admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

const SUPERUSERS = ['lostitonce420@gmail.com', 'dillan.copeland@novaura.xyz'];

// Get current user (from Firebase Auth token)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token' });
      return;
    }

    const token = authHeader.slice(7);
    const decoded = await admin.auth().verifyIdToken(token);
    
    // Get user profile from Firestore
    const profileDoc = await db.collection('social_profiles').doc(decoded.uid).get();
    const profile = profileDoc.exists ? profileDoc.data() : null;
    
    // Force catalyst tier for superusers
    const userTier = (decoded.email && SUPERUSERS.includes(decoded.email)) 
      ? 'catalyst' 
      : (profile?.tier || 'free');
    
    res.json({
      user: {
        id: decoded.uid,
        email: decoded.email,
        displayName: profile?.displayName || decoded.name || decoded.email?.split('@')[0],
        avatar: profile?.avatar || decoded.picture,
        tier: userTier
      }
    });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});


// Check username availability
router.get('/check-username', async (req, res) => {
  try {
    const username = (req.query.username || '').toString().trim().toLowerCase();
    if (!username) return res.status(400).json({ available: false, error: 'No username provided' });

    const snapshot = await db.collection('social_profiles').where('username', '==', username).limit(1).get();
    return res.json({ available: snapshot.empty });
  } catch (err) {
    console.error('Username check error:', err);
    return res.status(500).json({ available: false, error: 'Error verifying username' });
  }
});

// Create/update user profile after Firebase Auth signup
router.post('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token' });
      return;
    }

    const token = authHeader.slice(7);
    const decoded = await admin.auth().verifyIdToken(token);
    const { displayName, bio, avatar } = req.body;

    const userTier = (decoded.email && SUPERUSERS.includes(decoded.email)) ? 'catalyst' : 'free';

    await db.collection('social_profiles').doc(decoded.uid).set({
      id: decoded.uid,
      email: decoded.email,
      displayName: displayName || decoded.name || decoded.email?.split('@')[0],
      bio: bio || '',
      avatar: avatar || decoded.picture || '',
      tier: userTier,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({ success: true });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// Staff login - requires gate code and creates staff account
router.post('/staff-login', async (req, res) => {
  try {
    const { email, password, firstName, lastName, title, gateCode } = req.body;
    
    // Verify gate code
    if (gateCode !== '<catalyst>') {
      res.status(403).json({ error: 'Invalid access code' });
      return;
    }
    
    // Check if staff account exists
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch {
      // Create new Firebase Auth user
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: `${firstName} ${lastName}`,
        emailVerified: true
      });
    }
    
    // Determine staff tier based on title
    const ownerTitles = ['Founder / Owner', 'Co-Founder'];
    const adminTitles = ['Chief Operating Officer', 'General Manager', 'Platform Director', 'Head of Moderation'];
    
    let staffTier = 'staff';
    let permissions = ['moderate', 'support', 'view_analytics'];
    
    if (ownerTitles.includes(title)) {
      staffTier = 'owner';
      permissions = ['*']; // All permissions
    } else if (adminTitles.includes(title)) {
      staffTier = 'admin';
      permissions = ['*'];
    }
    
    // Create/update staff profile
    await db.collection('staff_profiles').doc(userRecord.uid).set({
      id: userRecord.uid,
      email,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      title,
      tier: staffTier,
      permissions,
      isStaff: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Set custom claims for staff
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      staff: true,
      tier: staffTier,
      permissions
    });
    
    // Create session token
    const token = await admin.auth().createCustomToken(userRecord.uid, {
      staff: true,
      tier: staffTier
    });
    
    res.json({
      success: true,
      token,
      user: {
        id: userRecord.uid,
        email,
        displayName: `${firstName} ${lastName}`,
        title,
        tier: staffTier,
        isStaff: true
      }
    });
  } catch (err: any) {
    console.error('Staff login error:', err);
    res.status(500).json({ error: 'Staff login failed', detail: err.message });
  }
});

// Verify staff status
router.get('/staff-verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token' });
      return;
    }
    
    const token = authHeader.slice(7);
    const decoded = await admin.auth().verifyIdToken(token);
    
    // Check custom claims
    const user = await admin.auth().getUser(decoded.uid);
    const isStaff = user.customClaims?.staff === true;
    
    if (!isStaff) {
      res.status(403).json({ error: 'Not a staff member' });
      return;
    }
    
    // Get staff profile
    const profileDoc = await db.collection('staff_profiles').doc(decoded.uid).get();
    const profile = profileDoc.exists ? profileDoc.data() : null;
    
    res.json({
      isStaff: true,
      tier: user.customClaims?.tier || 'staff',
      permissions: user.customClaims?.permissions || [],
      profile
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ESP Public Signup - Create @novaura.life account atomically
router.post('/esp-signup', async (req, res) => {
  try {
    const { handle, password, displayName, backupEmail } = req.body;

    if (!handle || !/^[a-zA-Z0-9._-]+$/.test(handle)) {
      return res.status(400).json({ error: 'Invalid handle format' });
    }

    const email = `${handle.toLowerCase()}@novaura.life`;

    // 1. Check availability in our mail accounts collection
    const exists = await db.collection('user_mail_accounts')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (!exists.empty) return res.status(409).json({ error: 'Handle already taken' });

    // 2. Create Firebase Auth User
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || handle,
    });

    // 3. Create Mail Account Record
    const mailAccountRef = await db.collection('user_mail_accounts').add({
      userId: userRecord.uid,
      email,
      provider: 'native',
      isDefault: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 4. Create Social Profile
    await db.collection('social_profiles').doc(userRecord.uid).set({
      id: userRecord.uid,
      email,
      username: handle.toLowerCase(),
      displayName: displayName || handle,
      backupEmail: backupEmail || null,
      tier: 'free',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 5. Ingest Welcome Email
    const { inboxService } = require('../../services/inboxService');
    await inboxService.addMessage(userRecord.uid, {
      accountId: mailAccountRef.id,
      from: { name: 'NovAura Systems', address: 'noreply@novaura.life' },
      to: [{ name: displayName || handle, address: email }],
      subject: 'Welcome to the Frontier',
      snippet: 'Welcome to your sovereign @novaura.life email account.',
      body: `Welcome to NovAura, ${displayName || handle}!\n\nYour sovereign identity is now established at ${email}. This address is yours to keep—private, encrypted, and ad-free.\n\nExplore the WebOS, connect your existing accounts, and begin searching the future.\n\n— The NovAura Catalyst Team`,
      receivedAt: new Date(),
      isRead: false,
      folder: 'inbox',
      provider: 'native'
    });

    return res.json({ 
      success: true, 
      uid: userRecord.uid,
      email: email,
      message: 'Sovereign identity established' 
    });
  } catch (err: any) {
    console.error('[ESP Signup] Error:', err);
    return res.status(500).json({ error: 'Signup failed', detail: err.message });
  }
});

export default router;
