import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readId3Txxx, id3Size, timelineToBook, langIdFromName } from '../js/core/timeline.js';

const fx = f => new URL('./fixtures/' + f, import.meta.url);
const buf = f => { const b = readFileSync(fx(f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

test('language names from the generator map to catalog ids', () => {
  assert.equal(langIdFromName('dutch'), 'nl');
  assert.equal(langIdFromName('persian'), 'fa');
  assert.equal(langIdFromName('nl-NL'), 'nl');
  assert.equal(langIdFromName('German'), 'de');
});

test('reads the embedded timeline from an MP3 (ID3v2.4, UTF-8)', () => {
  const b = buf('les_1.mp3');
  assert.ok(id3Size(b) > 10);
  const tl = JSON.parse(readId3Txxx(b));
  assert.deepEqual(tl, JSON.parse(readFileSync(fx('les_1.json'), 'utf8')));
});

test('reads ID3v2.3 with UTF-16 text too', () => {
  const tl = JSON.parse(readId3Txxx(buf('les_1_id3v23.mp3')));
  assert.equal(tl.segments[2].text, 'اسم من سانه است.');
});

test('no tag → null', () => {
  assert.equal(readId3Txxx(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).buffer), null);
});

test('timeline → audio book: Dutch sentences, repeats removed, Persian as translation', () => {
  const tl = JSON.parse(readFileSync(fx('les_1.json'), 'utf8'));
  const b = timelineToBook(tl);
  assert.equal(b.lang, 'nl');
  assert.equal(b.title, 'les 1');
  assert.deepEqual(b.sentences, ['Ik heet Sanne.', 'Ik woon in Utrecht.', 'Ik drink graag koffie.']);
  assert.deepEqual(b.clips[0], [0, 1.2]);
  assert.equal(b.translations[1], 'من در اوترخت زندگی می‌کنم.');
});

test('the learning language can be chosen when a lesson has several', () => {
  const tl = { segments: [
    { start: 0, speech_end: 1, row: 1, tag: 'a', lang: 'english', text: 'I remember.' },
    { start: 2, speech_end: 3, row: 1, tag: 'b', lang: 'german', text: 'Ich erinnere mich.' } ] };
  assert.equal(timelineToBook(tl, 'de').sentences[0], 'Ich erinnere mich.');
  assert.equal(timelineToBook(tl, 'de').translations[0], 'I remember.');
});
