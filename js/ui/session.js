// The practice session: a step runner over the plan, with speech, the learner's turn, and scoring.
import { lang as langInfo, isRtl, trackColor } from '../core/languages.js';
import { buildPlan, estDur, chunkStart, nextChunkStart } from '../core/planner.js';
import { scoreSpeech, tokens } from '../core/scoring.js';
import { dayKey, stats } from '../core/stats.js';
import { S, save } from '../data/store.js';
import { getBook } from '../data/books.js';
import { speak, stopSpeaking, unlockAudio, listenOnce, recognitionBlocked, stopListening } from '../services/speech.js';
import { unlockClips, useAudio, playClip, stopClip } from '../services/audioclip.js';
import { PROFILES } from '../core/languages.js';
import { tt, num, langName, phaseText, weekdays, getUI } from '../i18n.js';
import { app, $, esc, toast, ui, isFramed, mmss } from './dom.js';
import { renderTrack } from './track.js';
import { renderHome } from './home.js';

/**
 * Session state. `token` is a cancellation token: every play/pause/skip bumps it, and any
 * async step that wakes up with a stale token stops. This keeps the runner a simple loop.
 */
let R = null;
const live = tok => R && tok === R.token;
const track = () => S.tracks[R.lang];

export async function startSession(l) {
  unlockAudio(); unlockClips(); // must run synchronously inside the click for iOS
  const t = S.tracks[l], meta = t.books[t.bookId];
  if (!meta) { toast(tt('Add or choose a book first', 'اول یک کتاب اضافه یا انتخاب کن')); return renderTrack(l); }
  const book = await getBook(l, t.bookId);
  if (!book) { toast(tt('This book\'s text isn\'t in this browser; import it again.', 'متن این کتاب در این مرورگر پیدا نشد؛ دوباره واردش کن.')); return renderTrack(l); }
  const isAudio = book.kind === 'audio';
  if (isAudio) useAudio(book.audio);
  const plan = buildPlan(t, meta, book.sentences, { wholeSentences: isAudio });
  if (plan.newCount === 0) { toast(tt('You finished this book! 🎉 Add a new one or restart it.', 'این کتاب تمام شد! 🎉 کتاب جدید اضافه کن یا از اول شروع کن.'), 5000); return renderTrack(l); }
  R = { lang: l, bookId: t.bookId, book, plan, i: 0, token: 0, playing: false, elapsed: 0, showText: true, scores: [] };
  render(); wakeLock(true);
  // the phone's back gesture / button leaves the session cleanly
  try { history.pushState({ hopopoSession: 1 }, ''); } catch (e) { /* ignore */ }
  runFrom(0);
}

function render() {
  ui.view = 'session';
  const t = track(), L = langInfo(R.lang);
  app.innerHTML = `<div class="session" style="--acc:${trackColor(R.lang, S.order.indexOf(R.lang))}">
    <header class="stop"><button class="icon" data-act="quit" aria-label="Exit">✕</button><div class="stitle">${langName(R.lang)} – ${t.level}</div><div class="timer" id="timer" dir="ltr"></div></header>
    <div class="sbar"><i id="sprog"></i></div>
    <div class="phase" id="phase"></div>
    <div class="counter" id="counter"></div>
    <div class="textcard ${/A/.test(t.level) ? 'lvl-a' : ''}" id="textcard" dir="${isRtl(R.lang) ? 'rtl' : 'ltr'}" lang="${L.tts}" style="text-align:start"></div>
    <div class="trans" id="trans" dir="auto"></div>
    <div class="heard" id="heard"></div>
    <div class="gap" id="gap"><div class="gapbar"><i id="gapfill"></i></div><span id="gaptext">${tt('Your turn — repeat it aloud', 'نوبت توئه — بلند تکرار کن')}</span></div>
    <div class="controls" dir="ltr">
      <button class="icon big" data-act="prev" aria-label="Previous">⏮</button>
      <button class="icon big" data-act="replay" aria-label="Replay">⟲</button>
      <button class="play" data-act="toggle" id="playbtn" aria-label="Play/Pause">⏸</button>
      <button class="icon big" data-act="next" aria-label="Next">⏭</button>
    </div>
    <div class="tools">
      <button class="chip" data-act="toggletext" id="ttext"></button>
      <a class="chip" id="trlink" target="_blank" rel="noopener">${tt('Translate sentence', 'ترجمهٔ جمله')} ↗</a>
      <button class="chip" data-act="rec" id="recbtn">🎙 ${tt('Record myself', 'ضبط صدای من')}</button>
      <button class="chip hidden" data-act="playrec" id="playrec">▶ ${tt('My recording', 'صدای من')}</button>
    </div>
    <div class="lookup hidden" id="lookup"></div>
  </div>`;
  update();
}

