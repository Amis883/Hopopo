// App state (settings, tracks, progress, history) persisted in localStorage.
// Book texts are large and live in IndexedDB instead (see books.js).
import { SAMPLES } from '../core/languages.js';

const LS_KEY = 'shadowing.v1';

/** A learning track: one language with its own level, books, progress and history. */
export function newTrack(lang, level = 'A1') {
  const t = { lang, level, minutes: 12, speed: 1, voiceURI: '', warmup: true, check: true, checkReps: 2, skipOnGreen: true, bookId: null, books: {}, history: [] };
  if (SAMPLES[lang]) {
    const id = 'sample-' + lang;
    t.books[id] = { title: SAMPLES[lang].title, pos: 0, total: 0, last: null, sample: true };
    t.bookId = id;
  }
  return t;
}

/** A new user starts with no tracks: the welcome screen asks for their language and level. */
function defaults() {
  const ui = typeof navigator !== 'undefined' && /^fa\b/i.test(navigator.language || '') ? 'fa' : 'en';
  return { ui, order: [], tracks: {}, onboarded: false };
}

/** Loads state and migrates older shapes (v1 had only en/de and no `order`). */
export function loadState() {
  let s;
  try { s = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { s = null; }
  if (!s || !s.tracks) return defaults();
  for (const k of Object.keys(s.tracks)) s.tracks[k] = Object.assign(newTrack(k), s.tracks[k]);
  if (!Array.isArray(s.order)) s.order = Object.keys(s.tracks);
  if (s.onboarded === undefined) s.onboarded = true;            // users from before the welcome screen
  s.order = s.order.filter(k => s.tracks[k]);
  for (const k of s.order) { const sm = s.tracks[k].books['sample-' + k]; if (sm && SAMPLES[k]) sm.title = SAMPLES[k].title; }
  return s;
}

export const S = loadState();
export function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ } }

export function addTrack(lang, level) {
  if (S.tracks[lang]) return S.tracks[lang];
  S.tracks[lang] = newTrack(lang, level);
  S.order.push(lang); save();
  return S.tracks[lang];
}

export function removeTrack(lang) {
  const bookIds = Object.keys((S.tracks[lang] || {}).books || {});
  delete S.tracks[lang];
  S.order = S.order.filter(k => k !== lang); save();
  return bookIds;
}
