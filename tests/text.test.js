import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wc, normalize, textToSentences, chunkSentence, heuristicPick, linesToText } from '../js/core/text.js';

test('word count: spaces, and characters for Japanese/Chinese', () => {
  assert.equal(wc('Ich heiße Lena.', 'de'), 3);
  assert.equal(wc('毎日日本語を練習します', 'ja'), 6);
});

test('normalize drops page numbers and headings, joins hyphenation', () => {
  const paras = normalize('Lektion 1\n\nIch wohne in Ham-\nburg und arbeite dort.\n\n12\n', 'de');
  assert.deepEqual(paras, ['Ich wohne in Hamburg und arbeite dort.']);
});

test('sentence splitting', () => {
  assert.deepEqual(textToSentences('Hallo! Wie heißt du? Ich heiße Ben.', 'de'), ['Hallo!', 'Wie heißt du?', 'Ich heiße Ben.']);
});

test('short sentences are not chunked', () => {
  assert.deepEqual(chunkSentence('Ik heet Sanne.', 8, 'nl'), ['Ik heet Sanne.']);
});

test('long sentences split at punctuation/conjunctions and respect the limit', () => {
  const s = 'Researchers who study learning often point out that the brain strengthens the connections it uses most frequently, and that repetition is how skills become automatic.';
  const chunks = chunkSentence(s, 8, 'en');
  assert.ok(chunks.length >= 3);
  for (const c of chunks) assert.ok(wc(c, 'en') <= 10, c);
  assert.equal(chunks.join(' '), s);
});

test('Dutch conjunction splitting', () => {
  const chunks = chunkSentence('Ik drink elke ochtend koffie met melk omdat ik anders echt niet wakker word op mijn werk', 8, 'nl');
  assert.ok(chunks.some(c => c.startsWith('omdat')));
});

test('heuristic keeps dialogue and reading text, drops exercises and word lists', () => {
  const lesson = `Lektion 1: Hallo!

1 Hören Sie und lesen Sie.
Anna: Hallo, ich bin Anna. Wie heißt du?
Ben: Ich heiße Ben.

2 Ergänzen Sie.
a) Ich ____ Anna.

Wörter: heißen, kommen, wohnen

3 Lesen Sie den Text.
Das ist Maria. Sie wohnt in München.`;
  const [item] = heuristicPick(lesson, 'de');
  assert.match(item.text, /Hallo, ich bin Anna\./);
  assert.match(item.text, /Das ist Maria\./);
  assert.doesNotMatch(item.text, /Hören|Ergänzen|____|heißen, kommen/);
  assert.doesNotMatch(item.text, /Anna:/);
});

test('picked lines become sentences', () => {
  assert.equal(linesToText(['Guten Morgen\nWie geht es Ihnen?']), 'Guten Morgen.\n\nWie geht es Ihnen?');
});
