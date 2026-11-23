// Turning raw book text into shadowable sentences and chunks. Pure functions: safe to unit-test in Node.
import { isNoSpace } from './languages.js';

const TERMINAL = /[.!?…:;,"”»«)。！？」』]$/;

/** Word count; for scripts without spaces, roughly two characters per "word". */
export function wc(s, lang) {
  if (isNoSpace(lang)) return Math.ceil(s.replace(/\s+/g, '').length / 2);
  return s.split(/\s+/).filter(Boolean).length;
}

/** Removes stray 1-character tokens OCR leaves after a sentence end: "…Berlin. a b c" → "…Berlin." */
export const stripTrailingNoise = l => l.replace(/([.!?…:;"”»)。！？])(?:\s+\S){1,8}\s*$/u, '$1');

/**
 * Cleans extracted text (PDF/OCR/EPUB/paste) into paragraphs:
 * joins hyphenated line breaks, drops page numbers and short heading-like lines.
 */
export function normalize(raw, lang) {
  const t = raw.replace(/\r/g, '').replace(/­/g, '').replace(/(\p{L})-\n\s*(\p{Ll})/gu, '$1$2');
  const paras = []; let cur = [];
  const flush = () => { if (cur.length) paras.push(cur.join(isNoSpace(lang) ? '' : ' ')); cur = []; };
  for (const line of t.split('\n')) {
    const l = stripTrailingNoise(line.replace(/\s+/g, ' ').trim());
    if (!l) { flush(); continue; }
    if (/^[\dIVXLCivxlc.\-–—\s]+$/.test(l)) continue;                // page numbers
    if (wc(l, lang) <= 5 && !TERMINAL.test(l)) { flush(); continue; } // headings / labels
    cur.push(l);
  }
  flush();
  return paras;
}

/** Splits paragraphs into sentences, using Intl.Segmenter when the runtime has it. */
export function splitSentences(paras, lang) {
  const seg = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter(lang, { granularity: 'sentence' }) : null;
  const out = [];
  for (const p of paras) {
    const parts = seg ? [...seg.segment(p)].map(x => x.segment)
      : (p.match(/[^.!?…。！？]+[.!?…。！？]+["'»«“”)」』]*\s*|[^.!?…。！？]+$/g) || [p]);
    for (const s of parts) { const x = cleanSentence(s, lang); if (x && !isGarbage(x, lang)) out.push(x); }
  }
  return out;
}

/** Valid one-letter words in the supported languages (so "Il y a…", "Idę z mamą", "Я и ты" survive the filter). */
const ONE_LETTER = new Set(['a', 'i', 'o', 'e', 'y', 'u', 'à', 'è', 'é', 'ó', 'w', 'z', 'и', 'в', 'с', 'к', 'у', 'о', 'а', 'я', 'ο', 'η', 'ή', 'ό']);
const VOWEL = /[aeiouyäöüàâáéèêëíîïóôòõúùûåøæœ]/i;
const LATIN_WORD = /^[a-zA-ZÀ-ɏ]+$/;

/** Strips list markers OCR leaves at the start of a line: "a) ", "(b) ", "3. ", "• ". */
export function cleanSentence(s, lang) {
  let x = stripTrailingNoise(s.trim());
  if (isNoSpace(lang)) return x;
  for (let i = 0; i < 3; i++) x = x.replace(/^(?:\(?\p{L}\)\s+|\p{L}[.:]\s+(?=\p{Lu})|\d{1,3}\s*[).:]?\s+|[•●▪·*|\-–]\s*)/u, '');
  return x.trim();
}

/**
 * True for OCR noise that is not a real sentence: stray letters ("a b c", "I l |"),
 * symbols and digits, or consonant soup ("Lktn hkvz"). Short real sentences ("Ja.", "Hallo!") pass.
 */
export function isGarbage(s, lang) {
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (isNoSpace(lang)) return letters < 2;
  const chars = s.replace(/\s/g, '').length;
  if (!letters || letters / chars < 0.6) return true;
  const words = s.split(/\s+/).map(t => t.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')).filter(Boolean);
  if (!words.length) return true;
  if (words.length === 1) return words[0].length < 2 || (words[0].length < 3 && !/[.!?]["”»)]?$/.test(s.trim()));
  const stray = words.filter(w => w.length === 1 && !ONE_LETTER.has(w.toLowerCase())).length;
  if (stray / words.length > 0.3) return true;
  if (!words.some(w => w.length >= 2 && !(w.length === 1))) return true;
  if (words.every(w => w.length === 1)) return true;
  const soup = words.filter(w => w.length >= 4 && LATIN_WORD.test(w) && !VOWEL.test(w)).length;
  return soup / words.length > 0.3;
}

export const textToSentences = (raw, lang) => splitSentences(normalize(raw, lang), lang);

/** Conjunctions where a long sentence may be split, per language. */
const CONJ = {
  en: 'and|but|because|which|who|that|when|while|although|so|if',
  de: 'und|aber|weil|dass|wenn|denn|oder|sondern|als|damit|obwohl',
  nl: 'en|maar|omdat|dat|als|want|of|die|wanneer|hoewel',
  fr: 'et|mais|parce|que|qui|quand|si|donc|lorsque',
  es: 'y|pero|porque|que|cuando|si|aunque',
  it: 'e|ma|perché|che|quando|se|anche',
  pt: 'e|mas|porque|que|quando|se|embora',
  sv: 'och|men|eftersom|att|när|om', da: 'og|men|fordi|at|når|hvis', no: 'og|men|fordi|at|når|hvis',
};

/**
 * Splits a sentence into chunks of at most ~maxW words: first at punctuation, then at
 * conjunctions, then evenly; finally merges very short leftovers back into a neighbour.
 */
export function chunkSentence(s, maxW, lang) {
  if (wc(s, lang) <= maxW) return [s];
  const nospace = isNoSpace(lang);
  let parts = s.replace(/([,;:–—，、；：])\s*/g, '$1\u0001').split('\u0001');
  if (CONJ[lang]) {
    const conj = new RegExp(`\\s+(?=(?:${CONJ[lang]})\\s)`, 'i');
    parts = parts.flatMap(p => wc(p, lang) > maxW ? p.split(conj) : [p]);
  }
  parts = parts.flatMap(p => {
    if (wc(p, lang) <= maxW) return [p];
    if (nospace) { const size = maxW * 2, r = []; for (let i = 0; i < p.length; i += size) r.push(p.slice(i, i + size)); return r; }
    const w = p.split(/\s+/).filter(Boolean);
    const n = Math.ceil(w.length / maxW), size = Math.ceil(w.length / n), r = [];
    for (let i = 0; i < w.length; i += size) r.push(w.slice(i, i + size).join(' '));
    return r;
  });
  const out = [];
  for (const p of parts.map(x => x.trim()).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last && (wc(p, lang) < 3 || wc(last, lang) < 3) && wc(last, lang) + wc(p, lang) <= maxW + 2) out[out.length - 1] = last + (nospace ? '' : ' ') + p;
    else out.push(p);
  }
  return out;
}

/** Textbook task instructions in several languages (lines that start with these are not shadowed). */
const EX_RE = new RegExp('^(' + [
  'hören|lesen|schreiben|ergänzen|ergänze|markieren|kreuzen|ordnen|sprechen|spielen|sehen|wählen|verbinden|notieren|fragen|antworten|sortieren|unterstreichen|beschreiben|erzählen|machen sie|was passt|wer sagt|richtig oder falsch|übung',
  'listen|read|write|complete|match|fill|tick|circle|underline|answer|choose|work in|discuss|look at|ask and|talk about|exercise',
  'luister|lees|schrijf|vul|kies|beantwoord|oefening|maak|kijk|zeg',
  'écoutez|lisez|écrivez|complétez|choisissez|répondez|exercice|associez|cochez',
  'escucha|lee|escribe|completa|elige|responde|ejercicio|relaciona|marca',
].join('|') + ')\\b', 'iu');

/**
 * Offline fallback for picking shadowable material from a lesson: drops instructions,
 * gap-fills, numbering, speaker labels, word lists and number-heavy lines.
 */
export function heuristicPick(raw, lang, note = '') {
  const lines = raw.replace(/\r/g, '').split('\n').map(l => l
    .replace(/^\s*(?:\d{1,2}[.)]?|[a-hA-H][.)]|[•●▪\-–])\s+/, '')
    .replace(/^\s*[\p{Lu}][\p{L}.]{0,14}:\s+/u, ''));
  const clean = lines.map(l => { const x = l.trim(); return (EX_RE.test(x) || /_{2,}|\.{4,}|…\s*…|\(\s*\)/.test(x)) ? '' : l; });
  const keep = normalize(clean.join('\n'), lang).filter(p => {
    if (wc(p, lang) < 3 || !/[.!?。！？]["”»)」]?$/.test(p)) return false;
    const toks = p.split(/\s+/);
    return toks.filter(w => /\d/.test(w)).length / toks.length <= 0.3;
  });
  return keep.length ? [{ type: 'reading', title: 'Auswahl', note, text: keep.join('\n') }] : [];
}

/** Each picked line becomes its own sentence (adds a final period where a phrase lacks one). */
export function linesToText(texts) {
  return texts.map(t => String(t).split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => /[.!?…:;"”»)。！？]$/.test(l) ? l : l + '.').join('\n\n')).join('\n\n');
}
