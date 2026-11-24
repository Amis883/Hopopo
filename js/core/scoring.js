// Compares what the learner said with the target sentence. Pure functions.
import { isNoSpace } from './languages.js';

const NUMS = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'],
  de: ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig'],
  nl: ['nul', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien', 'twintig'],
};

/** Normalises a token for comparison: case, punctuation, digits → words, ß → ss. */
export function fold(w, lang) {
  let x = w.toLowerCase().normalize('NFC').replace(/[’']/g, "'").replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
  if (/^\d+$/.test(x) && NUMS[lang] && NUMS[lang][+x]) x = NUMS[lang][+x];
  return x.replace(/ß/g, 'ss');
}

/** Levenshtein edit distance. */
export function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Similarity in [0,1]; accent-only differences count as 0.9. */
export function wordSim(a, b) {
  if (a === b) return 1;
  const strip = s => s.normalize('NFD').replace(/\p{M}/gu, '');
  if (strip(a) === strip(b)) return .9;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
}

/** Tokens to compare: words, or characters for scripts without spaces. */
export function tokens(text, lang) {
  if (isNoSpace(lang)) return [...text.replace(/[\s\p{P}]/gu, '')];
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Aligns heard tokens to target tokens (edit-distance DP with fuzzy substitution cost)
 * and returns one mark per target token — 'ok' | 'close' | 'bad' — plus a 0–100 score.
 * Insertions (extra words) are cheaper than deletions so filler words don't punish much.
 */
export function scoreSpeech(target, heard, lang) {
  const tw = tokens(target, lang).map(w => fold(w, lang));
  const hw = tokens(heard, lang).map(w => fold(w, lang)).filter(Boolean);
  const m = tw.length, n = hw.length, D = [], B = [];
  for (let i = 0; i <= m; i++) {
    D[i] = []; B[i] = [];
    for (let j = 0; j <= n; j++) {
      if (!i && !j) { D[0][0] = 0; continue; }
      let best = Infinity, bk = null;
      if (i && j) { const sim = wordSim(tw[i - 1], hw[j - 1]); const c = D[i - 1][j - 1] + (sim >= .99 ? 0 : sim >= .7 ? .4 : 1); if (c < best) { best = c; bk = 'd'; } }
      if (i) { const c = D[i - 1][j] + 1; if (c < best) { best = c; bk = 'u'; } }
      if (j) { const c = D[i][j - 1] + .6; if (c < best) { best = c; bk = 'l'; } }
      D[i][j] = best; B[i][j] = bk;
    }
  }
  const marks = new Array(m).fill('bad'); let i = m, j = n;
  while (i > 0 || j > 0) {
    const b = B[i][j];
    if (b === 'd') { const sim = wordSim(tw[i - 1], hw[j - 1]); marks[i - 1] = sim >= .99 ? 'ok' : sim >= .7 ? 'close' : 'bad'; i--; j--; }
    else if (b === 'u') { marks[i - 1] = 'bad'; i--; }
    else j--;
  }
  const out = tw.map((w, k) => w ? marks[k] : 'ok');
  const score = m ? Math.round(100 * out.reduce((a, x) => a + (x === 'ok' ? 1 : x === 'close' ? .6 : 0), 0) / m) : 0;
  return { marks: out, score };
}

/**
 * Live progress while the learner is still speaking: aligns what was heard so far against the
 * best-matching *prefix* of the target. Words up to that point get ok/close/bad, the rest 'pending';
 * `pos` is the index of the word the learner is about to say.
 */
export function scorePartial(target, heard, lang) {
  const n = tokens(target, lang).length;
  if (!heard.trim()) return { marks: new Array(n).fill('pending'), pos: 0 };
  const words = tokens(heard, lang).length;
  let best = null;
  // the learner has said roughly as many words as they've heard; search a small window around that
  for (let k = Math.max(1, words - 3); k <= Math.min(n, words + 2); k++) {
    const prefix = isNoSpace(lang) ? tokens(target, lang).slice(0, k).join('') : target.split(/\s+/).filter(Boolean).slice(0, k).join(' ');
    const r = scoreSpeech(prefix, heard, lang);
    const val = r.score - Math.abs(k - words) * 3;          // prefer the prefix length closest to what was said
    if (!best || val > best.val) best = { val, k, marks: r.marks };
  }
  const marks = best.marks.concat(new Array(n - best.k).fill('pending'));
  return { marks, pos: best.k };
}
