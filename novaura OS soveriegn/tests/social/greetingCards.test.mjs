// Greeting cards from the mesh, the HTML export, and the website templates' scripts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanGreetingCard, generateStandaloneCardHtml, CARD_OCCASIONS } from '../../src/services/greetingCardService.js';
import { MULTIPAGE_TEMPLATES } from '../../src/services/templates/websiteTemplates.js';

const base = { id: 'card_abc123', occasion: 'birthday', themeId: 'cyber_neon', particleEffect: 'fireworks', audioMelody: 'chimes', coverEmoji: '🎂', title: 'Happy Birthday!', message: 'Hi', recipientName: 'Sarah', senderName: 'dillan', timestamp: '2026-11-03T20:00:00.000Z' };

test('a card from a peer keeps only known fields and bounded text', () => {
  const c = cleanGreetingCard({ ...base, extra: 'x'.repeat(10_000), senderDid: 'did:nova:spoofed', themeId: 'cyber_neon' });
  assert.equal(c.id, 'card_abc123');
  assert.equal('extra' in c, false);
  assert.equal('senderDid' in c, false); // the signer comes from the packet, never the payload
  assert.equal(c.themeId, 'cyber_neon');
  assert.equal(c.occasionLabel, CARD_OCCASIONS.find(o => o.id === 'birthday').label);
  assert.equal(cleanGreetingCard({ ...base, message: 'm'.repeat(5000) }).message.length, 2000);
  assert.equal(cleanGreetingCard({ ...base, senderName: 'n'.repeat(500) }).senderName.length, 40);
  assert.equal(cleanGreetingCard({ ...base, message: 'a\u0000b\u0007c\nd' }).message, 'abc\nd');
});

test('unknown themes, effects and melodies fall back; bad ids are refused', () => {
  const c = cleanGreetingCard({ ...base, themeId: '__proto__', particleEffect: 'nuke', audioMelody: 'siren', occasion: 'x' });
  assert.equal(c.themeId, 'gold_luxury');
  assert.equal(c.particleEffect, 'confetti');
  assert.equal(c.audioMelody, 'mute');
  assert.equal(c.occasion, 'birthday');
  assert.equal(cleanGreetingCard({ ...base, id: '<img>' }), null);
  assert.equal(cleanGreetingCard({ ...base, id: undefined }), null);
  assert.equal(cleanGreetingCard('card'), null);
});

test('the exported card escapes everything a person typed', () => {
  const html = generateStandaloneCardHtml({ ...base, title: '</title><script>alert(1)</script>', message: '<img src=x onerror=alert(2)>', recipientName: '"Sam"', senderName: "o'neil" });
  assert.equal(html.includes('<script>alert(1)'), false);
  assert.equal(html.includes('<img src=x'), false);
  assert.ok(html.includes('&lt;/title&gt;&lt;script&gt;'));
  assert.ok(html.includes('&quot;Sam&quot;'));
  assert.ok(html.includes('o&#39;neil'));
  assert.equal(html.includes('ED25519 VERIFIED'), false);
  assert.equal((html.match(/<script>/g) || []).length, 1); // only the card's own animation script
});

test('every website template script parses, and none claims a form was delivered', () => {
  assert.equal(MULTIPAGE_TEMPLATES.length, 7);
  for (const t of MULTIPAGE_TEMPLATES) {
    assert.doesNotThrow(() => new Function(t.js), t.id);
    assert.doesNotMatch(t.js, /dispatched|broadcast across|cryptographically signed/i, t.id);
  }
  // Typed text is escaped where the blog, forum and chat insert it as HTML.
  for (const id of ['blog', 'forum', 'chatroom']) {
    const t = MULTIPAGE_TEMPLATES.find(x => x.id === id);
    assert.match(t.js, /function esc\(s\)/, id);
    assert.doesNotMatch(t.js, /' \+ (text|author) \+ '/, id);
  }
});
