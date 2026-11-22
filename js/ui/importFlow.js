// Getting material into a track: photos, PDFs (text or scanned), EPUB, TXT, pasted text, packs.
// Pipeline: source → text (pdf.js / OCR / EPUB) or images → selection (Claude, else heuristic) → review → book.
import { lang as langInfo, isRtl } from '../core/languages.js';
import { heuristicPick, linesToText } from '../core/text.js';
import { parsePack, makePack, packFileName } from '../core/packs.js';
import { readId3Txxx, id3Size, timelineToBook } from '../core/timeline.js';
import { S, addTrack } from '../data/store.js';
import { getBook, importSentences, importText, importAudioBook } from '../data/books.js';
import { openPdf, pdfLooksScanned, pdfToText, pdfPageCanvas, imageCanvas, canvasBlob, epubToText } from '../services/importers.js';
import { recognize } from '../services/ocr.js';
import { getClaude, imageBatchSize, selectMaterial } from '../services/claude.js';
import { tt, num, locale, langName, typeName, getUI } from '../i18n.js';
import { $, esc, toast, say, ui, isFramed } from './dom.js';
import { renderTrack } from './track.js';

let picks = null, pendingPdf = null, ocrCancelled = false;
const noText = () => tt('No usable text found.', 'متن قابل‌استفاده‌ای پیدا نشد.');
const appendTarget = () => { const ap = $('#append'); return ap && ap.checked ? S.tracks[ui.lang].bookId : null; };

export function importPanel(l, meta, open) {
  return `<details class="import" ${open ? 'open' : ''}><summary>➕ ${tt(`Add a ${langName(l)} book or lesson`, `افزودن کتاب یا درس ${langName(l)}`)}</summary>
      <label class="file">📷 ${tt('Photos of book pages', 'عکس صفحه‌های کتاب')}<br><small>${tt('You can select several photos at once (in page order)', 'می‌توانی چند عکس را با هم انتخاب کنی (به ترتیب صفحه)')}</small><input type="file" id="imgs" accept="image/*" multiple></label>
      <label class="file">📄 ${tt('Book file', 'فایل کتاب')}<br><small>${tt('PDF (scanned or text), EPUB, TXT or a shadowing pack (.json)', 'PDF (اسکن‌شده یا متنی)، EPUB، TXT یا بستهٔ شادوینگ (.json)')}</small><input type="file" id="file" accept=".pdf,.epub,.txt,.md,.json,text/plain,application/json,application/pdf,application/epub+zip"></label>
      <label class="file">🎧 ${tt('Recorded audio lesson (MP3 + timeline)', 'درس صوتی ضبط‌شده (MP3 + timeline)')}<br><small>${tt('Made with', 'ساخته‌شده با')} <a href="https://github.com/salmansoltaniyan/Dutch-Language-Shadowing-Audio-Generator" target="_blank" rel="noopener">Shadowing Audio Generator</a> — ${tt('natural neural voices + translations', 'صدای طبیعی + ترجمه')}</small><input type="file" id="audio" accept=".mp3,.json,audio/mpeg,application/json" multiple></label>
      <div id="pdfrange"></div>
      ${meta && !meta.sample ? `<label class="check" style="margin:8px 0"><input type="checkbox" id="append"> ${tt('Add to the end of', 'اضافه شود به انتهای')} «<bdi>${esc(meta.title)}</bdi>»</label>` : ''}
      <p class="hint">${tt('Give it the pages of one lesson: the app keeps dialogues, reading texts and useful everyday phrases, and drops exercises, tables and instructions. You can review the picks before adding. For photos: good light, flat page, one page per photo.', 'صفحه‌های یک درس را بده؛ اپ خودش گفت‌وگوها، متن‌های خواندنی و جمله‌های کاربردی روزمره را جدا می‌کند و تمرین‌ها، جدول‌ها و دستورالعمل‌ها را کنار می‌گذارد. قبل از افزودن می‌توانی انتخاب‌ها را ببینی و عوض کنی. برای عکس: نور خوب، صفحهٔ صاف، هر عکس یک صفحه.')}</p>
      <div id="picks"></div>
      <div class="or">${tt('or paste text here', 'یا متن را اینجا بچسبان')}</div>
      <input type="text" id="btitle" placeholder="${tt('Book or lesson name', 'نام کتاب یا درس')}">
      <textarea id="btext" dir="${isRtl(l) ? 'rtl' : 'ltr'}" rows="7" placeholder="${esc(langInfo(l).native)}…"></textarea>
      <div class="btnrow"><button class="primary small" data-act="smarttext">✨ ${tt('Pick useful texts', 'انتخاب متن‌های مفید')}</button><button class="ghost small" data-act="addtext">${tt('Add all text', 'افزودن همهٔ متن')}</button></div>
      <div id="impmsg" class="msg"></div>
      <button class="ghost small hidden" id="ocrstop" data-act="ocrcancel">${tt('Stop text recognition', 'توقف تشخیص متن')}</button>
    </details>`;
}

