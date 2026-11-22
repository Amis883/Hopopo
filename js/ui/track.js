// Track screen: books, where the next session starts, and per-language settings.
import { PROFILES, LEVELS, lang as langInfo, isRtl, trackColor } from '../core/languages.js';
import { S, save, removeTrack } from '../data/store.js';
import { getBook, deleteBook, forgetBooks } from '../data/books.js';
import { voicesFor, voiceFor, onVoicesChanged, speak, unlockAudio, recognitionSupported, listenOnce, recognitionBlocked } from '../services/speech.js';
import { tt, num, langName, getUI } from '../i18n.js';
import { app, $, esc, toast, ui, isFramed } from './dom.js';
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
  <header class="top"><button class="icon" data-act="home" aria-label="Back">${tt('←', '→')}</button><h2>${langName(l)}${L.native !== langName(l) ? ' – ' + esc(L.native) : ''}</h2></header>
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
    <div class="field"><span>${tt('My level', 'سطح من')}</span><select id="level">${LEVELS.map(k => `<option ${k === t.level ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
    <div class="field"><span>${tt('Session length', 'مدت هر جلسه')} <output id="minout">${tt(`${num(t.minutes)} min`, `${num(t.minutes)} دقیقه`)}</output></span><input type="range" id="minutes" min="10" max="20" step="1" value="${t.minutes}"></div>
    <div class="field"><span>${tt('Voice speed', 'سرعت صدا')} <output id="spout">×${num(t.speed)}</output></span><input type="range" id="speed" min="0.7" max="1.3" step="0.05" value="${t.speed}"></div>
    <div class="field"><span>${tt(`${langName(l)} voice`, `صدای ${langName(l)}`)}</span><div class="row"><select id="voice" style="margin:0"></select><button class="ghost small" data-act="testvoice">${tt('Test', 'تست')}</button></div><div id="vwarn" class="msg warn"></div></div>
    <label class="check"><input type="checkbox" id="check" ${t.check ? 'checked' : ''}> 🎙 ${tt('Listen to me after each sentence and mark right/wrong', 'بعد از هر جمله صدایم را بشنود و درست/غلط را نشان بدهد')}</label>
    <div class="field" style="margin-top:6px"><span>${tt('Times to say and check each sentence', 'تعداد دفعه‌های گفتن و بررسی هر جمله')}</span><select id="checkReps">${[1, 2, 3].map(n => `<option value="${n}" ${n === (t.checkReps || 2) ? 'selected' : ''}>${tt(`${num(n)}×`, `${num(n)} بار`)}</option>`).join('')}</select>
      <div class="msg">${speechNote}</div>
      <button class="ghost small" style="margin-top:6px" data-act="speechtest">🎙 ${tt('Test the speech check', 'تست بررسی گفتار')}</button>
      <div class="sptest" id="sptest"></div></div>
    <label class="check"><input type="checkbox" id="warmup" ${t.warmup ? 'checked' : ''}> ${tt('Start each session by reviewing the last session', 'شروع هر جلسه با مرور جمله‌های جلسهٔ قبل')}</label>
    <p class="hint" id="lhint">${profileHint(t.level)}</p>
    <button class="ghost small danger" style="margin-top:12px" data-act="removelang">${tt(`Remove ${langName(l)}`, `حذف ${langName(l)}`)}</button>
  </section></div>`;
  refreshVoiceSelect();
}

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

/** Two-tap confirm on destructive buttons. */
function confirmed(el, label) {
  if (el.classList.contains('confirm')) return true;
  const old = el.textContent; el.classList.add('confirm'); el.textContent = label;
  setTimeout(() => { if (el.isConnected) { el.classList.remove('confirm'); el.textContent = old; } }, 3000);
  return false;
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
  speechtest: async () => {
    const out = $('#sptest'), l = ui.lang, sample = langInfo(l).hello;
    unlockAudio();
    out.innerHTML = `${tt('Say:', 'بگو:')} <b dir="auto">${esc(sample)}</b><br>🎙 ${tt('Listening…', 'در حال گوش دادن…')}`;
    const r = await listenOnce(l, 9000, () => false, t => { out.innerHTML = `${tt('Say:', 'بگو:')} <b dir="auto">${esc(sample)}</b><br>🎙 ${esc(t)}`; });
    if (r === null) out.textContent = recognitionBlocked() ? tt('❌ The microphone or speech recognition is not allowed. Check the browser\'s microphone permission (iPhone: also turn on Siri & Dictation).', '❌ اجازهٔ میکروفون یا تشخیص گفتار داده نشده. اجازهٔ میکروفون مرورگر را بررسی کن (آیفون: Siri و Dictation را هم روشن کن).') : tt('❌ This browser has no speech recognition. Use Chrome (Android) or Safari (iPhone).', '❌ این مرورگر تشخیص گفتار ندارد. Chrome (اندروید) یا Safari (آیفون) را امتحان کن.');
    else if (r.text) out.innerHTML = `✅ ${tt('Heard:', 'شنیدم:')} <b dir="auto">${esc(r.text)}</b>`;
    else out.textContent = r.error ? tt(`❌ Error: ${r.error}. Close other apps using the microphone and try again.`, `❌ خطا: ${r.error}. برنامه‌های دیگری که از میکروفون استفاده می‌کنند را ببند و دوباره امتحان کن.`) : tt('⚠ Heard nothing. Speak louder, closer to the phone, right after tapping.', '⚠ چیزی نشنیدم. بلندتر و نزدیک‌تر به گوشی، بلافاصله بعد از زدن دکمه بگو.');
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
  if (id === 'check') { t.check = ev.target.checked; save(); }
  if (id === 'checkReps') { t.checkReps = +ev.target.value; save(); }
}

export function onKeydown(ev) { if (ev.key === 'Enter' && ev.target.id === 'q') doSearch(); }
