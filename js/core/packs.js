// "Shadowing packs": a small JSON format for sharing prepared lessons between people/devices. Pure.
import { isKnownLang } from './languages.js';

export const PACK_FORMAT = 'shadowing-pack';

export function makePack({ lang, level, title, sentences, translations }) {
  const p = { format: PACK_FORMAT, version: 1, lang, level, title, sentences };
  if (translations && translations.some(Boolean)) p.translations = translations;
  return JSON.stringify(p);
}

/** Returns the pack object, or null if `text` isn't a valid pack. */
export function parsePack(text) {
  try {
    const p = JSON.parse(text);
    if (p && p.format === PACK_FORMAT && isKnownLang(p.lang) && Array.isArray(p.sentences)) {
      const keep = p.sentences.map((x, i) => [x, i]).filter(([x]) => typeof x === 'string' && x.trim());
      const tr = Array.isArray(p.translations) ? keep.map(([, i]) => String(p.translations[i] || '')) : null;
      return { ...p, sentences: keep.map(([x]) => x.trim()), translations: tr && tr.some(Boolean) ? tr : null };
    }
  } catch (e) { /* not JSON */ }
  return null;
}

export const packFileName = title => (String(title).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'lesson') + '.shadow.json';
