import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePartial } from '../js/core/scoring.js';

test('live progress follows the learner through the sentence', () => {
  const t = 'Am Morgen stehe ich um sieben Uhr auf.';
  assert.deepEqual(scorePartial(t, '', 'de').pos, 0);
  const a = scorePartial(t, 'am morgen', 'de');
  assert.equal(a.pos, 2); assert.deepEqual(a.marks.slice(0, 3), ['ok', 'ok', 'pending']);
  const b = scorePartial(t, 'am morgen stehe ich', 'de');
  assert.equal(b.pos, 4); assert.equal(b.marks[4], 'pending');
  const c = scorePartial(t, 'am morgen steh ich um', 'de');
  assert.equal(c.marks[2], 'close'); assert.equal(c.pos, 5);
});
