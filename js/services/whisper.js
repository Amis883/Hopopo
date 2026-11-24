// In-app speech recognition with OpenAI's Whisper (tiny, multilingual), running on the device via
// transformers.js + ONNX Runtime (WebAssembly). The library ships with the app (lib/transformers);
// the model (~40 MB, quantized) is downloaded once from Hugging Face and then cached by the browser,
// so it works offline afterwards. Nothing the learner says leaves the phone.
import { lang as langInfo } from '../core/languages.js';

export const MODEL_ID = 'Xenova/whisper-tiny';
const LIB_DIR = new URL('../../lib/transformers/', import.meta.url).href;   // relative to this module

let asr = null, loading = null, state = 'idle', progress = 0;
const listeners = new Set();
const emit = () => listeners.forEach(f => { try { f(state, progress); } catch (e) { /* ignore */ } });
export const whisperState = () => ({ state, progress });
export const onWhisperState = fn => { listeners.add(fn); return () => listeners.delete(fn); };

/** Loads (and on first use downloads) the model. Safe to call many times. */
export function loadWhisper() {
  if (asr) return Promise.resolve(asr);
  if (loading) return loading;
  state = 'loading'; progress = 0; emit();
  const files = {};
  loading = (async () => {
    const { env, pipeline } = await import(LIB_DIR + 'transformers.min.js');
    env.backends.onnx.wasm.wasmPaths = LIB_DIR;
    env.backends.onnx.wasm.numThreads = 1;              // GitHub Pages has no cross-origin isolation
    if (window.__WHISPER_LOCAL__) { env.allowRemoteModels = false; env.allowLocalModels = true; env.localModelPath = window.__WHISPER_LOCAL__; }
    asr = await pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: 'q8', device: 'wasm',
      progress_callback: p => {
        if (p.status === 'progress' && p.total) {
          files[p.file] = [p.loaded, p.total];
          const v = Object.values(files), loaded = v.reduce((a, x) => a + x[0], 0), total = v.reduce((a, x) => a + x[1], 0);
          progress = total ? loaded / total : 0; emit();
        }
      },
    });
    state = 'ready'; progress = 1; emit();
    return asr;
  })();
  loading.catch(() => { loading = null; state = 'error'; emit(); });
  return loading;
}

/** Transcribes 16 kHz mono audio spoken in `lang`. */
export async function transcribe(pcm, lang) {
  const model = await loadWhisper();
  const out = await model(pcm, { language: langInfo(lang).name.toLowerCase(), task: 'transcribe' });
  return String((out && out.text) || '').trim();
}
