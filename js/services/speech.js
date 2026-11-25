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
    const to = setTimeout(fin, (estDur(text, rate, track.lang) * 2.5 + 4) * 1000);
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
