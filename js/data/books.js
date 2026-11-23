// Book texts (arrays of sentences) in IndexedDB, with an in-memory cache and fallback.
import { SAMPLES } from '../core/languages.js';
import { textToSentences, cleanSentence, isGarbage } from '../core/text.js';
import { S, save } from './store.js';

const DB = (() => {
  let dbp; const mem = new Map();
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('shadowing', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('books');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  const req = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const tx = db.transaction('books', mode); const r = fn(tx.objectStore('books'));
    tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error);
  }));
  return {
    async get(k) { if (mem.has(k)) return mem.get(k); try { const v = await req('readonly', s => s.get(k)); if (v) mem.set(k, v); return v; } catch (e) { return undefined; } },
    async put(k, v) { mem.set(k, v); try { await req('readwrite', s => s.put(v, k)); } catch (e) { /* memory only */ } },
    async del(k) { mem.delete(k); try { await req('readwrite', s => s.delete(k)); } catch (e) { /* ignore */ } },
  };
})();

const cache = new Map();

export async function getBook(lang, id) {
  if (cache.has(id)) return cache.get(id);
  const b = id.startsWith('sample-') && SAMPLES[lang]
    ? { id, lang, sentences: textToSentences(SAMPLES[lang].text, lang) }
    : await DB.get('book:' + id);
  if (b && !b.cleaned && b.kind !== 'audio' && !id.startsWith('sample-')) await cleanBook(lang, id, b);
  if (b) {
    cache.set(id, b);
    const m = S.tracks[lang] && S.tracks[lang].books[id];
    if (m && m.total !== b.sentences.length) { m.total = b.sentences.length; save(); }
  }
  return b;
}

/**
 * One-time cleanup of books imported before the OCR-noise filter existed: drops garbage sentences
 * and moves the saved position/last session so the learner keeps their place.
 */
async function cleanBook(lang, id, b) {
  const keep = [], map = [];          // map[oldIndex] = new index of the first kept sentence at/after it
  b.sentences.forEach((x, i) => { map[i] = keep.length; const c = cleanSentence(x, lang); if (c && !isGarbage(c, lang)) keep.push(c); });
  map[b.sentences.length] = keep.length;
  const removed = b.sentences.length - keep.length;
  if (b.translations) b.translations = b.sentences.map((x, i) => [x, i]).filter(([x]) => { const c = cleanSentence(x, lang); return c && !isGarbage(c, lang); }).map(([, i]) => b.translations[i] || '');
  b.sentences = keep; b.cleaned = true;
  await DB.put('book:' + id, b);
  const m = S.tracks[lang] && S.tracks[lang].books[id];
  if (m) {
    m.pos = map[Math.min(m.pos, map.length - 1)] || 0;
    if (m.last) m.last = [map[Math.min(m.last[0], map.length - 1)], map[Math.min(m.last[1], map.length - 1)]];
    m.total = keep.length; save();
  }
  b.removedNoise = removed;
}

/** Adds sentences as a new book, or appends them to `appendId`. Returns the number added. */
export async function importSentences(lang, title, sentences, appendId, emptyMessage = 'No usable text found.', translations = null) {
  const t = S.tracks[lang];
  if (appendId && sentences.length) {
    const book = await getBook(lang, appendId), meta = t.books[appendId];
    if (book && meta && book.kind !== 'audio') {
      if (translations || book.translations) book.translations = (book.translations || new Array(book.sentences.length).fill('')).concat(translations || new Array(sentences.length).fill(''));
      book.sentences = book.sentences.concat(sentences);
      await DB.put('book:' + appendId, book);
      meta.total = book.sentences.length; save();
      return sentences.length;
    }
  }
  if (sentences.length < 3) throw new Error(emptyMessage);
  const id = 'b' + Date.now().toString(36);
  const book = { id, lang, title, sentences };
  if (translations) book.translations = translations;
  await DB.put('book:' + id, book); cache.set(id, book);
  t.books[id] = { title, pos: 0, total: sentences.length, last: null };
  t.bookId = id; save();
  return sentences.length;
}

/**
 * Audio book: a recorded lesson (MP3 blob) + per-sentence clips [start, end] and translations,
 * built from the audio generator's timeline (core/timeline.js).
 */
export async function importAudioBook(lang, title, data, audio) {
  const t = S.tracks[lang];
  const id = 'a' + Date.now().toString(36);
  const book = { id, lang, title, kind: 'audio', sentences: data.sentences, clips: data.clips, translations: data.translations, audio };
  await DB.put('book:' + id, book); cache.set(id, book);
  t.books[id] = { title, pos: 0, total: data.sentences.length, last: null, kind: 'audio' };
  t.bookId = id; save();
  return data.sentences.length;
}

export const importText = (lang, title, raw, appendId, emptyMessage) => importSentences(lang, title, textToSentences(raw, lang), appendId, emptyMessage);

export function deleteBook(lang, id) {
  const t = S.tracks[lang];
  delete t.books[id]; cache.delete(id);
  if (!id.startsWith('sample-')) DB.del('book:' + id);
  if (t.bookId === id) t.bookId = Object.keys(t.books)[0] || null;
  save();
}

export function forgetBooks(ids) { for (const id of ids) { cache.delete(id); if (!id.startsWith('sample-')) DB.del('book:' + id); } }
