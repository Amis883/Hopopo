// Records one spoken answer from the microphone with a simple voice-activity detector (VAD).
// Used by the in-app speech recognizer: unlike the phone's own recognition, getUserMedia works
// in installed iPhone web apps. The mic is opened per answer and closed right after, so the
// phone's audio output isn't kept in "call" mode while the app speaks.

let ctx = null;

/** Create/resume the AudioContext. Call synchronously inside a tap (iOS). */
export function primeAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* unsupported */ }
}

export const micSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));

/** Ask for microphone permission early (from the Start tap) so the prompt doesn't appear mid-sentence. */
export async function requestMic() {
  const s = await navigator.mediaDevices.getUserMedia({ audio: true });
  s.getTracks().forEach(t => t.stop());
}

function resample(data, from, to) {
  if (from === to) return data;
  const ratio = from / to, n = Math.floor(data.length / ratio), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {                      // average over the source window (cheap low-pass)
    const a = Math.floor(i * ratio), b = Math.min(data.length, Math.floor((i + 1) * ratio));
    let s = 0; for (let j = a; j < b; j++) s += data[j];
    out[i] = s / Math.max(1, b - a);
  }
  return out;
}

/**
 * Waits for the learner to speak and records until they stop.
 * Resolves { pcm: Float32Array (16 kHz mono), heard: boolean, error?: string }.
 * - speech starts when the level rises clearly above the background noise
 * - it ends after `silenceMs` of quiet, or at `maxMs`
 */
export async function recordUtterance({ maxMs = 12000, silenceMs = 900, isCancelled = () => false, onLevel, onSpeech } = {}) {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); }
  catch (e) { return { pcm: new Float32Array(0), heard: false, error: e && e.name === 'NotAllowedError' ? 'mic-denied' : 'mic-unavailable' }; }
  primeAudio();
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* ignore */ } }
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(2048, 1, 1);           // ~43 ms frames: quicker start/stop detection
  const rate = ctx.sampleRate, chunks = [], pre = [];
  let started = false, lastVoice = 0, floor = null, done = false, audioMs = 0;
  const t0 = performance.now();
  /** 16 kHz copy of everything recorded so far (for live transcription while the learner speaks). */
  const soFar = () => { let len = 0; for (const c of chunks) len += c.length; const a = new Float32Array(len); let o = 0; for (const c of chunks) { a.set(c, o); o += c.length; } return resample(a, rate, 16000); };
  return new Promise(res => {
    const finish = () => {
      if (done) return; done = true; clearInterval(watch);
      try { proc.disconnect(); src.disconnect(); } catch (e) { /* ignore */ }
      stream.getTracks().forEach(t => t.stop());
      let len = 0; for (const c of chunks) len += c.length;
      const all = new Float32Array(len); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
      res({ pcm: resample(all, rate, 16000), heard: started });
    };
    proc.onaudioprocess = e => {
      if (done) return;
      const d = new Float32Array(e.inputBuffer.getChannelData(0));
      let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
      audioMs += d.length / rate * 1000;                           // time measured in recorded audio
      const rms = Math.sqrt(sum / d.length), now = audioMs;
      if (floor === null) floor = rms; else if (!started) floor = floor * 0.85 + rms * 0.15;
      const thr = Math.max(0.01, floor * 2.5);
      if (onLevel) onLevel(Math.min(1, rms / (thr * 2)));
      if (!started) {
        pre.push(d); if (pre.length > 14) pre.shift();             // keep ~600 ms before speech starts, so the first word isn't cut
        if (rms > thr && now > 80) { started = true; chunks.push(...pre); lastVoice = now; }
      } else {
        chunks.push(d);
        if (rms > thr) lastVoice = now;
        if (onSpeech) onSpeech(soFar, now);
        if (now - lastVoice > silenceMs) finish();
      }
      if (now > maxMs || performance.now() - t0 > maxMs + 3000) finish();
    };
    src.connect(proc); proc.connect(ctx.destination);            // output buffer stays silent
    const watch = setInterval(() => { if (isCancelled()) finish(); }, 100);
  });
}
