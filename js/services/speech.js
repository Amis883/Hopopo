// Browser speech: text-to-speech (Web Speech synthesis) and speech recognition for the speech check.
import { lang as langInfo } from '../core/languages.js';
import { estDur } from '../core/planner.js';

const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
export const ttsSupported = () => hasTTS;

let voices = [];
const listeners = new Set();
function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } listeners.forEach(f => f()); }
if (hasTTS) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
/** Voices load asynchronously on some browsers; subscribe to refresh pickers. */
export const onVoicesChanged = fn => listeners.add(fn);

const vlang = v => (v.lang || '').replace('_', '-').toLowerCase();
export const voicesFor = lang => voices.filter(v => vlang(v).startsWith(lang + '-') || vlang(v) === lang || (lang === 'no' && vlang(v).startsWith('nb')));

/** The track's chosen voice, else the best-sounding voice for the language. */
export function voiceFor(track) {
  const vs = voicesFor(track.lang);
  let v = vs.find(x => x.voiceURI === track.voiceURI);
  if (!v) {
    const pref = langInfo(track.lang).tts.toLowerCase();
    v = vs.find(x => vlang(x) === pref && /enhanced|premium|natural|neural/i.test(x.name))
      || vs.find(x => vlang(x) === pref && /google/i.test(x.name))
      || vs.find(x => vlang(x) === pref) || vs[0];
  }
  return v;
}

let current = null; // keep a reference: some engines garbage-collect utterances mid-speech
/** Speaks and resolves when done (or after a safety timeout — some engines never fire `end`). */
export function speak(text, rate, track, onBoundary) {
  return new Promise(res => {
    if (!hasTTS) { res(); return; }
    const u = new SpeechSynthesisUtterance(text);
    const v = voiceFor(track); if (v) u.voice = v;
    u.lang = v ? v.lang : langInfo(track.lang).tts;
    u.rate = Math.max(.5, Math.min(1.6, rate));
    let done = false; const fin = () => { if (done) return; done = true; clearTimeout(to); res(); };
    const to = setTimeout(fin, (estDur(text, rate, track.lang) * 1.8 + 2) * 1000);
    // iOS sometimes drops an utterance silently (no start, no end): don't let that stall practice
    const noStart = setTimeout(() => { if (!started) fin(); }, 2500);
    let started = false;
    u.onstart = () => { started = true; clearTimeout(noStart); };
    u.onend = fin; u.onerror = fin;
    u.onboundary = e => { if (onBoundary && e.name !== 'sentence') onBoundary(e.charIndex); };
    current = u; speechSynthesis.speak(u);
  });
}
export function stopSpeaking() { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
/** iOS only plays speech started from a user gesture: call this synchronously in the click handler. */
export function unlockAudio() { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* ignore */ } }

/* ---- speech recognition ---- */
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const recognitionSupported = () => !!SR;
let blocked = false, active = null;
export const recognitionBlocked = () => blocked;
/** Abort any running recognition right away (used when the learner pauses or leaves). */
export function stopListening() { if (active) active(); }

/**
 * Listens for one utterance.
 * Resolves with { text, error }:
 *   text  – what was heard ('' if nothing),
 *   error – null, or a SpeechRecognition error code ('no-speech', 'audio-capture', 'network', …).
 * Resolves with null when recognition is unavailable or the microphone was refused.
 * Phones often end a recognition session early (before the learner starts talking);
 * then it is restarted, as long as time remains.
 */
export function listenOnce(lang, maxMs, isCancelled, onLive) {
  return new Promise(res => {
    if (!SR || blocked) { res(null); return; }
    const t0 = Date.now();
    let text = '', err = null, done = false, r = null, restarts = 0;
    const finish = () => {
      if (done) return; done = true; active = null;
      clearTimeout(maxT); clearInterval(watch);
      try { if (r) r.abort(); } catch (e) { /* ignore */ }
      if (err === 'not-allowed' || err === 'service-not-allowed') { blocked = true; res(null); return; }
      res({ text: text.trim(), error: text.trim() ? null : (err === 'no-speech' || err === 'aborted' ? null : err) });
    };
    const start = () => {
      try { r = new SR(); } catch (e) { err = 'unsupported'; finish(); return; }
      r.lang = langInfo(lang).tts; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      r.onresult = e => {
        let t = '';
        for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + ' ';
        text = t; if (onLive) onLive(text.trim());
      };
      r.onerror = e => { err = e.error; if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') finish(); };
      r.onend = () => {
        if (done) return;
        const left = maxMs - (Date.now() - t0);
        // ended before anything was heard: try again while there is time
        if (!text.trim() && left > 1500 && restarts < 3 && !isCancelled()) { restarts++; setTimeout(() => { if (!done) start(); }, 150); return; }
        finish();
      };
      try { r.start(); } catch (e) { err = 'start-failed'; finish(); }
    };
    const maxT = setTimeout(finish, maxMs);
    const watch = setInterval(() => { if (isCancelled()) finish(); }, 100);
    active = finish;
    start();
  });
}

/**
 * Session listener: one continuous recognition session opened by the tap that starts practice
 * (iOS only grants the microphone to speech recognition from a user gesture) and kept open, so
 * the learner never has to tap per sentence. Results arriving while the app itself speaks are
 * ignored by marking where the learner's turn begins. If the phone ends the session it is
 * restarted; if restarts keep failing, alive() turns false and the caller falls back.
 */
export function openListener(lang) {
  if (!SR || blocked) return null;
  const segs = [];               // {t, at} — every result heard in this session, across restarts
  let r = null, base = 0, alive = false, closed = false, quickEnds = 0, startedAt = 0;
  const start = () => {
    try { r = new SR(); } catch (e) { return false; }
    r.lang = langInfo(lang).tts; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onstart = () => { alive = true; };
    r.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript, k = base + i;
        if (!segs[k] || segs[k].t !== t) segs[k] = { t, at: Date.now() };
      }
    };
    r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { blocked = true; closed = true; alive = false; } };
    r.onend = () => {
      alive = false;
      if (closed) return;
      quickEnds = Date.now() - startedAt < 1500 ? quickEnds + 1 : 0;
      if (quickEnds >= 3) { closed = true; return; }          // the phone won't keep it open
      base = segs.length;
      setTimeout(() => { if (!closed) { startedAt = Date.now(); try { r.start(); alive = true; } catch (e) { closed = true; } } }, 120);
    };
    startedAt = Date.now();
    try { r.start(); alive = true; } catch (e) { return false; }
    return true;
  };
  if (!start()) return null;
  return {
    alive: () => alive && !closed,
    /** Index from which the learner's answer starts. */
    mark: () => segs.length,
    /** Waits for the learner to speak after `mark()`; resolves {text, error} like listenOnce, or null if the session died. */
    capture(from, maxMs, isCancelled, onLive) {
      return new Promise(res => {
        const t0 = Date.now();
        const iv = setInterval(() => {
          const mine = segs.slice(from).filter(Boolean);
          const text = mine.map(s => s.t).join(' ').replace(/\s+/g, ' ').trim();
          const last = mine.reduce((a, s) => Math.max(a, s.at), 0);
          if (text && onLive) onLive(text);
          const done = isCancelled() || (text && Date.now() - last > 1200) || Date.now() - t0 > maxMs || closed;
          if (!done) return;
          clearInterval(iv);
          if (!text && closed) res(null); else res({ text, error: null });
        }, 100);
      });
    },
    close() { closed = true; alive = false; try { if (r) r.abort(); } catch (e) { /* ignore */ } },
  };
}
