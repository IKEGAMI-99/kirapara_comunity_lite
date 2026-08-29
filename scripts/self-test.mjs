import assert from 'node:assert/strict';
import { parseApiJson } from './lib/kirapara-client.mjs';
import { normalizeMoment } from './lib/normalize.mjs';

const raw = JSON.stringify({
  retcode: 0,
  momentList: [{
    momentId: 1542521140856094720n,
  }],
}, (_, value) => typeof value === 'bigint' ? value.toString() : value)
  // Simulate the game API, which emits 64-bit IDs as bare JSON numbers.
  .replace('"1542521140856094720"', '1542521140856094720');

const parsed = parseApiJson(raw);
assert.equal(parsed.momentList[0].momentId, '1542521140856094720');

const normalized = normalizeMoment({
  momentId: parsed.momentList[0].momentId,
  roleId: '1937405234',
  serverId: '30002',
  roleName: 'Test User',
  photoId: '0|http://example.invalid/avatar.png|http://example.invalid/avatar.png',
  title: 'Test title',
  content: 'Test content',
  pic1: 'http://example.invalid/image.png',
  createTime: 1787807299000,
  voteSize: 4,
  totalReplySize: 2,
  collectionSize: 1,
  labelList: '2,1',
});

assert.equal(normalized.momentId, '1542521140856094720');
assert.equal(normalized.author.avatarUrl, 'https://example.invalid/avatar.png');
assert.deepEqual(normalized.images, ['https://example.invalid/image.png']);
assert.deepEqual(normalized.labels, ['2', '1']);
assert.deepEqual(normalized.stats, { votes: 4, replies: 2, collections: 1 });

console.log('Self-test passed.');
