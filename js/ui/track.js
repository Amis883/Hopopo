// Track screen: books, where the next session starts, and per-language settings.
import { PROFILES, LEVELS, lang as langInfo, isRtl, trackColor } from '../core/languages.js';
import { S, save, removeTrack } from '../data/store.js';
import { getBook, deleteBook, forgetBooks } from '../data/books.js';
import { voicesFor, voiceFor, onVoicesChanged, speak, unlockAudio, recognitionSupported, listenOnce, recognitionBlocked } from '../services/speech.js';
import { engineFor } from '../services/engine.js';
import { primeAudio, recordUtterance } from '../services/mic.js';
import { loadWhisper, transcribe, whisperState, onWhisperState } from '../services/whisper.js';
import { tt, num, langName, getUI } from '../i18n.js';
import { app, $, esc, toast, ui, isFramed, confirmTap as confirmed } from './dom.js';
import { importPanel } from './importFlow.js';
import { renderHome } from './home.js';

const dirOf = l => isRtl(l) ? 'rtl' : 'ltr';

export function profileHint(level) {
  const p = PROFILES[level], n = p.phases.length;
  const echo = p.phases.filter(x => x.t === 'echo').length, sh = p.phases.filter(x => x.t === 'shadow').length, blind = p.phases.some(x => x.blind);
  if (getUI() === 'fa') return `جمله‌ها به تکه‌های حداکثر حدود ${num(p.maxWords)} کلمه شکسته می‌شوند. هر تکه ${num(n)} مرحله دارد: یک بار گوش‌دادن${echo ? `، ${num(echo)} بار تکرار بعد از صدا` : ''}، ${num(sh)} بار شادوینگ همزمان${blind ? ' (آخری بدون متن)' : ''}. اگر «بررسی گفتار» روشن باشد، به‌جای تکرارِ ساده، هر تکه را می‌گویی و اپ درست/غلط هر کلمه را نشان می‌دهد. در پایان، کل متن آن روز یک بار پیوسته شادوینگ می‌شود و جلسهٔ بعد با مرور چند جملهٔ قبلی شروع می‌شود.`;
  return `Sentences are split into chunks of about ${p.maxWords} words at most. Each chunk has ${n} steps: listen once${echo ? `, repeat after the audio ${echo}×` : ''}, shadow along ${sh}×${blind ? ' (the last one without text)' : ''}. With the speech check on, the repeat steps are replaced by saying the chunk and seeing each word marked right or wrong. Each session ends with one continuous shadowing pass of the day's text, and the next session starts by reviewing a few sentences from last time.`;
}

