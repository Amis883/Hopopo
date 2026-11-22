// Interop with "Dutch Language Shadowing Audio Generator" (github.com/salmansoltaniyan/Dutch-Language-Shadowing-Audio-Generator).
// That tool renders lessons to MP3 with natural neural voices and writes a timeline of every spoken
// segment — as a .json file next to the MP3 and inside the MP3 as the ID3 tag TXXX:SHADOWING_TIMELINE:
//   { audio, duration, segments: [{ start, speech_end, end, row, tag, lang: "dutch"|"persian"|…, text }] }
// Here we turn that timeline into a Hopopo "audio book". Pure functions (no DOM).
import { CATALOG } from './languages.js';

export const TIMELINE_TAG = 'SHADOWING_TIMELINE';

const NAME_TO_ID = Object.fromEntries([
  ...CATALOG.flatMap(c => [[c.id, c.id], [c.name.toLowerCase(), c.id], [c.native.toLowerCase(), c.id]]),
  ['farsi', 'fa'], ['nederlands', 'nl'], ['deutsch', 'de'], ['flemish', 'nl'],
]);
/** "dutch" / "nl" / "nl-NL" / "Nederlands" → "nl". Unknown names are returned lower-cased. */
export function langIdFromName(name) {
  const n = String(name || '').trim().toLowerCase();
  return NAME_TO_ID[n] || NAME_TO_ID[n.split(/[-_]/)[0]] || n;
}

/** Size of the ID3v2 tag at the start of an MP3 (so only that part needs to be read), or 0. */
export function id3Size(head) {
  const b = new Uint8Array(head);
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0;
  return 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f));
}

function decodeTxxx(body) {
  const enc = body[0], rest = body.subarray(1);
  const label = enc === 0 ? 'latin1' : enc === 2 ? 'utf-16be' : enc === 1 ? 'utf-16le' : 'utf-8';
  const dec = new TextDecoder(label);
  let cut = -1, step = 1;
  if (enc === 1 || enc === 2) { step = 2; for (let i = 0; i + 1 < rest.length; i += 2) if (rest[i] === 0 && rest[i + 1] === 0) { cut = i; break; } }
  else cut = rest.indexOf(0);
  if (cut < 0) return null;
  const clean = s => s.replace(/^﻿/, '').replace(/\u0000+$/, '');
  return { desc: clean(dec.decode(rest.subarray(0, cut))), value: clean(dec.decode(rest.subarray(cut + step))) };
}

/** Reads the value of a user text frame (TXXX) with the given description from an ID3v2.3/2.4 tag. */
export function readId3Txxx(buf, description = TIMELINE_TAG) {
  const b = new Uint8Array(buf);
  const total = id3Size(buf); if (!total) return null;
  const ver = b[3], flags = b[5];
  const syncsafe = i => (b[i] & 0x7f) << 21 | (b[i + 1] & 0x7f) << 14 | (b[i + 2] & 0x7f) << 7 | (b[i + 3] & 0x7f);
  const plain = i => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  let p = 10;
  if (flags & 0x40) p += ver === 4 ? syncsafe(10) : plain(10) + 4;       // extended header
  const end = Math.min(total, b.length);
  while (p + 10 <= end) {
    const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;                                  // padding reached
    const size = ver === 4 ? syncsafe(p + 4) : plain(p + 4);
    if (id === 'TXXX') { const f = decodeTxxx(b.subarray(p + 10, p + 10 + size)); if (f && f.desc === description) return f.value; }
    p += 10 + size;
  }
  return null;
}

/**
 * Timeline → { lang, title, sentences[], clips[[start, speechEnd]], translations[] }.
 * The learning language is `preferLang` if the lesson has it, else the most frequent non-Persian language.
 * Segments of other languages in the same row become that row's translation.
 * Repeats of the same segment within a row (the generator's "repeats") are kept once.
 */
export function timelineToBook(tl, preferLang) {
  const segs = (tl && Array.isArray(tl.segments) ? tl.segments : [])
    .filter(s => s && typeof s.text === 'string' && s.text.trim() && Number.isFinite(+s.start))
    .map((s, i) => ({ ...s, id: langIdFromName(s.lang), row: s.row ?? i, text: s.text.trim() }));
  if (!segs.length) return null;
  const counts = {}; for (const s of segs) counts[s.id] = (counts[s.id] || 0) + 1;
  const target = preferLang && counts[preferLang] ? preferLang
    : Object.keys(counts).filter(k => k !== 'fa').sort((a, b) => counts[b] - counts[a])[0] || segs[0].id;

  const rows = new Map();
  for (const s of segs) { if (!rows.has(s.row)) rows.set(s.row, []); rows.get(s.row).push(s); }
  const sentences = [], clips = [], translations = [];
  for (const group of rows.values()) {
    const trans = [...new Set(group.filter(s => s.id !== target).map(s => s.text))].join(' / ');
    const seen = new Set();
    for (const s of group) {
      if (s.id !== target) continue;
      const key = s.tag + '|' + s.text; if (seen.has(key)) continue; seen.add(key);
      const end = Number.isFinite(+s.speech_end) ? +s.speech_end : +s.end;
      sentences.push(s.text); clips.push([+s.start, end]); translations.push(trans);
    }
  }
  if (!sentences.length) return null;
  const title = String(tl.audio || '').replace(/\.mp3$/i, '').replace(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/, '').replace(/_/g, ' ').trim();
  return { lang: target, title, sentences, clips, translations, duration: tl.duration };
}