/* ---------- selection & review ---------- */

function promptArgs() {
  const t = S.tracks[ui.lang];
  return { langName: langInfo(ui.lang).name, level: t.level, noteLanguage: getUI() === 'fa' ? 'Persian' : 'English', persianLearner: getUI() === 'fa' };
}

function showPicks(res, title) {
  picks = { ...res, title };
  const box = $('#picks'); if (!box) return;
  if (!res.items.length) {
    box.innerHTML = '';
    say(tt('No text suitable for shadowing was found. I put the full text in the box below so you can choose.', 'متن مناسبی برای شادوینگ پیدا نشد. متن کامل را در کادر پایین گذاشتم تا خودت انتخاب کنی.'), true);
    if (res.raw) $('#btext').value = res.raw;
    return;
  }
  say('');
  const dir = isRtl(ui.lang) ? 'rtl' : 'ltr';
  box.innerHTML = `<div class="picks"><div class="pickhead">✨ ${tt(`${num(res.items.length)} ${res.items.length === 1 ? 'text' : 'texts'} good for shadowing`, `${num(res.items.length)} متن مناسب شادوینگ پیدا شد`)}${res.lesson ? ` — <bdi>${esc(res.lesson)}</bdi>` : ''}
      <small>${res.heuristic ? tt('Picked by the simple built-in filter. Inside Claude, Claude picks texts more precisely.', 'این انتخاب با فیلتر سادهٔ داخلی انجام شد. داخل Claude، خود Claude متن‌ها را دقیق‌تر انتخاب می‌کند.') : tt('Untick anything you don\'t want.', 'تیک هرکدام را که نمی‌خواهی بردار.')}</small></div>
    ${res.items.map((it, i) => `<label class="pick"><input type="checkbox" checked data-pick="${i}"><div><span class="badge">${typeName(it.type)}</span> <b dir="${dir}">${esc(it.title || '')}</b>${(it.note || it.note_fa) ? `<small>${esc(it.note || it.note_fa)}</small>` : ''}<div class="ptext" dir="${dir}">${esc(it.text).replace(/\n/g, '<br>')}</div></div></label>`).join('')}
    <button class="primary" data-act="addpicks">${tt('Add selected texts', 'افزودن متن‌های انتخاب‌شده')}</button>
    <div class="btnrow" style="margin-top:8px"><button class="ghost small" data-act="editpicks">${tt('Edit before adding', 'ویرایش قبل از افزودن')}</button>${res.raw ? `<button class="ghost small" data-act="rawtext">${tt('Show full text', 'نمایش متن کامل')}</button>` : ''}</div></div>`;
  const ti = $('#btitle'); if (ti && !ti.value.trim()) ti.value = res.lesson || title;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const pickedText = () => linesToText([...document.querySelectorAll('[data-pick]')].filter(c => c.checked).map(c => picks.items[+c.dataset.pick].text));

/** Text → selection: Claude when available, otherwise the offline heuristic. */
async function selectFromText(text, title) {
  const claude = await getClaude();
  if (claude) {
    try {
      say(tt('✨ Claude is picking texts that are good for shadowing…', '✨ Claude دارد متن‌های مفید برای شادوینگ را جدا می‌کند…'));
      return showPicks(await selectMaterial({ claude, text, promptArgs: promptArgs() }), title);
    } catch (e) { if (e && e.code === 'rate_limited') toast(tt('Claude is busy right now; used the built-in filter.', 'Claude فعلاً مشغول است؛ از فیلتر داخلی استفاده شد.')); }
  }
  showPicks({ lesson: '', items: heuristicPick(text, ui.lang, tt('Simple automatic selection; have a look before adding.', 'انتخاب خودکار ساده؛ قبل از افزودن یک نگاه بینداز.')), heuristic: true, raw: text }, title);
}

/** Page images → selection: Claude reads images directly when it can; otherwise OCR on the device. */
async function selectFromPages(sources, label, title) {
  const claude = await getClaude();
  const batch = claude ? await imageBatchSize(claude) : 0;
  if (batch) {
    try {
      const blobs = [];
      for (let i = 0; i < sources.length; i++) { say(tt(`Preparing ${label(i)} (${num(i + 1)} of ${num(sources.length)})…`, `آماده‌سازی ${label(i)} (${num(i + 1)} از ${num(sources.length)})…`)); blobs.push(await canvasBlob(await sources[i]())); }
      const res = await selectMaterial({ claude, images: blobs, batch, promptArgs: promptArgs(),
        onBatch: (done, all) => say(tt(`✨ Claude is reading the pages and picking useful texts (${num(done)} of ${num(all)})…`, `✨ Claude دارد صفحه‌ها را می‌خواند و متن‌های مفید را جدا می‌کند (${num(done)} از ${num(all)})…`)) });
      return showPicks(res, title);
    } catch (e) { /* fall back to on-device OCR */ }
  }
  ocrCancelled = false;
  const stop = $('#ocrstop'); if (stop) stop.classList.remove('hidden');
  say(tt('Preparing text recognition (the first time takes a moment)…', 'در حال آماده‌سازی تشخیص متن (بار اول کمی طول می‌کشد)…'));
  try {
    const r = await recognize(ui.lang, sources, {
      isCancelled: () => ocrCancelled,
      onPage: i => say(tt(`Reading text: ${label(i)} (${num(i + 1)} of ${num(sources.length)})`, `تشخیص متن: ${label(i)} (${num(i + 1)} از ${num(sources.length)})`)),
      onProgress: (i, p) => say(tt(`Reading text: ${label(i)} (${num(i + 1)} of ${num(sources.length)}) — ${num(Math.round(p * 100))}%`, `تشخیص متن: ${label(i)} (${num(i + 1)} از ${num(sources.length)}) — ${num(Math.round(p * 100))}٪`)),
    });
    return selectFromText(r.text, title);
  } finally { const s = $('#ocrstop'); if (s) s.classList.add('hidden'); }
}

const failed = e => say(tt('Text recognition failed: ', 'تشخیص متن ناموفق بود: ') + (e.message || e), true);

async function handleImages(files) {
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.lastModified - b.lastModified);
  try { await selectFromPages(files.map(f => () => imageCanvas(f)), k => tt(`photo ${num(k + 1)}`, `عکس ${num(k + 1)}`), tt('Lesson ', 'درس ') + new Date().toLocaleDateString(locale())); }
  catch (e) { failed(e); }
}