/** Target language for translation links: Persian for Persian UI, else the device language (or English). */
function translateTo(l) {
  if (getUI() === 'fa') return 'fa';
  const dev = (navigator.language || 'en').slice(0, 2);
  return dev !== l ? dev : (l === 'en' ? 'de' : 'en');
}

/* ---------- recorded audio (audio books) vs. speech synthesis ---------- */
const isAudioBook = () => R.book && R.book.kind === 'audio';
const translationOf = c => (R.book && R.book.translations && R.book.translations[c.sent]) || '';
/** Recorded audio is already at the generator's lesson speed: early phases play it slightly slower, never faster. */
function audioRate(r) {
  const prof = PROFILES[track().level], top = Math.max(prof.finalRate, ...prof.phases.map(p => p.r));
  return Math.max(.5, Math.min(1.5, (r / top) * (track().speed || 1)));
}
/** How long the model sentence takes at this rate (sizes the learner's turn). */
const voiceDur = (c, r) => isAudioBook() ? (R.book.clips[c.sent][1] - R.book.clips[c.sent][0]) / audioRate(r) : estDur(c.text, r, R.lang);
function voice(c, r) {
  if (!isAudioBook()) return speak(c.text, r, track(), highlight);
  const [a, b] = R.book.clips[c.sent];
  return playClip(a, b, audioRate(r), p => highlight(Math.floor(p * c.text.length)));
}

const curStep = () => R.plan.steps[Math.min(R.i, R.plan.steps.length - 1)];

function update() {
  if (ui.view !== 'session') return;
  const st = curStep(), c = R.plan.chunks[st.k], key = st.sec === 'main' ? (st.ph.blind ? 'blind' : st.ph.t) : st.sec;
  const [title, desc] = phaseText(key);
  $('#phase').innerHTML = `<b>${title}${st.ph.t === 'check' ? tt(` (try ${num(st.ph.n)} of ${num(st.ph.of)})`, ` (تلاش ${num(st.ph.n)} از ${num(st.ph.of)})`) : ''}</b><small>${desc}</small>`;
  const firstNew = R.plan.chunks.length - R.plan.newCount;
  $('#counter').textContent = st.sec === 'review' ? tt('Review', 'مرور')
    : `${st.sec === 'final' ? tt('Continuous pass – ', 'دور پیوسته – ') : ''}${tt(`Chunk ${num(st.k - firstNew + 1)} of ${num(R.plan.newCount)}`, `تکهٔ ${num(st.k - firstNew + 1)} از ${num(R.plan.newCount)}`)}`;
  const tc = $('#textcard');
  if (tc.dataset.k !== String(st.k)) { tc.dataset.k = st.k; tc.innerHTML = '<p class="tx">' + wordsHtml(c.text) + '</p>'; tc.classList.remove('peek'); }
  const hidden = !R.showText || !!st.ph.blind;
  tc.classList.toggle('blind', hidden);
  const tr = $('#trans'); tr.textContent = translationOf(c); tr.classList.toggle('blindtrans', hidden && !tc.classList.contains('peek'));
  $('#ttext').textContent = R.showText ? tt('🙈 Hide text', '🙈 پنهان کردن متن') : tt('👁 Show text', '👁 نمایش متن');
  $('#trlink').href = `https://translate.google.com/?sl=${R.lang}&tl=${translateTo(R.lang)}&text=${encodeURIComponent(c.text)}&op=translate`;
  $('#playbtn').textContent = R.playing ? '⏸' : '▶';
  $('#sprog').style.width = (100 * R.i / R.plan.steps.length) + '%';
  updTimer();
}
const updTimer = () => { const el = $('#timer'); if (el) el.textContent = `${mmss(R.elapsed)} / ${mmss(track().minutes * 60)}`; };

