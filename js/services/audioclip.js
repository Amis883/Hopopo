// Plays parts of a recorded lesson (MP3) — used for audio books imported from the audio generator.
// One shared <audio> element: iOS only lets an element play programmatically after it was
// started once from a user gesture, so unlock() is called synchronously in the click handler.

let el = null, url = null, blob = null, stopCurrent = null;

function silentWav() {
  const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/** Call synchronously inside a click. */
export function unlockClips() {
  if (!el) el = new Audio();
  if (!url) { el.src = silentWav(); const p = el.play(); if (p) p.then(() => el.pause()).catch(() => {}); }
}

export function useAudio(b) {
  if (!el) el = new Audio();
  if (blob === b) return;
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(b); blob = b; el.src = url; el.preload = 'auto';
}

/** Plays [start, end) at `rate` (pitch preserved); `onProgress(0..1)` drives the text highlight. */
export function playClip(start, end, rate, onProgress) {
  return new Promise(res => {
    if (!el || !url) { res(); return; }
    let done = false;
    const fin = () => { if (done) return; done = true; clearInterval(iv); clearTimeout(to); try { el.pause(); } catch (e) { /* ignore */ } stopCurrent = null; res(); };
    const dur = Math.max(.1, end - start);
    el.playbackRate = rate; el.preservesPitch = true;
    try { el.currentTime = start; } catch (e) { /* not seekable yet */ }
    const p = el.play(); if (p) p.catch(fin);
    const iv = setInterval(() => {
      if (onProgress) onProgress(Math.max(0, Math.min(1, (el.currentTime - start) / dur)));
      if (el.currentTime >= end - 0.02 || el.ended) fin();
    }, 30);
    const to = setTimeout(fin, (dur / rate + 3) * 1000);
    stopCurrent = fin;
  });
}

export function stopClip() { if (stopCurrent) stopCurrent(); }
