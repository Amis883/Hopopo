// "Shadowing packs": a small JSON format for sharing prepared lessons between people/devices. Pure.
import { isKnownLang } from './languages.js';

export const PACK_FORMAT = 'shadowing-pack';

export function makePack({ lang, level, title, sentences }) {
  return JSON.stringify({ format: PACK_FORMAT, version: 1, lang, level, title, sentences });
}

/** Returns the pack object, or null if `text` isn't a valid pack. */
export function parsePack(text) {
  try {
    const p = JSON.parse(text);
    if (p && p.format === PACK_FORMAT && isKnownLang(p.lang) && Array.isArray(p.sentences)) {
      return { ...p, sentences: p.sentences.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) };
    }
  } catch (e) { /* not JSON */ }
  return null;
}

export const packFileName = title => (String(title).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'lesson') + '.shadow.json';