/** Text as spans with character offsets (for karaoke highlighting and per-word marks). */
function wordsHtml(text) {
  const re = /\S+/g; let html = '', last = 0, m;
  while ((m = re.exec(text))) { html += esc(text.slice(last, m.index)) + `<span class="w" data-s="${m.index}" data-e="${m.index + m[0].length}">${esc(m[0])}</span>`; last = m.index + m[0].length; }
  return html;
}
const spans = () => document.querySelectorAll('#textcard .w');
const highlight = ci => spans().forEach(s => s.classList.toggle('hl', ci >= +s.dataset.s && ci < +s.dataset.e));
const clearHl = () => spans().forEach(s => s.classList.remove('hl'));
function showMarks(marks, text) {
  // For space-less scripts marks are per character; collapse to the span level (worst mark wins).
  const ws = [...spans()];
  if (marks.length === ws.length) { ws.forEach((s, i) => { s.classList.remove('ok', 'close', 'bad'); s.classList.add(marks[i]); }); return; }
  let k = 0; const rank = { ok: 0, close: 1, bad: 2 };
  ws.forEach(s => { const n = tokens(s.textContent, R.lang).length; const part = marks.slice(k, k + n); k += n; const worst = part.reduce((a, x) => rank[x] > rank[a] ? x : a, 'ok'); s.classList.remove('ok', 'close', 'bad'); s.classList.add(worst); });
}
function clearMarks() { spans().forEach(s => s.classList.remove('ok', 'close', 'bad')); const h = $('#heard'); if (h) h.innerHTML = ''; }

function wait(ms, tok, onTick) {
  return new Promise(res => { const t0 = Date.now(); const iv = setInterval(() => { const el = Date.now() - t0; if (onTick) onTick(el / ms); if (!live(tok) || el >= ms) { clearInterval(iv); res(); } }, 50); });
}

/* ---------- the runner ---------- */

async function runFrom(i) {
  const tok = ++R.token; R.i = i; R.playing = true; update();
  while (R.i < R.plan.steps.length) {
    if (!live(tok)) return;
    commitProgress(); update();
    const st = R.plan.steps[R.i], c = R.plan.chunks[st.k];
    clearMarks();
    await voice(c, st.ph.r);
    clearHl();
    if (!live(tok)) return;
    if (st.ph.t === 'check') {
      const green = await learnerTurn(st, c, tok); if (!live(tok)) return;
      if (green) R.i = afterGreen(R.i);
    }
    if (st.ph.t === 'echo') { await silentGap(c, st, tok); if (!live(tok)) return; }
    await wait(600, tok);
    if (!live(tok)) return;
    R.i++;
  }
  finish();
}

async function silentGap(c, st, tok) {
  const g = $('#gap'); g.classList.add('on');
  await wait((voiceDur(c, st.ph.r) * 1.25 + 1) * 1000, tok, p => { const f = $('#gapfill'); if (f) f.style.width = (100 - 100 * p) + '%'; });
  g.classList.remove('on');
}

/**
 * Listen to the learner, score, and show per-word marks.
 * Without a usable microphone it falls back to a silent gap. "Heard nothing" is never shown as all-red:
 * phones often fail to pick up speech, and marking the learner wrong for that is discouraging and wrong.
 * After 3 failed turns in a row the check is switched off for the rest of the session.
 */
const GREEN = 85; // score at which a sentence counts as said correctly

/**
 * What happens after a green check (track setting `afterGreen`):
 *  'shadow' (default) – skip the remaining checks of this sentence but still shadow it (speak along)
 *  'next'             – skip everything left for this sentence
 *  'repeat'           – skip nothing
 * Returns the index of the last step to skip (the runner then advances by one).
 */
