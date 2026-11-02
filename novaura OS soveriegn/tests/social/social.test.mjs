// NovaSocial trust rules: signed items, recomputed vote totals, caps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ed25519 } from '@noble/curves/ed25519.js';
import {
  signPost, admitPost, signComment, admitComment, insertComment, signVote, admitVote, applyVote,
  admitVoteMap, signStory, admitStory, cleanMediaUrl, overflowIds, packetBatches, SOCIAL_LIMITS,
} from '../../src/services/meshSocial.js';

const hex = (b) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
function node() {
  const secret = ed25519.utils.randomSecretKey();
  return { secretHex: hex(secret), authorDid: `did:nova:${hex(ed25519.getPublicKey(secret))}` };
}
const alice = node();
const bob = node();

test('a signed post is admitted; any edit or a wrong author is rejected', () => {
  const post = signPost({ title: 'Hello', content: 'First post', type: 'wall' }, alice);
  assert.ok(admitPost(post));
  assert.equal(admitPost({ ...post, content: 'edited' }), null);
  assert.equal(admitPost({ ...post, authorName: 'Someone Else' }), null);
  assert.equal(admitPost({ ...post, authorDid: bob.authorDid }), null, 'id is bound to the author');
  const forged = signPost({ content: 'x', id: post.id }, bob);
  assert.equal(admitPost(forged), null, 'bob cannot reuse alice\'s id');
});

test('fields are clipped and unsafe media dropped', () => {
  const post = signPost({ content: 'x'.repeat(20000), mediaGallery: ['file:///C:/secret.png', 'javascript:alert(1)', 'https://example.com/a.png', 'http://plain.example/b.png'] }, alice);
  const ok = admitPost(post);
  assert.equal(ok.content.length, SOCIAL_LIMITS.content);
  assert.deepEqual(ok.mediaGallery, ['https://example.com/a.png']);
  assert.equal(cleanMediaUrl('data:image/png;base64,' + 'A'.repeat(100)), 'data:image/png;base64,' + 'A'.repeat(100));
  assert.equal(cleanMediaUrl('data:image/png;base64,' + 'A'.repeat(SOCIAL_LIMITS.inlineImageChars)), null);
});

test('a repost keeps the original only when its own signature is valid', () => {
  const original = signPost({ content: 'Original words' }, alice);
  const repost = signPost({ content: 'Look at this', repostOf: original }, bob);
  assert.equal(admitPost(repost).repostOf.content, 'Original words');
  const fake = signPost({ content: 'Look', repostOf: { ...original, content: 'Words alice never wrote' } }, bob);
  assert.equal(admitPost(fake).repostOf, null);
});

test('vote totals come only from signed per-voter records', () => {
  const post = admitPost(signPost({ content: 'vote me' }, alice));
  assert.ok(applyVote(post, admitVote(signVote({ target: post.id, value: 'up' }, { voterDid: alice.authorDid, secretHex: alice.secretHex }))));
  assert.ok(applyVote(post, admitVote(signVote({ target: post.id, value: 'down' }, { voterDid: bob.authorDid, secretHex: bob.secretHex }))));
  assert.equal(post.upvotes, 1);
  assert.equal(post.downvotes, 1);
  // A forged record in bob's name is rejected; a stale one is ignored.
  const forged = signVote({ target: post.id, value: 'up' }, { voterDid: bob.authorDid, secretHex: alice.secretHex });
  assert.equal(admitVote(forged), null);
  const reaction = signVote({ target: post.id, value: 'fire', kind: 'reaction' }, { voterDid: bob.authorDid, secretHex: bob.secretHex });
  applyVote(post, admitVote(reaction));
  assert.equal(post.reactions.fire, 1);
  assert.equal(post.reactionUsers[bob.authorDid], 'fire');
  // Relayed vote maps are re-verified per entry.
  const map = { ...post.voteSigs, [bob.authorDid]: { ...post.voteSigs[bob.authorDid], value: 'up' } };
  const kept = admitVoteMap(map, 'vote', post.id);
  assert.ok(kept[alice.authorDid]);
  assert.equal(kept[bob.authorDid], undefined, 'tampered entry dropped');
});

test('comments nest under their parent and are capped', () => {
  const post = admitPost(signPost({ content: 'thread' }, alice));
  const top = admitComment(signComment({ postId: post.id, content: 'top' }, bob));
  const reply = admitComment(signComment({ postId: post.id, parentId: top.id, content: 'reply' }, alice));
  assert.ok(insertComment(post, top));
  assert.ok(insertComment(post, reply));
  assert.equal(post.comments.length, 1);
  assert.equal(post.comments[0].replies[0].content, 'reply');
  assert.equal(insertComment(post, reply), false, 'no duplicates');
  assert.equal(admitComment({ ...reply, content: 'changed' }), null);
});

test('stories cannot outlive 24 hours', () => {
  const story = signStory({ caption: 'hi' }, alice);
  assert.ok(admitStory(story));
  const now = Date.now();
  const forever = signStory({ caption: 'forever' }, { ...alice, now });
  const tampered = { ...forever, expiresAt: new Date(now + 400 * 24 * 3600000).toISOString() };
  assert.equal(admitStory(tampered), null);
  assert.equal(admitStory(signStory({ caption: 'old' }, { ...alice, now: now - 25 * 3600000 })), null, 'expired');
});

test('caps per author and packet batches', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, authorDid: i < 7 ? 'a' : 'b', timestamp: `2026-01-0${i}` }));
  const drop = overflowIds(items, { perAuthor: 5, total: 6 });
  // Author a keeps its 5 newest (p0, p1 go); then the oldest of the rest go until 6 remain (p2, p3).
  assert.deepEqual([...drop].sort(), ['p0', 'p1', 'p2', 'p3']);
  const batches = packetBatches(Array.from({ length: 5 }, () => ({ x: 'y'.repeat(20000) })), 50000);
  assert.deepEqual(batches.map(b => b.length), [2, 2, 1]);
});
