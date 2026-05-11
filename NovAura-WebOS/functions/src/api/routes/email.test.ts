import request from 'supertest';
import express from 'express';
import emailRoutes from './email';

// Mock firebase-admin
const mockVerifyIdToken = jest.fn();
const mockFirestoreCollection = jest.fn();
const mockFirestoreWhere = jest.fn().mockReturnThis();
const mockFirestoreLimit = jest.fn().mockReturnThis();
const mockFirestoreGet = jest.fn();
const mockFirestoreAdd = jest.fn();
const mockFirestoreDoc = jest.fn().mockReturnThis();
const mockFirestoreUpdate = jest.fn();

jest.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: mockVerifyIdToken,
  }),
  firestore: Object.assign(
    () => ({
      collection: mockFirestoreCollection.mockReturnValue({
        where: mockFirestoreWhere,
        limit: mockFirestoreLimit,
        get: mockFirestoreGet,
        add: mockFirestoreAdd,
        doc: mockFirestoreDoc,
      }),
      doc: mockFirestoreDoc.mockReturnValue({
        get: mockFirestoreGet,
        update: mockFirestoreUpdate,
      }),
    }),
    { FieldValue: { serverTimestamp: jest.fn(() => new Date().toISOString()) } }
  ),
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
}));

// Mock services
jest.mock('../../services/emailService', () => ({
  emailService: {
    sendEmail: jest.fn(),
    verifyTransport: jest.fn(),
  },
}));

jest.mock('../../services/inboxService', () => ({
  inboxService: {
    getInbox: jest.fn().mockResolvedValue([]),
    addMessage: jest.fn().mockResolvedValue('msg-id'),
    addExternalAccount: jest.fn().mockResolvedValue('acc-id'),
    markAsRead: jest.fn().mockResolvedValue(undefined),
    moveToFolder: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/syncService', () => ({
  syncService: {
    syncUser: jest.fn().mockResolvedValue({ success: true }),
  },
}));

import { emailService } from '../../services/emailService';
import { inboxService } from '../../services/inboxService';

const mockEmailService = emailService as jest.Mocked<typeof emailService>;
const mockInboxService = inboxService as jest.Mocked<typeof inboxService>;

describe('Email Routes', () => {
  let app: express.Application;
  const validToken = 'valid-token';
  const userId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/email', emailRoutes);

    mockVerifyIdToken.mockResolvedValue({ uid: userId, email: 'test@example.com' });
    mockFirestoreGet.mockResolvedValue({ empty: true, docs: [] });
    mockFirestoreAdd.mockResolvedValue({ id: 'new-doc-id' });
  });

  describe('GET /email/accounts', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/email/accounts');
      expect(res.status).toBe(401);
    });

    it('should fetch user accounts', async () => {
      mockFirestoreGet.mockResolvedValue({
        empty: false,
        docs: [{ id: 'acc-1', data: () => ({ email: 'test@novaura.life', provider: 'native' }) }],
      });

      const res = await request(app)
        .get('/email/accounts')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accounts).toHaveLength(1);
    });
  });

  describe('GET /email/inbox', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/email/inbox');
      expect(res.status).toBe(401);
    });

    it('should fetch inbox with folder filter', async () => {
      mockInboxService.getInbox.mockResolvedValue([
        { id: '1', subject: 'Test', folder: 'inbox', userId: 'u1', accountId: 'a1', from: { name: 'A', address: 'a@b.com' }, to: ['a@b.com'], snippet: 's', body: 'b', receivedAt: new Date(), isRead: true, hasAttachments: false } as any,
      ]);

      const res = await request(app)
        .get('/email/inbox?folder=inbox&limit=10')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockInboxService.getInbox).toHaveBeenCalledWith(userId, 10, 'inbox', 'all');
    });
  });

  describe('POST /email/send', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).post('/email/send').send({
        to: 'test@example.com',
        subject: 'Hello',
        body: 'World',
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app)
        .post('/email/send')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          to: 'not-an-email',
          subject: 'Hello',
          body: 'World',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid email address');
    });

    it('should return 400 for empty subject', async () => {
      const res = await request(app)
        .post('/email/send')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          to: 'test@example.com',
          subject: '',
          body: 'World',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Subject');
    });

    it('should send email and save to sent folder', async () => {
      mockEmailService.sendEmail.mockResolvedValue({ success: true, messageId: '<msg-id>' });

      const res = await request(app)
        .post('/email/send')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          to: 'test@example.com',
          subject: 'Hello',
          body: 'World',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Hello',
          text: 'World',
          userId,
          category: 'transactional',
        })
      );
      expect(mockInboxService.addMessage).toHaveBeenCalled();
    });

    it('should return 429 when rate limit exceeded', async () => {
      // Send many requests to exhaust the free tier limit (5/hour)
      mockEmailService.sendEmail.mockResolvedValue({ success: true, messageId: '<id>' });

      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/email/send')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ to: 'a@b.com', subject: 'T', body: 'B' });
      }

      const res = await request(app)
        .post('/email/send')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ to: 'a@b.com', subject: 'T', body: 'B' });

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Rate limit exceeded');
    });
  });

  describe('POST /email/accounts', () => {
    it('should validate provider', async () => {
      const res = await request(app)
        .post('/email/accounts')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ provider: 'invalid', email: 'test@gmail.com', credentials: {} });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid or missing provider');
    });

    it('should validate email format', async () => {
      const res = await request(app)
        .post('/email/accounts')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ provider: 'gmail', email: 'not-an-email', credentials: {} });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Valid email address');
    });

    it('should link external account', async () => {
      const res = await request(app)
        .post('/email/accounts')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          provider: 'gmail',
          email: 'test@gmail.com',
          credentials: { pass: 'app-password' },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockInboxService.addExternalAccount).toHaveBeenCalled();
    });
  });

  describe('POST /email/claim', () => {
    it('should validate handle format', async () => {
      const res = await request(app)
        .post('/email/claim')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ handle: 'invalid handle!' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid handle format');
    });

    it('should return 409 if handle already claimed', async () => {
      mockFirestoreGet.mockResolvedValue({
        empty: false,
        docs: [{ data: () => ({}) }],
      });

      const res = await request(app)
        .post('/email/claim')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ handle: 'taken' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already claimed');
    });

    it('should claim handle successfully', async () => {
      mockFirestoreGet.mockResolvedValue({ empty: true, docs: [] });

      const res = await request(app)
        .post('/email/claim')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ handle: 'newuser' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.email).toBe('newuser@novaura.life');
    });
  });

  describe('GET /email/health', () => {
    it('should return 200 when transport is healthy', async () => {
      mockEmailService.verifyTransport.mockResolvedValue(true);

      const res = await request(app).get('/email/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 503 when transport is unhealthy', async () => {
      mockEmailService.verifyTransport.mockRejectedValue(new Error('SMTP down'));

      const res = await request(app).get('/email/health');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
    });
  });
});