function greenMode() { const t = track(); return t.afterGreen || (t.skipOnGreen === false ? 'repeat' : 'shadow'); }
function afterGreen(i) {
  const steps = R.plan.steps, mode = greenMode();
  if (mode === 'next') return nextChunkStart(steps, i) - 1;
  if (mode === 'shadow') { const { k, sec } = steps[i]; while (steps[i + 1] && steps[i + 1].k === k && steps[i + 1].sec === sec && steps[i + 1].ph.t === 'check') i++; }
  return i;
}
async function learnerTurn(st, c, tok) {
  if (R.noCheck) return silentGap(c, st, tok);
  const dur = voiceDur(c, st.ph.r), g = $('#gap'), gt = $('#gaptext'), hd = $('#heard');
  await wait(300, tok); if (!live(tok)) return;   // let the speaker audio release before the mic opens (iOS)
  gt.textContent = tt('🎙 Now say it… I\'m listening', '🎙 حالا بگو… گوش می‌دهم'); gt.classList.add('listening'); $('#gapfill').style.width = '100%'; g.classList.add('on');
  const heard = await listenOnce(R.lang, (dur * 1.8 + 5) * 1000, () => !live(tok), t => { hd.innerHTML = `<span class="lbl">${tt('I heard: ', 'شنیدم: ')}</span><span class="txt">${esc(t)}</span>`; });
  g.classList.remove('on'); gt.classList.remove('listening'); gt.textContent = tt('Your turn — repeat it aloud', 'نوبت توئه — بلند تکرار کن');
  if (!live(tok)) return;
  if (heard === null) {
    R.noCheck = true;
    toast(recognitionBlocked() ? tt('Microphone permission was denied; continuing with repeat pauses.', 'اجازهٔ میکروفون داده نشد؛ با مکث برای تکرار ادامه می‌دهیم.')
      : isFramed ? tt('The speech check only works in the installed app; here you just get a pause to repeat.', 'بررسی گفتار فقط در نسخهٔ نصب‌شدهٔ اپ کار می‌کند؛ اینجا فقط فرصت تکرار داری.')
      : tt('This browser has no speech recognition; continuing with repeat pauses.', 'این مرورگر تشخیص گفتار ندارد؛ با مکث برای تکرار ادامه می‌دهیم.'), 5500);
    return silentGap(c, st, tok);
  }
  if (!heard.text) {
    R.srFails = (R.srFails || 0) + 1;
    hd.innerHTML = `<span class="lbl">${heard.error
      ? tt(`The phone couldn't listen (${esc(heard.error)}).`, `گوشی نتوانست گوش بدهد (${esc(heard.error)}).`)
      : tt('I didn\'t catch that — no problem, keep going.', 'صدایت را نگرفتم — اشکالی ندارد، ادامه بده.')}</span>`;
    if (R.srFails >= 3) {
      R.noCheck = true;
      toast(tt('Speech check isn\'t picking you up on this phone, so it\'s off for this session. Try "Test the speech check" in Book & settings.', 'بررسی گفتار روی این گوشی صدایت را نمی‌گیرد، برای همین در این جلسه خاموش شد. در «کتاب و تنظیمات» دکمهٔ «تست بررسی گفتار» را امتحان کن.'), 7000);
    }
    await wait(1400, tok);
    return;
  }
  R.srFails = 0;
  const res = scoreSpeech(c.text, heard.text, R.lang);
  showMarks(res.marks, c.text);
  const col = res.score >= GREEN ? 'var(--ok)' : res.score >= 60 ? 'var(--de)' : 'var(--danger)';
  hd.innerHTML = `<span class="lbl">${tt('I heard: ', 'شنیدم: ')}</span><span class="txt">${esc(heard.text)}</span><span class="score" style="background:${col}">${num(res.score)}${tt('%', '٪')}</span>`;
  R.scores.push({ k: st.k, score: res.score });
  const green = res.score >= GREEN;
  const mode = greenMode();
  if (green && mode !== 'repeat') hd.insertAdjacentHTML('beforeend', `<div class="lbl" style="margin-top:4px">✅ ${mode === 'next' ? tt('Great — next sentence', 'عالی — جملهٔ بعد') : tt('Great — now speak along', 'عالی — حالا همزمان بخوان')}</div>`);
  await wait(green ? 1300 : 2800, tok);
  return green;
}

/** Stops everything that makes sound or listens. Never throws: leaving a session must always work. */
function stopAudio() {
  if (!R) return;
  R.token++;
  for (const f of [stopSpeaking, stopClip, stopListening]) { try { f(); } catch (e) { /* keep going */ } }
  try { const g = $('#gap'); if (g) g.classList.remove('on'); clearHl(); } catch (e) { /* ignore */ }
}
function pause() { stopAudio(); R.playing = false; update(); }

/** Progress is saved per sentence as the runner reaches it, so leaving mid-session loses nothing. */
function commitProgress() {
  const st = R.plan.steps[R.i]; if (st.sec !== 'main') return;
  const meta = track().books[R.bookId], s = R.plan.chunks[st.k].sent;
  if (meta && s > meta.pos) { meta.pos = s; save(); }
}

function saveSession(complete) {
  const t = track(), meta = t.books[R.bookId];
  if (meta && !R.extra) {
    if (complete) meta.pos = Math.max(meta.pos, R.plan.end);
    if (meta.pos > R.plan.start) meta.last = [R.plan.start, meta.pos];
  }
  const sec = Math.round(R.elapsed);
  if (sec >= 20) t.history.push({ d: dayKey(), sec, n: meta && !R.extra ? meta.pos - R.plan.start : 0 });
  if (t.history.length > 800) t.history = t.history.slice(-800);
  save();
}

function finish() {
  if (ui.view !== 'session') return;
  stopAudio(); R.playing = false; wakeLock(false);
  saveSession(true); renderDone();
}

function renderDone() {
  ui.view = 'done';
  const t = track(), st = stats(t, weekdays());
  app.innerHTML = `<div class="done" style="--acc:${trackColor(R.lang, S.order.indexOf(R.lang))}">
    <div class="big">✓</div><h2>${tt(`Well done! ${langName(R.lang)} session complete`, `آفرین! جلسهٔ ${langName(R.lang)} تمام شد`)}</h2><p class="sub">${tt('The rest of the book is ready for tomorrow.', 'ادامهٔ کتاب برای فردا آماده است.')}</p>
    <div class="stats"><div><b>${num(Math.max(1, Math.round(R.elapsed / 60)))}</b><small>${tt('minutes', 'دقیقه')}</small></div><div><b>${num(R.plan.newCount)}</b><small>${tt('new chunks', 'تکهٔ جدید')}</small></div><div><b>🔥 ${num(st.streak)}</b><small>${tt('day streak', 'روز پشت‌سرهم')}</small></div></div>
    ${accuracyHtml()}
    <div class="btns"><button class="primary" data-act="again">⟲ ${tt('One more continuous shadowing pass', 'یک دور دیگر شادوینگ پیوسته')}</button><button class="ghost" data-act="home">${tt('Back to home', 'بازگشت به خانه')}</button></div></div>`;
}

function accuracyHtml() {
  if (!R.scores.length) return '';
  const avg = Math.round(R.scores.reduce((a, x) => a + x.score, 0) / R.scores.length);
  const last = {}; R.scores.forEach(x => { last[x.k] = x.score; });
  const hard = Object.entries(last).filter(([, v]) => v < 70).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k]) => R.plan.chunks[+k].text);
  const dir = isRtl(R.lang) ? 'rtl' : 'ltr';
  return `<div class="card" style="text-align:start"><b>${tt(`Speech accuracy: ${num(avg)}%`, `دقت گفتار: ${num(avg)}٪`)}</b>${hard.length ? `<p class="sub" style="margin:6px 0">${tt('Sentences that need more practice:', 'جمله‌هایی که بیشتر تمرین بخواهند:')}</p>${hard.map(h => `<p class="preview" dir="${dir}">${esc(h)}</p>`).join('')}` : `<p class="sub">${tt('Great — every sentence was said well.', 'عالی بود؛ همهٔ جمله‌ها خوب گفته شدند.')}</p>`}</div>`;
}

function againFinal() {
  const steps = R.plan.steps.filter(s => s.sec === 'final');
  if (!steps.length) return renderHome();
  R = { ...R, plan: { ...R.plan, steps }, i: 0, token: 0, playing: false, elapsed: 0, extra: true, scores: [] };
  unlockAudio(); unlockClips(); render(); wakeLock(true); runFrom(0);
}

/** Leave the session. Each step is guarded so the learner always gets back home. */
export function exitSession() {
  document.getElementById('quitov')?.remove();
  try { stopAudio(); } catch (e) { /* ignore */ }
  try { wakeLock(false); } catch (e) { /* ignore */ }
  try { if (R && ui.view === 'session') saveSession(false); } catch (e) { /* ignore */ }
  renderHome();
}
window.addEventListener('popstate', () => { if (ui.view === 'session') exitSession(); });

function askQuit() {
  pause();
  const o = document.createElement('div'); o.className = 'overlay'; o.id = 'quitov';
  o.innerHTML = `<div class="sheet"><b>${tt('End the session?', 'جلسه را تمام می‌کنی؟')}</b><p>${tt('Your progress up to this sentence is saved and you\'ll continue from here next time.', 'پیشرفتت تا همین جمله ذخیره می‌شود و دفعهٔ بعد از همین‌جا ادامه می‌دهی.')}</p>
    <div class="btns"><button class="ghost" data-act="resume">${tt('Keep going', 'ادامه بده')}</button><button class="primary" style="--acc:var(--danger)" data-act="exit">${tt('Exit', 'خروج')}</button></div></div>`;
  document.body.appendChild(o);
}

/* ---------- screen wake lock & timer ---------- */
let wl = null;
async function wakeLock(on) { try { if (on && navigator.wakeLock) wl = await navigator.wakeLock.request('screen'); else if (!on && wl) { await wl.release(); wl = null; } } catch (e) { /* unsupported */ } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ui.view === 'session' && R && R.playing) wakeLock(true); });
setInterval(() => { if (ui.view === 'session' && R && R.playing) { R.elapsed++; updTimer(); } }, 1000);

/* ---------- self-recording (installed app only; the mic is blocked in embedded previews) ---------- */
let rec = null, recURL = null, recAudio = null;
async function toggleRec() {
  const btn = $('#recbtn');
  if (rec && rec.state === 'recording') { rec.stop(); return; }
  try {
    if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('no recorder');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const parts = []; rec = new MediaRecorder(stream);
    rec.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (recURL) URL.revokeObjectURL(recURL);
      recURL = URL.createObjectURL(new Blob(parts, { type: rec.mimeType || 'audio/webm' }));
      const b = $('#recbtn'); if (b) { b.classList.remove('rec'); b.textContent = tt('🎙 Record again', '🎙 ضبط دوباره'); }
      const p = $('#playrec'); if (p) p.classList.remove('hidden');
    };
    rec.start(); btn.classList.add('rec'); btn.textContent = tt('⏹ Stop recording', '⏹ پایان ضبط');
    if (!R.playing) runFrom(chunkStart(R.plan.steps, R.i));
  } catch (e) { toast(tt('The microphone isn\'t available here. Open the installed app and allow the microphone.', 'میکروفون اینجا در دسترس نیست. نسخهٔ نصب‌شدهٔ اپ را باز کن و اجازهٔ میکروفون بده.'), 4500); }
}
function playRec() { if (!recURL) return; pause(); if (recAudio) recAudio.pause(); recAudio = new Audio(recURL); recAudio.play().catch(() => toast(tt('Could not play', 'پخش ممکن نشد'))); }

/* ---------- word lookup ---------- */
function showLookup(word) {
  const w = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''); if (!w) return;
  pause();
  const e = encodeURIComponent(w), l = R.lang;
  const links = [[tt('Translate', 'ترجمه'), `https://translate.google.com/?sl=${l}&tl=${translateTo(l)}&text=${e}&op=translate`]];
  if (l === 'en') links.push(['Cambridge', `https://dictionary.cambridge.org/dictionary/english/${e}`]);
  else if (l === 'de') links.push(['dict.cc', `https://www.dict.cc/?s=${e}`], ['LEO', `https://dict.leo.org/german-english/${e}`]);
  else links.push(['Wiktionary', `https://en.wiktionary.org/wiki/${e}#${encodeURIComponent(langInfo(l).name)}`]);
  const box = $('#lookup');
  box.innerHTML = `<div class="trow"><div class="word" dir="auto">${esc(w)}</div><button class="icon" data-act="closelookup">✕</button></div>
    <div class="links">${links.map(([n, u]) => `<a class="chip" href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join('')}<button class="chip" data-act="sayword" data-w="${esc(w)}">🔊 ${tt('Say it', 'تلفظ')}</button></div>`;
  box.classList.remove('hidden');
}

/** Clicks inside the text card: peek at hidden text, or look up a word. Returns true if handled. */
export function onTextClick(ev) {
  const tc = ev.target.closest('#textcard'); if (!tc) return false;
  if (tc.classList.contains('blind') && !tc.classList.contains('peek')) { tc.classList.add('peek'); return true; }
  const w = ev.target.closest('.w'); if (w) { showLookup(w.textContent); return true; }
  return false;
}

export const actions = {
  start: el => startSession(el.dataset.lang),
  toggle: () => R.playing ? pause() : runFrom(R.i),
  replay: () => { stopAudio(); runFrom(R.i); },
  next: () => { const i = nextChunkStart(R.plan.steps, R.i); stopAudio(); if (i >= R.plan.steps.length) { R.i = i; finish(); } else runFrom(i); },
  prev: () => { let s = chunkStart(R.plan.steps, R.i); if (R.i === s && s > 0) s = chunkStart(R.plan.steps, s - 1); stopAudio(); runFrom(s); },
  toggletext: () => { R.showText = !R.showText; update(); },
  rec: () => toggleRec(),
  playrec: () => playRec(),
  closelookup: () => $('#lookup').classList.add('hidden'),
  sayword: el => speak(el.dataset.w, .8, track()),
  quit: () => { try { askQuit(); } catch (e) { exitSession(); } },
  resume: () => { $('#quitov')?.remove(); runFrom(chunkStart(R.plan.steps, R.i)); },
  exit: () => exitSession(),
  again: () => againFinal(),
  home: () => { stopAudio(); renderHome(); },
};
