import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isGarbage, cleanSentence, textToSentences } from '../js/core/text.js';

test('real sentences pass, including very short ones and one-letter words', () => {
  for (const [s, l] of [['Ja.', 'de'], ['Hallo!', 'de'], ['Ik heet Sanne.', 'nl'], ["Wie geht's?", 'de'], ['I am OK.', 'en'],
    ['Il y a un chat.', 'fr'], ['Idę z mamą w parku.', 'pl'], ['Я и ты.', 'ru'], ['Nee.', 'nl'], ['Guten Morgen, Herr Becker!', 'de'],
    ['毎日練習します。', 'ja']]) assert.equal(isGarbage(s, l), false, s);
});

test('OCR noise is rejected', () => {
  for (const s of ['a b c', 'b', 'I l |', '| 1 l', '12 34 / 5', 'e e e e', 'rn m n', 'Lktn hkvz', '___ ...', 'x.', 'a) b) c)'])
    assert.equal(isGarbage(s, 'de'), true, s);
});

test('list markers are stripped from the start', () => {
  assert.equal(cleanSentence('a) Ich heiße Anna.', 'de'), 'Ich heiße Anna.');
  assert.equal(cleanSentence('3. Das ist Maria.', 'de'), 'Das ist Maria.');
  assert.equal(cleanSentence('• Wie geht es dir?', 'de'), 'Wie geht es dir?');
  assert.equal(cleanSentence('A Hallo, ich bin Anna.', 'de'), 'A Hallo, ich bin Anna.'); // not a marker without ) or .
});

test('a noisy OCR page keeps only the real sentences', () => {
  const page = 'Ich wohne in Berlin. a b c\n\nDas ist mein Bruder. Er heißt Max.\n\nl | I\n\nWie alt bist du? x';
  assert.deepEqual(textToSentences(page, 'de'), ['Ich wohne in Berlin.', 'Das ist mein Bruder.', 'Er heißt Max.', 'Wie alt bist du?']);
});
