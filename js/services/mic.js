// Records spoken answers from the microphone with a simple voice-activity detector (VAD),
// for the in-app speech recognizer (getUserMedia works in installed iPhone web apps, where the
// phone's own recognizer returns nothing).
//
// iPhone lessons learned (from testing on a real device):
//  - Echo cancellation / noise suppression switch iOS into "voice call" processing, which ducks or
//    mutes other audio: the app's own speaker went silent. We record with processing OFF — the mic
//    is only listened to while the app is quiet, so there is no echo to cancel.
//  - Installed web apps show the permission prompt on every getUserMedia call, so one stream is
//    opened per practice session (from the Start tap) and reused for every answer.

const CONSTRAINTS = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } };

let ctx = null;
let session = null;   // { stream, src, proc } kept open for a practice session
let sink = null;      // current consumer of audio frames (set while recording an answer)

/** Create/resume the AudioContext. Call synchronously inside a tap (iOS). */
export function primeAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* unsupported */ }
}

export const micSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));

const alive = s => s && s.stream.getAudioTracks().some(t => t.readyState === 'live');

function attach(stream) {
  primeAudio();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(2048, 1, 1);     // ~43 ms frames
  proc.onaudioprocess = e => { if (sink) sink(new Float32Array(e.inputBuffer.getChannelData(0))); };
  src.connect(proc); proc.connect(ctx.destination);         // output buffer stays silent
  return { stream, src, proc };
}

function detach(s) {
  if (!s) return;
  try { s.proc.disconnect(); s.src.disconnect(); } catch (e) { /* ignore */ }
  s.stream.getTracks().forEach(t => t.stop());
}

/** Opens one microphone stream for the whole practice session (one permission prompt). */
export async function openSessionMic() {
  if (alive(session)) return;
  detach(session); session = null;
  const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
  session = attach(stream);
}
export function closeSessionMic() { detach(session); session = null; sink = null; }

/** Kept for the settings test: ask for permission without keeping the mic open. */
export async function requestMic() { const s = await navigator.mediaDevices.getUserMedia(CONSTRAINTS); s.getTracks().forEach(t => t.stop()); }

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
 * Uses the session stream when one is open, otherwise opens (and closes) one just for this answer.
 * Resolves { pcm: Float32Array (16 kHz mono), heard: boolean, error?: string }.
 */
export async function recordUtterance({ maxMs = 12000, silenceMs = 900, isCancelled = () => false, onLevel, onSpeech } = {}) {
  let own = null;
  if (!alive(session)) {
    try { own = attach(await navigator.mediaDevices.getUserMedia(CONSTRAINTS)); }
    catch (e) { return { pcm: new Float32Array(0), heard: false, error: e && e.name === 'NotAllowedError' ? 'mic-denied' : 'mic-unavailable' }; }
  }
  primeAudio();
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* ignore */ } }
  const rate = ctx.sampleRate, chunks = [], pre = [];
  let started = false, lastVoice = 0, floor = null, done = false, audioMs = 0;
  const t0 = performance.now();
  const soFar = () => { let len = 0; for (const c of chunks) len += c.length; const a = new Float32Array(len); let o = 0; for (const c of chunks) { a.set(c, o); o += c.length; } return resample(a, rate, 16000); };
  return new Promise(res => {
    const finish = () => {
      if (done) return; done = true; clearInterval(watch); sink = null;
      if (own) detach(own);
      res({ pcm: soFar(), heard: started });
    };
    sink = d => {
      if (done) return;
      let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
      audioMs += d.length / rate * 1000;                          // time measured in recorded audio
      const rms = Math.sqrt(sum / d.length), now = audioMs;
      if (floor === null) floor = rms; else if (!started) floor = floor * 0.85 + rms * 0.15;
      const thr = Math.max(0.009, floor * 3);                    // raw mic (no AGC): slightly lower absolute floor
      if (onLevel) onLevel(Math.min(1, rms / (thr * 2)));
      if (!started) {
        pre.push(d); if (pre.length > 14) pre.shift();            // keep ~600 ms before speech starts
        if (rms > thr && now > 80) { started = true; chunks.push(...pre); lastVoice = now; }
      } else {
        chunks.push(d);
        if (rms > thr) lastVoice = now;
        if (onSpeech) onSpeech(soFar, now);
        if (now - lastVoice > silenceMs) finish();
      }
      if (now > maxMs) finish();
    };
    const watch = setInterval(() => { if (isCancelled() || performance.now() - t0 > maxMs + 3000) finish(); }, 100);
  });
}
