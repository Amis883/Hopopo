// Builds a daily session plan from a book position. Pure: input state in, plan out.
import { PROFILES, lang as langInfo } from './languages.js';
import { chunkSentence, wc } from './text.js';

/** Phases for a track, swapping plain "echo" repeats for checked repeats when speech check is on. */
/**
 * Practice style (track.style):
 *  'simple' (default) – read once → learner says it once; one retry only if it wasn't right
 *                       (the runner skips the retry when the first try is good enough)
 *  'full'             – the CEFR profile: listen, repeat/check, speak along, continuous pass
 */
export const styleOf = track => track.style || 'simple';

export function phasesFor(track) {
  const prof = PROFILES[track.level];
  const ref = prof.phases.find(p => p.t === 'echo') || prof.phases.find(p => p.t === 'listen');
  if (styleOf(track) === 'simple') {
    const r = prof.finalRate;   // natural shadowing speed for the level (A1 0.8 … C1 1.05)
    return track.check
      ? [{ t: 'check', r, n: 1, of: 2 }, { t: 'check', r, n: 2, of: 2, retry: true }]
      : [{ t: 'echo', r }];
  }
  if (!track.check) return prof.phases;
  const n = Math.max(1, Math.min(3, track.checkReps || 2));
  const checks = Array.from({ length: n }, (_, i) => ({ t: 'check', r: ref.r, n: i + 1, of: n }));
  return [...prof.phases.filter(p => p.t === 'listen'), ...checks, ...prof.phases.filter(p => p.t === 'shadow')];
}

/** Estimated seconds to speak `text` at `rate`. */
export const estDur = (text, rate, lang) => wc(text, lang) / (langInfo(lang).wps * rate) + 0.5;

/** Estimated seconds for one step, including the learner's turn for echo/check steps. */
export function stepTime(text, type, rate, lang) {
  const d = estDur(text, rate, lang);
  return (type === 'echo' ? d * 2.25 + 1 : type === 'check' ? d * 2.6 + 3.5 : d) + 0.6;
}

/**
 * Plan = chunks + an ordered list of steps.
 *  1. review: a couple of sentences from the previous session (warm-up)
 *  2. main:   new sentences from `meta.pos`, each chunk through all phases,
 *             taking whole sentences until the time budget (`track.minutes`) is reached
 *  3. final:  one continuous shadowing pass over all new chunks
 * A step is { k: chunkIndex, sec: 'review'|'main'|'final', ph: {t, r, ...} }.
 */
export function buildPlan(track, meta, sentences, { wholeSentences = false } = {}) {
  const prof = PROFILES[track.level], sp = track.speed || 1, lang = track.lang, target = track.minutes * 60;
  // Recorded audio can't be cut inside a sentence, so audio books use whole sentences as chunks.
  const chunk = s => wholeSentences ? [s] : chunkSentence(s, prof.maxWords, lang);
  const phases = phasesFor(track);
  // continuous pass at the end: part of the full style; optional in the simple style
  const finalPass = track.finalPass ?? styleOf(track) === 'full';
  const chunks = [], steps = []; let est = 0;

  if (track.warmup && meta.last && meta.last[1] > meta.last[0] && meta.last[1] <= sentences.length) {
    for (let s = Math.max(meta.last[0], meta.last[1] - 2); s < meta.last[1]; s++) {
      for (const c of chunk(sentences[s])) {
        const k = chunks.push({ text: c, sent: s }) - 1;
        steps.push({ k, sec: 'review', ph: { t: 'shadow', r: prof.finalRate * sp } });
        est += stepTime(c, 'shadow', prof.finalRate * sp, lang);
      }
    }
  }

  const firstNew = chunks.length; let s = meta.pos;
  while (s < sentences.length) {
    const cs = chunk(sentences[s]);
    let add = 0;
    for (const c of cs) {
      for (const ph of phases) add += stepTime(c, ph.t, ph.r * sp, lang);
      if (finalPass) add += stepTime(c, 'shadow', prof.finalRate * sp, lang);
    }
    if (chunks.length > firstNew && est + add > target) break;
    est += add; for (const c of cs) chunks.push({ text: c, sent: s }); s++;
  }
  for (let k = firstNew; k < chunks.length; k++) for (const ph of phases) steps.push({ k, sec: 'main', ph: { ...ph, r: ph.r * sp } });
  if (finalPass) for (let k = firstNew; k < chunks.length; k++) steps.push({ k, sec: 'final', ph: { t: 'shadow', r: prof.finalRate * sp } });
  return { chunks, steps, start: meta.pos, end: s, est, newCount: chunks.length - firstNew };
}

/** First step index of the chunk that step `i` belongs to (same chunk, same section). */
export function chunkStart(steps, i) {
  const { k, sec } = steps[i];
  while (i > 0 && steps[i - 1].k === k && steps[i - 1].sec === sec) i--;
  return i;
}

/** First step index after the chunk that step `i` belongs to. */
export function nextChunkStart(steps, i) {
  const { k, sec } = steps[i];
  while (i < steps.length && steps[i].k === k && steps[i].sec === sec) i++;
  return i;
}