async function handleFile(f) {
  say(tt('Reading file…', 'در حال خواندن فایل…'));
  try {
    const name = f.name.toLowerCase(); let raw;
    if (name.endsWith('.json')) {
      const pk = parsePack(await f.text());
      if (!pk) throw new Error(tt('This file is not a valid shadowing pack.', 'این فایل بستهٔ شادوینگ معتبر نیست.'));
      return importPack(pk);
    }
    if (name.endsWith('.pdf')) {
      const pdf = await openPdf(f), n = pdf.numPages;
      if (await pdfLooksScanned(pdf)) {
        pendingPdf = { pdf, name: f.name.replace(/\.[^.]+$/, '') };
        say('');
        $('#pdfrange').innerHTML = `<div class="hint" style="margin-bottom:8px">${tt(`<b>This PDF is scanned (${num(n)} pages).</b><br>Text is recognized on your device (OCR), a few seconds per page. It's best to import a lesson or two at a time and continue later with "Add to the end of".`, `<b>این PDF اسکن‌شده است (${num(n)} صفحه).</b><br>متن با تشخیص نوری (OCR) روی خود گوشی خوانده می‌شود؛ هر صفحه چند ثانیه. بهتر است هر بار چند درس را جدا وارد کنی و بعداً با گزینهٔ «اضافه به انتهای کتاب» ادامه بدهی.`)}
          <div class="row" style="margin-top:8px"><label>${tt('From page', 'از صفحهٔ')}</label><input type="number" id="pfrom" min="1" max="${n}" value="1"><label>${tt('to', 'تا')}</label><input type="number" id="pto" min="1" max="${n}" value="${Math.min(n, 15)}"></div>
          <button class="primary small" style="margin-top:8px" data-act="pdfocr">${tt('Start text recognition', 'شروع تشخیص متن')}</button></div>`;
        return;
      }
      raw = await pdfToText(pdf, (p, total) => say(tt(`Reading PDF… page ${num(p)} of ${num(total)}`, `در حال خواندن PDF… صفحهٔ ${num(p)} از ${num(total)}`)));
    } else if (name.endsWith('.epub')) raw = await epubToText(f);
    else raw = await f.text();
    const title = $('#btitle').value.trim() || f.name.replace(/\.[^.]+$/, '');
    if (raw.length <= 60000) return selectFromText(raw, title);   // a lesson: select material
    const n = await importText(ui.lang, title, raw, appendTarget(), noText()); // a whole book: import as is
    toast(tt(`✓ "${title}" added with ${num(n)} sentences`, `✓ «${title}» با ${num(n)} جمله اضافه شد`), 4000);
    renderTrack(ui.lang);
  } catch (e) { say(e.message || tt('Could not read the file.', 'خواندن فایل ناموفق بود.'), true); }
}

/* ---------- recorded lessons from the audio generator ---------- */

/** Reads only the ID3 tag at the start of the MP3 and returns its embedded timeline, if any. */
async function timelineFromMp3(file) {
  const size = id3Size(await file.slice(0, 10).arrayBuffer());
  if (!size) return null;
  const txt = readId3Txxx(await file.slice(0, size).arrayBuffer());
  try { return txt ? JSON.parse(txt) : null; } catch (e) { return null; }
}

async function handleAudio(files) {
  say(tt('Reading audio lesson…', 'در حال خواندن درس صوتی…'));
  try {
    const mp3 = files.find(f => /\.mp3$/i.test(f.name) || f.type === 'audio/mpeg');
    const json = files.find(f => /\.json$/i.test(f.name));
    if (!mp3) throw new Error(tt('Choose the lesson MP3 (and its .json timeline if you have it).', 'فایل MP3 درس را انتخاب کن (و اگر داری، فایل timeline با پسوند json).'));
    let tl = null;
    if (json) { try { tl = JSON.parse(await json.text()); } catch (e) { tl = null; } }
    if (!tl) tl = await timelineFromMp3(mp3);
    if (!tl) throw new Error(tt('No timeline found. Select the .json file that was saved next to the MP3, or use a newer version of the generator.', 'timeline پیدا نشد. فایل json کنار MP3 را هم انتخاب کن، یا از نسخهٔ جدیدتر سازنده استفاده کن.'));
    const data = timelineToBook(tl, ui.lang);
    if (!data) throw new Error(noText());
    if (!S.tracks[data.lang]) addTrack(data.lang, 'A1');
    const title = $('#btitle').value.trim() || data.title || mp3.name.replace(/\.mp3$/i, '');
    const n = await importAudioBook(data.lang, title, data, mp3);
    toast(tt(`🎧 "${title}" added: ${num(n)} sentences with recorded voice`, `🎧 «${title}» اضافه شد: ${num(n)} جمله با صدای ضبط‌شده`), 4500);
    renderTrack(data.lang);
  } catch (e) { say(e.message || String(e), true); }
}

/* ---------- packs ---------- */

async function importPack(p) {
  if (!p.sentences.length) throw new Error(tt('This pack is empty.', 'این بسته خالی است.'));
  const l = p.lang, title = String(p.title || tt('Shadowing pack', 'بستهٔ شادوینگ'));
  if (!S.tracks[l]) addTrack(l, p.level || 'A1');
  const n = await importSentences(l, title, p.sentences, l === ui.lang ? appendTarget() : null, noText(), p.translations);
  toast(tt(`✓ "${title}" (${num(n)} sentences) added to ${langName(l)}`, `✓ «${title}» (${num(n)} جمله) به ${langName(l)} اضافه شد`), 4500);
  renderTrack(l);
}

async function shareBook(id) {
  const l = ui.lang, t = S.tracks[l], m = t.books[id], b = await getBook(l, id); if (!m || !b) return;
  const json = makePack({ lang: l, level: t.level, title: m.title, sentences: b.sentences, translations: b.translations });
  if (!isFramed) {
    const file = new File([json], packFileName(m.title), { type: 'application/json' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: m.title }); return; } }
    catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    toast(tt('Pack file saved — send it to your friend.', 'فایل بسته ذخیره شد؛ برای دوستت بفرست.'), 4500); return;
  }
  try { await navigator.clipboard.writeText(json); toast(tt('Pack copied. Send it to your friend; they paste it into the app\'s text box and tap "Add all text".', 'بسته کپی شد. برای دوستت بفرست؛ او آن را در کادر متن اپ می‌چسباند و «افزودن همهٔ متن» را می‌زند.'), 6500); }
  catch (e) { toast(tt('Could not copy.', 'کپی ممکن نشد.')); }
}

/* ---------- actions ---------- */

async function addText(raw, title, msg) {
  try {
    const n = await importText(ui.lang, title, raw, appendTarget(), noText());
    toast(tt(`✓ ${num(n)} sentences added`, `✓ ${num(n)} جمله اضافه شد`), 4000); renderTrack(ui.lang);
  } catch (e) { say(e.message, true); }
}

export const actions = {
  sharebook: el => shareBook(el.dataset.id),
  addtext: async () => {
    const raw = $('#btext').value.trim();
    if (!raw) return say(tt('Paste some text first.', 'اول متن را بچسبان.'), true);
    const pk = parsePack(raw); if (pk) return importPack(pk).catch(e => say(e.message, true));
    return addText(raw, $('#btitle').value.trim() || tt('Text ', 'متن ') + new Date().toLocaleDateString(locale()));
  },
  smarttext: async () => {
    const raw = $('#btext').value.trim();
    const pk = parsePack(raw); if (pk) return importPack(pk).catch(e => say(e.message, true));
    if (!raw) return say(tt('Paste text or choose a file/photo first.', 'اول متن را بچسبان یا فایل/عکس انتخاب کن.'), true);
    return selectFromText(raw, $('#btitle').value.trim() || tt('Lesson', 'درس'));
  },
  addpicks: () => {
    const txt = pickedText(); if (!txt) return toast(tt('Nothing selected', 'هیچ متنی انتخاب نشده'));
    return addText(txt, $('#btitle').value.trim() || picks.lesson || picks.title || tt('Lesson', 'درس'));
  },
  editpicks: () => { $('#btext').value = pickedText(); $('#picks').innerHTML = ''; say(tt('The selected text is in the box; edit it and tap "Add all text".', 'متن انتخاب‌شده در کادر است؛ ویرایش کن و «افزودن همهٔ متن» را بزن.')); $('#btext').scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  rawtext: () => { $('#btext').value = picks.raw || ''; $('#btext').scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  ocrcancel: el => { ocrCancelled = true; el.textContent = tt('Stopping…', 'در حال توقف…'); },
  pdfocr: async () => {
    const { pdf, name } = pendingPdf;
    const a = Math.max(1, +$('#pfrom').value || 1), b = Math.min(pdf.numPages, +$('#pto').value || a);
    $('#pdfrange').innerHTML = '';
    const pages = []; for (let i = a; i <= b; i++) pages.push(i);
    try { await selectFromPages(pages.map(i => async () => pdfPageCanvas(await pdf.getPage(i))), k => tt(`page ${num(pages[k])}`, `صفحهٔ ${num(pages[k])}`), name); }
    catch (e) { failed(e); }
  },
};

export function onChange(ev) {
  const { id } = ev.target;
  if (id === 'file') { const f = ev.target.files[0]; if (f) handleFile(f); ev.target.value = ''; }
  if (id === 'audio') { const fs = [...ev.target.files]; if (fs.length) handleAudio(fs); ev.target.value = ''; }
  if (id === 'imgs') { const fs = [...ev.target.files]; if (fs.length) handleImages(fs); ev.target.value = ''; }
}
