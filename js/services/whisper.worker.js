// Runs Whisper in its own thread so recording and the UI never stall while it thinks.
// Messages in:  {type:'load', lib, local}            → out: {type:'progress', progress} … {type:'ready', speedMs} | {type:'error', message}
//               {type:'run', id, pcm, language}       → out: {type:'result', id, text} | {type:'error', id, message}
let asr = null;

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') {
      const { env, pipeline } = await import(data.lib + 'transformers.min.js');
      env.backends.onnx.wasm.wasmPaths = data.lib;
      env.backends.onnx.wasm.numThreads = 1;
      if (data.local) { env.allowRemoteModels = false; env.allowLocalModels = true; env.localModelPath = data.local; }
      const files = {};
      asr = await pipeline('automatic-speech-recognition', data.model, {
        dtype: 'q8', device: 'wasm',
        progress_callback: p => {
          if (p.status === 'progress' && p.total) {
            files[p.file] = [p.loaded, p.total];
            const v = Object.values(files);
            self.postMessage({ type: 'progress', progress: v.reduce((a, x) => a + x[0], 0) / v.reduce((a, x) => a + x[1], 0) });
          }
        },
      });
      const t0 = performance.now();
      try { await asr(new Float32Array(16000), { language: 'english', task: 'transcribe' }); } catch (e) { /* warm-up only */ }
      self.postMessage({ type: 'ready', speedMs: performance.now() - t0 });
    } else if (data.type === 'run') {
      const out = await asr(data.pcm, { language: data.language, task: 'transcribe' });
      self.postMessage({ type: 'result', id: data.id, text: String((out && out.text) || '').trim() });
    }
  } catch (e) {
    self.postMessage({ type: 'error', id: data.id, message: String(e && e.message || e) });
  }
};
