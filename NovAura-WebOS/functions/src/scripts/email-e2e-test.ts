/**
 * NovAura Email Service — End-to-End Test Script
 * 
 * Run with: npx ts-node src/scripts/email-e2e-test.ts
 * 
 * Prerequisites:
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars set
 * - Or rely on defaults (SMTP_HOST)
 */

import { emailService } from '../services/emailService';

const TEST_RECIPIENT = process.env.TEST_EMAIL || 'business.dc91@gmail.com';

async function runE2ETest() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     NovAura Email Service — End-to-End Validation            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Transport Health Check
  console.log('[1/4] Verifying SMTP transport...');
  const healthy = await emailService.verifyTransport();
  if (!healthy) {
    console.error('❌ Transport verification FAILED');
    console.error('    Check your SMTP credentials in environment variables.');
    process.exit(1);
  }
  console.log('✅ Transport is healthy\n');

  // 2. Send Test Email
  console.log('[2/4] Sending test email...');
  const testResult = await emailService.sendEmail({
    to: TEST_RECIPIENT,
    subject: 'NovAura SMTP E2E Test',
    text: 'If you receive this, your NovAura email routing is fully operational.',
    category: 'alert',
  });

  if (!testResult.success) {
    console.error('❌ Test email FAILED:', testResult.error);
    process.exit(1);
  }
  console.log('✅ Test email sent. Message ID:', testResult.messageId, '\n');

  // 3. Send Welcome Template
  console.log('[3/4] Sending welcome template...');
  try {
    await emailService.sendWelcomeEmail(TEST_RECIPIENT, 'Frontier Pioneer');
    console.log('✅ Welcome email sent\n');
  } catch (err: any) {
    console.error('❌ Welcome email FAILED:', err.message);
    process.exit(1);
  }

  // 4. Send Swarm Update Template
  console.log('[4/4] Sending swarm update template...');
  try {
    await emailService.sendSwarmUpdateEmail(
      TEST_RECIPIENT,
      'NovAura Platform',
      'All systems operational. Email service validated successfully.'
    );
    console.log('✅ Swarm update email sent\n');
  } catch (err: any) {
    console.error('❌ Swarm update FAILED:', err.message);
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     🎉 ALL END-TO-END TESTS PASSED                           ║');
  console.log('║     Your email service is production-ready.                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

runE2ETest().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
