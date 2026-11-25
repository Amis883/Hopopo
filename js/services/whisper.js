// In-app speech recognition with OpenAI's Whisper (tiny, multilingual, 8-bit), running on the device
// via transformers.js + ONNX Runtime (WebAssembly) inside a Web Worker (whisper.worker.js), so the
// microphone recording and the UI keep running while it transcribes. The library ships with the app
// (lib/transformers); the model (~40 MB) is downloaded once from Hugging Face and cached by the
// browser, so it works offline afterwards. Nothing the learner says leaves the phone.
import { lang as langInfo } from '../core/languages.js';

export const MODEL_ID = 'Xenova/whisper-tiny';
const LIB_DIR = new URL('../../lib/transformers/', import.meta.url).href;

let worker = null, loading = null, state = 'idle', progress = 0, speedMs = Infinity, nextId = 1;
const pending = new Map(), listeners = new Set();
const emit = () => listeners.forEach(f => { try { f(state, progress); } catch (e) { /* ignore */ } });
export const whisperState = () => ({ state, progress });
export const onWhisperState = fn => { listeners.add(fn); return () => listeners.delete(fn); };
/** How long one short transcription takes on this device (measured at warm-up). */
export const whisperSpeedMs = () => speedMs;

/** Loads (and on first use downloads) the model in the worker. Safe to call many times. */
export function loadWhisper() {
  if (state === 'ready') return Promise.resolve();
  if (loading) return loading;
  state = 'loading'; progress = 0; emit();
  loading = new Promise((resolve, reject) => {
    try { worker = new Worker(new URL('./whisper.worker.js', import.meta.url), { type: 'module' }); }
    catch (e) { reject(e); return; }
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') { progress = data.progress; emit(); }
      else if (data.type === 'ready') { speedMs = data.speedMs; state = 'ready'; progress = 1; emit(); resolve(); }
      else if (data.type === 'result') { const p = pending.get(data.id); if (p) { pending.delete(data.id); p.resolve(data.text); } }
      else if (data.type === 'error') {
        if (data.id && pending.has(data.id)) { pending.get(data.id).reject(new Error(data.message)); pending.delete(data.id); }
        else { state = 'error'; emit(); reject(new Error(data.message)); }
      }
    };
    worker.onerror = e => { state = 'error'; emit(); reject(e); };
    worker.postMessage({ type: 'load', lib: LIB_DIR, model: MODEL_ID, local: window.__WHISPER_LOCAL__ ? new URL(window.__WHISPER_LOCAL__, location.href).href : null });
  });
  loading.catch(() => { loading = null; if (worker) { worker.terminate(); worker = null; } });
  return loading;
}

/** Transcribes 16 kHz mono audio spoken in `lang`. Calls are answered in order by the worker. */
export async function transcribe(pcm, lang) {
  await loadWhisper();
  const id = nextId++;
  // Whisper writes non-speech as [inaudible], (music), *laughs* … — drop those labels
  const clean = t => String(t || '').replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|♪/g, ' ').replace(/\s+/g, ' ').trim();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: t => resolve(clean(t)), reject });
    worker.postMessage({ type: 'run', id, pcm, language: langInfo(lang).name.toLowerCase() });
  });
}