export async function renderTrack(l) {
  ui.view = 'track'; ui.lang = l;
  const t = S.tracks[l], L = langInfo(l), meta = t.books[t.bookId];
  const book = meta ? await getBook(l, t.bookId) : null;
  const nextS = book ? (book.sentences[meta.pos] || tt('— Book finished —', '— کتاب تمام شد —')) : '';
  const books = Object.entries(t.books);
  const speechNote = !recognitionSupported() ? tt('This browser has no speech recognition (use Chrome on Android or Safari on iPhone).', 'این مرورگر تشخیص گفتار ندارد (Chrome اندروید یا Safari آیفون لازم است).')
    : isFramed ? tt('The speech check only works in the installed version; here you get a pause to repeat instead.', 'بررسی گفتار فقط در نسخهٔ نصب‌شده کار می‌کند؛ اینجا به‌جایش فرصت تکرار داری.')
    : tt('Asks for microphone permission the first time.', 'بار اول اجازهٔ میکروفون می‌خواهد.');
  app.innerHTML = `<div style="--acc:${trackColor(l, S.order.indexOf(l))}">
  <header class="top"><button class="icon" data-act="home" aria-label="Back">${tt('←', '→')}</button><h2 style="flex:1">${langName(l)}${L.native !== langName(l) ? ' – ' + esc(L.native) : ''}</h2><button class="langbtn" data-act="help" aria-label="${tt('Guide', 'راهنما')}">❓</button></header>
  <section class="card"><h3>${tt('Books', 'کتاب‌ها')}</h3>
    ${books.length ? books.map(([id, b]) => `<div class="bookitem ${id === t.bookId ? 'active' : ''}">
      <button data-act="selbook" data-id="${id}">${b.kind === 'audio' ? '🎧 ' : ''}<bdi>${esc(b.title)}</bdi><small>${tt(`${num(b.pos)} of ${num(b.total || 0)} sentences`, `${num(b.pos)} از ${num(b.total || 0)} جمله`)}</small></button>
      <button class="icon" data-act="sharebook" data-id="${id}" aria-label="Share">📤</button>
      <button class="icon del" data-act="delbook" data-id="${id}" aria-label="Delete">🗑</button></div>`).join('') : `<p class="sub">${tt('No books yet.', 'کتابی نیست.')}</p>`}
    ${importPanel(l, meta, books.length <= 1)}
  </section>
  ${meta ? `<section class="card"><h3>${tt('Next session starts here', 'جلسهٔ بعد از اینجا شروع می‌شود')}</h3>
    <p class="preview" dir="${dirOf(l)}">${esc(nextS)}</p>
    <div class="row"><input type="search" id="q" dir="auto" placeholder="${tt('Search the book (e.g. Lesson 2)', 'جستجو در کتاب (مثلاً Lektion 2)')}"><button class="ghost small" data-act="search">${tt('Search', 'جستجو')}</button></div>
    <div id="results" class="results"></div>
    <div class="row" style="margin-top:8px"><label>${tt('Sentence #', 'جملهٔ شمارهٔ')}</label><input type="number" id="posnum" min="1" max="${meta.total || 1}" value="${meta.pos + 1}"><button class="ghost small" data-act="setpos">${tt('Go', 'برو')}</button><button class="ghost small" data-act="restart">${tt('Restart', 'از اول')}</button></div>
  </section>` : ''}
  <section class="card"><h3>${tt(`${langName(l)} settings`, `تنظیمات ${langName(l)}`)}</h3>
    <div class="field"><span>${tt('Practice style', 'روش تمرین')}</span><select id="style">${[
      ['simple', tt('Simple: hear it once → say it → next (one retry if below 80%)', 'ساده: یک بار بشنو ← بگو ← بعدی (زیر ۸۰٪ یک بار دیگر)')],
      ['full', tt('Full shadowing: listen, repeat, speak along, continuous pass', 'شادوینگ کامل: گوش، تکرار، همزمان‌خوانی، دور پیوسته')],
    ].map(([v, label]) => `<option value="${v}" ${(t.style || 'simple') === v ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
    <div class="field"><span>${tt('My level', 'سطح من')}</span><select id="level">${LEVELS.map(k => `<option ${k === t.level ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
    <div class="field"><span>${tt('Session length', 'مدت هر جلسه')} <output id="minout">${tt(`${num(t.minutes)} min`, `${num(t.minutes)} دقیقه`)}</output></span><input type="range" id="minutes" min="10" max="20" step="1" value="${t.minutes}"></div>
    <div class="field"><span>${tt('Voice speed', 'سرعت صدا')} <output id="spout">×${num(t.speed)}</output></span><input type="range" id="speed" min="0.7" max="1.3" step="0.05" value="${t.speed}"></div>
    <div class="field"><span>${tt(`${langName(l)} voice`, `صدای ${langName(l)}`)}</span><div class="row"><select id="voice" style="margin:0"></select><button class="ghost small" data-act="testvoice">${tt('Test', 'تست')}</button></div><div id="vwarn" class="msg warn"></div></div>
    <label class="check"><input type="checkbox" id="check" ${t.check ? 'checked' : ''}> 🎙 ${tt('Listen to me after each sentence and mark right/wrong', 'بعد از هر جمله صدایم را بشنود و درست/غلط را نشان بدهد')}</label>
    <div class="field" style="margin-top:6px"><span>${tt('Times to say and check each sentence', 'تعداد دفعه‌های گفتن و بررسی هر جمله')}</span><select id="checkReps">${[1, 2, 3].map(n => `<option value="${n}" ${n === (t.checkReps || 2) ? 'selected' : ''}>${tt(`${num(n)}×`, `${num(n)} بار`)}</option>`).join('')}</select>
      <div class="msg">${speechNote}</div>
      <button class="ghost small" style="margin-top:6px" data-act="speechtest">🎙 ${tt('Test the speech check', 'تست بررسی گفتار')}</button>
      <div class="sptest" id="sptest"></div></div>
    <div class="field"><span>🧠 ${tt('Speech recognition', 'تشخیص گفتار')}</span><select id="srEngine">${[
      ['auto', tt('Automatic (recommended)', 'خودکار (پیشنهادی)')],
      ['whisper', tt('In-app (Whisper) — works on iPhone home-screen apps, offline after one download', 'داخل اپ (Whisper) — در اپ نصب‌شدهٔ آیفون کار می‌کند، بعد از یک بار دانلود آفلاین')],
      ['phone', tt("Phone's built-in (Siri / Google)", 'خود گوشی (Siri / Google)')],
    ].map(([v, label]) => `<option value="${v}" ${(t.srEngine || 'auto') === v ? 'selected' : ''}>${label}</option>`).join('')}</select>
      <div class="msg" id="engmsg"></div></div>
    <div class="field"><span>🎙 ${tt('How to answer', 'نحوهٔ جواب دادن')}</span><select id="micMode">${[
      ['auto', tt('Hands-free: listen automatically (recommended)', 'بدون دکمه: خودکار گوش بده (پیشنهادی)')],
      ['tap', tt('Tap 🎙 before speaking', 'قبل از گفتن 🎙 را بزن')],
    ].map(([v, label]) => `<option value="${v}" ${(t.micMode || 'auto') === v ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
    <div class="field"><span>✅ ${tt('When a sentence turns green', 'وقتی جمله سبز شد')}</span><select id="afterGreen">${[
      ['shadow', tt('Skip the 2nd check, still shadow it (recommended)', 'تلاش دوم رد شود، ولی همزمان‌خوانی بماند (پیشنهادی)')],
      ['next', tt('Go straight to the next sentence', 'مستقیم برو جملهٔ بعد')],
      ['repeat', tt('Do every step anyway', 'همهٔ مراحل انجام شود')],
    ].map(([v, label]) => `<option value="${v}" ${(t.afterGreen || (t.skipOnGreen === false ? 'repeat' : 'shadow')) === v ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
    <label class="check"><input type="checkbox" id="warmup" ${t.warmup ? 'checked' : ''}> ${tt('Start each session by reviewing the last session', 'شروع هر جلسه با مرور جمله‌های جلسهٔ قبل')}</label>
    <p class="hint" id="lhint">${profileHint(t.level)}</p>
    <button class="ghost small danger" style="margin-top:12px" data-act="removelang">${tt(`Remove ${langName(l)}`, `حذف ${langName(l)}`)}</button>
  </section></div>`;
  refreshVoiceSelect();
  refreshEngine();
}

/** Shows which recognizer is in use and the in-app model's download state. */
function refreshEngine() {
  const el = $('#engmsg'); if (!el || !ui.lang) return;
  const eng = engineFor(S.tracks[ui.lang]);
  if (eng === 'phone') { el.innerHTML = tt('Using the phone\'s built-in recognition.', 'از تشخیص گفتار خود گوشی استفاده می‌شود.'); return; }
  const { state, progress } = whisperState();
  el.innerHTML = tt('Using in-app recognition (Whisper). ', 'از تشخیص گفتار داخل اپ (Whisper) استفاده می‌شود. ') + (
    state === 'ready' ? tt('✅ Ready, works offline.', '✅ آماده، آفلاین کار می‌کند.')
    : state === 'loading' ? tt(`Downloading… ${Math.round(progress * 100)}%`, `در حال دانلود… ${num(Math.round(progress * 100))}٪`)
    : state === 'error' ? tt('❌ Download failed — check your connection.', '❌ دانلود نشد — اینترنت را چک کن.') + ` <button class="ghost small" data-act="loadwhisper">${tt('Retry', 'دوباره')}</button>`
    : tt('Needs a one-time download (~40 MB).', 'یک بار دانلود لازم دارد (حدود ۴۰ مگابایت).') + ` <button class="ghost small" data-act="loadwhisper">${tt('Download now', 'الان دانلود کن')}</button>`);
}
onWhisperState(() => { if (ui.view === 'track') refreshEngine(); });

function refreshVoiceSelect() {
  const sel = $('#voice'); if (!sel || !ui.lang) return;
  const l = ui.lang, t = S.tracks[l], vs = voicesFor(l), cur = voiceFor(t);
  sel.innerHTML = vs.length ? vs.map(v => `<option value="${esc(v.voiceURI)}" ${cur && v.voiceURI === cur.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('') : `<option>${tt('Default voice', 'صدای پیش‌فرض')}</option>`;
  $('#vwarn').textContent = vs.length ? '' : tt(
    `No ${langName(l)} voice found on this device. Download one in your phone settings (iPhone: Accessibility → Spoken Content → Voices; Android: Text-to-speech → Install voice data).`,
    `روی این دستگاه صدای ${langName(l)} پیدا نشد. از تنظیمات گوشی (Accessibility ← Spoken Content ← Voices یا Text-to-speech) صدای ${langInfo(l).name} را دانلود کن.`);
}
onVoicesChanged(() => { if (ui.view === 'track') refreshVoiceSelect(); });

async function doSearch() {
  const q = ($('#q').value || '').trim().toLowerCase(), box = $('#results'); if (!q) { box.innerHTML = ''; return; }
  const l = ui.lang, t = S.tracks[l], book = await getBook(l, t.bookId); if (!book) return;
  const hits = []; book.sentences.forEach((s, i) => { if (hits.length < 15 && s.toLowerCase().includes(q)) hits.push(i); });
  box.innerHTML = hits.length ? hits.map(i => `<button class="res" dir="${dirOf(l)}" data-act="jump" data-s="${i}"><em>#${num(i + 1)}</em>${esc(book.sentences[i].slice(0, 140))}</button>`).join('') : `<p class="sub">${tt('Nothing found.', 'چیزی پیدا نشد.')}</p>`;
}

function setPos(i) {
  const t = S.tracks[ui.lang], m = t.books[t.bookId]; if (!m) return;
  m.pos = Math.max(0, Math.min(i, (m.total || 1) - 1)); m.last = null; save();
  toast(tt('✓ Starting point set', '✓ نقطهٔ شروع تنظیم شد')); renderTrack(ui.lang);
}

export const actions = {
  selbook: el => { S.tracks[ui.lang].bookId = el.dataset.id; save(); renderTrack(ui.lang); },
  delbook: el => { if (!confirmed(el, tt('Delete?', 'حذف؟'))) return; deleteBook(ui.lang, el.dataset.id); renderTrack(ui.lang); },
  removelang: el => {
    if (!confirmed(el, tt('Tap again to remove it and its books', 'برای حذف زبان و کتاب‌هایش دوباره بزن'))) return;
    forgetBooks(removeTrack(ui.lang)); renderHome();
  },
  search: () => doSearch(),
  jump: el => setPos(+el.dataset.s),
  setpos: () => setPos((+$('#posnum').value || 1) - 1),
  restart: () => setPos(0),
  loadwhisper: () => { loadWhisper().catch(() => {}); refreshEngine(); },
  speechtest: async () => {
    const out = $('#sptest'), l = ui.lang, sample = langInfo(l).hello;
    unlockAudio();
    if (engineFor(S.tracks[l]) === 'whisper') {
      primeAudio();
      if (whisperState().state !== 'ready') {
        out.textContent = tt('Downloading in-app speech recognition (once)…', 'در حال دانلود تشخیص گفتار داخل اپ (یک بار)…');
        try { await loadWhisper(); } catch (e) { out.textContent = tt('❌ Download failed — check your connection.', '❌ دانلود نشد — اینترنت را چک کن.'); return; }
      }
      out.innerHTML = `${tt('Say:', 'بگو:')} <b dir="auto">${esc(sample)}</b><br>🎙 ${tt('Listening…', 'در حال گوش دادن…')}`;
      const rec = await recordUtterance({ maxMs: 9000 });
      if (rec.error) { out.textContent = rec.error === 'mic-denied' ? tt('❌ Microphone access is off. iPhone: Settings → Safari → Microphone → Allow.', '❌ دسترسی میکروفون خاموش است. آیفون: Settings ← Safari ← Microphone ← Allow.') : '❌ ' + rec.error; return; }
      if (!rec.heard) { out.textContent = tt('⚠ Heard nothing. Speak louder, closer to the phone.', '⚠ چیزی نشنیدم. بلندتر و نزدیک‌تر به گوشی بگو.'); return; }
      out.textContent = tt('Checking…', 'در حال بررسی…');
      const text = await transcribe(rec.pcm, l).catch(() => '');
      out.innerHTML = text ? `✅ ${tt('Heard:', 'شنیدم:')} <b dir="auto">${esc(text)}</b> <span class="sub">(Whisper)</span>` : tt('⚠ Heard nothing clear. Try again.', '⚠ چیز واضحی نشنیدم. دوباره امتحان کن.');
      return;
    }
    out.innerHTML = `${tt('Say:', 'بگو:')} <b dir="auto">${esc(sample)}</b><br>🎙 ${tt('Listening…', 'در حال گوش دادن…')}`;
    const r = await listenOnce(l, 9000, () => false, t => { out.innerHTML = `${tt('Say:', 'بگو:')} <b dir="auto">${esc(sample)}</b><br>🎙 ${esc(t)}`; });
    const diag = `<div class="sub" style="font-size:.78rem;margin-top:4px" dir="ltr">SR:${recognitionSupported() ? 'yes' : 'no'} · app:${(window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone ? 'installed' : 'browser'} · ${esc(navigator.userAgent.replace(/^.*?\(([^)]*)\).*$/, '$1').slice(0, 60))}</div>`;
    if (r === null) out.textContent = recognitionBlocked() ? tt('❌ The microphone or speech recognition is not allowed. Check the browser\'s microphone permission (iPhone: also turn on Siri & Dictation).', '❌ اجازهٔ میکروفون یا تشخیص گفتار داده نشده. اجازهٔ میکروفون مرورگر را بررسی کن (آیفون: Siri و Dictation را هم روشن کن).') : tt('❌ This browser has no speech recognition. Use Chrome (Android) or Safari (iPhone).', '❌ این مرورگر تشخیص گفتار ندارد. Chrome (اندروید) یا Safari (آیفون) را امتحان کن.');
    else if (r.text) out.innerHTML = `✅ ${tt('Heard:', 'شنیدم:')} <b dir="auto">${esc(r.text)}</b>`;
    else out.textContent = r.error ? tt(`❌ Error: ${r.error}. Close other apps using the microphone and try again.`, `❌ خطا: ${r.error}. برنامه‌های دیگری که از میکروفون استفاده می‌کنند را ببند و دوباره امتحان کن.`) : tt('⚠ Heard nothing. Speak louder, closer to the phone, right after tapping.', '⚠ چیزی نشنیدم. بلندتر و نزدیک‌تر به گوشی، بلافاصله بعد از زدن دکمه بگو.');
    out.insertAdjacentHTML('beforeend', diag);
  },
  testvoice: () => { unlockAudio(); const t = S.tracks[ui.lang]; speak(langInfo(ui.lang).hello, t.speed, t); },
};

export function onInput(ev) {
  if (ui.view !== 'track') return;
  const t = S.tracks[ui.lang], id = ev.target.id;
  if (id === 'minutes') { t.minutes = +ev.target.value; $('#minout').textContent = tt(`${num(t.minutes)} min`, `${num(t.minutes)} دقیقه`); save(); }
  if (id === 'speed') { t.speed = +ev.target.value; $('#spout').textContent = '×' + num(t.speed); save(); }
}

export function onChange(ev) {
  if (ui.view !== 'track') return;
  const t = S.tracks[ui.lang], { id } = ev.target;
  if (id === 'level') { t.level = ev.target.value; save(); $('#lhint').textContent = profileHint(t.level); }
  if (id === 'voice') { t.voiceURI = ev.target.value; save(); }
  if (id === 'warmup') { t.warmup = ev.target.checked; save(); }
  if (id === 'style') { t.style = ev.target.value; save(); }
  if (id === 'srEngine') { t.srEngine = ev.target.value; save(); refreshEngine(); }
  if (id === 'micMode') { t.micMode = ev.target.value; save(); }
  if (id === 'afterGreen') { t.afterGreen = ev.target.value; save(); }
  if (id === 'check') { t.check = ev.target.checked; save(); }
  if (id === 'checkReps') { t.checkReps = +ev.target.value; save(); }
}

export function onKeydown(ev) { if (ev.key === 'Enter' && ev.target.id === 'q') doSearch(); }
