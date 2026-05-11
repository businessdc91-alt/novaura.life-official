import { EmailService } from './emailService';
import { secretService } from './secretService';

// Mock dependencies
jest.mock('./secretService');
jest.mock('firebase-admin', () => ({
  firestore: () => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
  }),
}));

const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail,
  verify: mockVerify,
}));

jest.mock('nodemailer', () => ({
  createTransport: mockCreateTransport,
}));

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (EmailService as any).instance = null;
    emailService = EmailService.getInstance();
  });

  describe('verifyTransport', () => {
    it('should return true when transport is healthy', async () => {
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('smtp.novaura.life');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('587');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('apikey');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('secret');
      mockVerify.mockResolvedValue(true);

      const result = await emailService.verifyTransport();
      expect(result).toBe(true);
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.novaura.life',
          port: 587,
          secure: false,
          auth: { user: 'apikey', pass: 'secret' },
        })
      );
    });

    it('should return false and clear transport when verification fails', async () => {
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('smtp.novaura.life');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('587');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('apikey');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('secret');
      mockVerify.mockRejectedValue(new Error('Connection refused'));

      const result = await emailService.verifyTransport();
      expect(result).toBe(false);
    });
  });

  describe('sendEmail', () => {
    beforeEach(() => {
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('smtp.novaura.life');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('587');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('apikey');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('secret');
    });

    it('should send email via platform transport when no userId provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<test-id>' });

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<test-id>');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"NovAura Platform" <no-reply@novaura.life>',
          to: 'test@example.com',
          subject: 'Test',
          text: 'Hello',
        })
      );
    });

    it('should retry on transient errors and eventually succeed', async () => {
      mockSendMail
        .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'Connection reset' })
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Timeout' })
        .mockResolvedValueOnce({ messageId: '<retry-success>' });

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
      });

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(3);
    });

    it('should fail immediately on non-transient errors', async () => {
      mockSendMail.mockRejectedValue(new Error('Permanent failure'));

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permanent failure');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('should include category header in email', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<id>' });

      await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
        category: 'transactional',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-NovAura-Category': 'transactional',
          }),
        })
      );
    });
  });

  describe('specialized emails', () => {
    beforeEach(() => {
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('smtp.novaura.life');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('587');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('apikey');
      (secretService.getSecret as jest.Mock).mockResolvedValueOnce('secret');
      mockSendMail.mockResolvedValue({ messageId: '<id>' });
    });

    it('should send welcome email', async () => {
      await emailService.sendWelcomeEmail('user@example.com', 'John');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Welcome to the Frontier, John!',
        })
      );
    });

    it('should send password reset email', async () => {
      await emailService.sendPasswordResetEmail('user@example.com', 'John', 'https://reset.link');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Reset your NovAura Access',
        })
      );
    });

    it('should send swarm update email', async () => {
      await emailService.sendSwarmUpdateEmail('user@example.com', 'NovaIDE', 'Build complete');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: '[Swarm Update] NovaIDE',
          headers: expect.objectContaining({
            'X-NovAura-Category': 'swarm',
          }),
        })
      );
    });

    it('should send test email and throw on failure', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: '<id>' });
      await expect(emailService.sendTestEmail('test@example.com')).resolves.not.toThrow();

      mockSendMail.mockRejectedValueOnce(new Error('SMTP failure'));
      await expect(emailService.sendTestEmail('test@example.com')).rejects.toThrow();
    });

    it('should send prerelease notification to owner', async () => {
      await emailService.sendPrereleaseNotification('new@user.com');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'Dillan.Copeland@novaura.xyz',
          subject: 'New Frontier Signup: new@user.com',
        })
      );
    });
  });
});
