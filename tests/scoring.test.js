import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSpeech, fold, lev } from '../js/core/scoring.js';

test('levenshtein', () => { assert.equal(lev('kitten', 'sitting'), 3); });
test('fold: case, punctuation, digits, ß', () => {
  assert.equal(fold('Straße,', 'de'), 'strasse');
  assert.equal(fold('7', 'de'), 'sieben');
  assert.equal(fold('7', 'nl'), 'zeven');
});
test('perfect answer', () => {
  assert.deepEqual(scoreSpeech('Ich heiße Lena.', 'ich heiße lena', 'de'), { marks: ['ok', 'ok', 'ok'], score: 100 });
});
test('missing word is bad, digits count as words', () => {
  const r = scoreSpeech('Am Morgen stehe ich um sieben Uhr auf.', 'am morgen stehe ich um 7 auf', 'de');
  assert.deepEqual(r.marks, ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'bad', 'ok']);
});
test('near miss is close', () => {
  const r = scoreSpeech('Ich bin dreißig Jahre alt.', 'ich bin dreizig jahre', 'de');
  assert.equal(r.marks[2], 'close'); assert.equal(r.marks[4], 'bad');
});
test('extra filler words cost little', () => {
  assert.ok(scoreSpeech('Ik heet Sanne.', 'eh ik heet sanne', 'nl').score >= 90);
});
test('Japanese is compared per character', () => {
  const r = scoreSpeech('毎日練習します。', '毎日練習します', 'ja');
  assert.equal(r.score, 100); assert.equal(r.marks.length, 7);
});
