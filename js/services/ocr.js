// On-device OCR with Tesseract.js (WASM in a Web Worker). German/English data ship with the app;
// other languages are downloaded on first use (see ocr/worker-wrap.js).
import { lang as langInfo } from '../core/languages.js';
import { loadScript } from './importers.js';

let worker = null, workerCode = null, onLog = null;

async function getWorker(lang) {
  const code = langInfo(lang).ocr;
  if (worker && workerCode === code) return worker;
  if (worker) { try { await worker.terminate(); } catch (e) { /* ignore */ } worker = null; }
  if (!window.Tesseract) await loadScript('ocr/tesseract.min.js');
  const abs = p => new URL(p, location.href).href;
  worker = await Tesseract.createWorker(code, 1, {
    workerPath: abs('ocr/worker-wrap.js'), corePath: abs('ocr/core'), langPath: abs('ocr/lang'),
    workerBlobURL: false, cacheMethod: 'none', logger: m => { if (onLog) onLog(m); },
  });
  workerCode = code;
  return worker;
}

/**
 * Recognises a list of pages. `sources` are async functions returning a canvas, so pages are
 * rendered one at a time (keeps memory low on phones).
 * @returns {{text: string, pages: number, cancelled: boolean}}
 */
export async function recognize(lang, sources, { onPage, onProgress, isCancelled }) {
  const w = await getWorker(lang);
  const out = []; let n = 0, cancelled = false;
  try {
    for (let i = 0; i < sources.length; i++) {
      if (isCancelled()) { cancelled = true; break; }
      onLog = m => { if (m.status === 'recognizing text' && onProgress) onProgress(i, m.progress); };
      if (onPage) onPage(i);
      const { data } = await w.recognize(await sources[i]());
      out.push((data.text || '').trim()); n++;
    }
  } finally { onLog = null; }
  return { text: out.join('\n\n'), pages: n, cancelled };
}
