// Home screen: one card per language track, "add a language", install hint.
import { CATALOG, LEVELS, lang as langInfo, trackColor } from '../core/languages.js';
import { stats } from '../core/stats.js';
import { S, save, addTrack, removeTrack } from '../data/store.js';
import { forgetBooks } from '../data/books.js';
import { tt, num, locale, langName, weekdays, getUI, setUI } from '../i18n.js';
import { app, esc, ui, isFramed, isStandalone, toast, confirmTap } from './dom.js';
import { renderTrack } from './track.js';

export function renderHome() {
  if (ui.pendingReload) { location.reload(); return; }   // an update arrived during the session
  if (!S.order.length) return import('./welcome.js').then(m => m.renderWelcome());
  ui.view = 'home'; ui.lang = null;
  const today = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  app.innerHTML = `
  <header class="top"><img src="icons/icon.svg" alt="" width="48" height="48" style="border-radius:12px"><div class="grow"><h1>Hopopo</h1><p class="sub">${tt('Daily shadowing', 'شادوینگ روزانه')} – ${today}</p></div><button class="langbtn" data-act="uilang" aria-label="Language">${getUI() === 'fa' ? 'EN' : 'فا'}</button></header>
  ${S.order.map((l, i) => trackCard(l, i)).join('')}
  ${addLanguageCard()}
  ${installCard()}
  <p class="foot">${tt('A little, every day. 10–20 minutes is enough.', 'کم، ولی هر روز. ۱۰ تا ۲۰ دقیقه کافی است.')}<br><small id="ver"></small></p>`;
  showVersion();
}

/** The installed version = the service worker's cache name (sw.js is the single source of truth). */
async function showVersion() {
  try {
    const v = (await caches.keys()).find(k => k.startsWith('hopopo-'));
    const el = document.getElementById('ver'); if (v && el) el.textContent = 'v' + v.slice(7);
  } catch (e) { /* caches unavailable (e.g. embedded preview) */ }
}

function trackCard(l, index) {
  const t = S.tracks[l], L = langInfo(l), b = t.books[t.bookId], st = stats(t, weekdays());
  const pct = b && b.total ? Math.min(100, Math.round(100 * b.pos / b.total)) : 0;
  const sub = (L.native !== langName(l) ? L.native + ' – ' : '') + tt('Level', 'سطح') + ' ' + t.level;
  return `<section class="card track" style="--acc:${trackColor(l, index)}">
    <div class="trow"><div class="lang"><span class="code">${l.toUpperCase()}</span><div><b>${langName(l)}</b><small>${esc(sub)}</small></div></div>
    <div class="trow"><div class="streak" title="${tt('Days in a row', 'روزهای پشت‌سرهم')}">🔥 ${num(st.streak)}</div><button class="icon del" style="margin-inline-start:8px" data-act="removetrack" data-lang="${l}" aria-label="${tt('Remove language', 'حذف زبان')}">🗑</button></div></div>
    <div class="book">📖 <bdi>${esc(b ? b.title : tt('No book yet — add one in “Book & settings”', 'هنوز کتابی نیست — از «کتاب و تنظیمات» اضافه کن'))}</bdi></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="meta"><span>${tt(`${num(pct)}% of book`, `${num(pct)}٪ از کتاب`)}</span><span>${st.doneToday ? tt('✓ Done today', '✓ امروز انجام شد') : st.todaySec ? tt(`${num(Math.round(st.todaySec / 60))} min today`, `امروز ${num(Math.round(st.todaySec / 60))} دقیقه`) : tt('Not yet today', 'امروز هنوز نه')}</span></div>
    <div class="week">${st.week.map(d => `<span class="${d.done ? 'on' : ''} ${d.today ? 'today' : ''}">${d.label}</span>`).join('')}</div>
    <div class="btns">
      <button class="primary" data-act="start" data-lang="${l}">▶ ${st.doneToday ? tt('One more session', 'یک جلسهٔ دیگر') : tt("Start today's session", 'شروع جلسهٔ امروز')} – ${tt(`${num(t.minutes)} min`, `${num(t.minutes)} دقیقه`)}</button>
      <button class="ghost" data-act="track" data-lang="${l}">${tt('Book & settings', 'کتاب و تنظیمات')}</button>
    </div></section>`;
}

function addLanguageCard() {
  const avail = CATALOG.filter(c => !S.tracks[c.id]);
  if (!avail.length) return '';
  return `<section class="card addlang"><details><summary><b>➕ ${tt('Learn another language', 'افزودن زبان دیگر')}</b></summary>
    <div class="row"><select id="newlang">${avail.map(c => `<option value="${c.id}">${esc(langName(c.id))} — ${esc(c.native)}</option>`).join('')}</select></div>
    <div class="row"><label>${tt('My level', 'سطح من')}</label><select id="newlevel">${LEVELS.map(k => `<option>${k}</option>`).join('')}</select>
    <button class="primary small" data-act="addlang">${tt('Add', 'افزودن')}</button></div></details></section>`;
}

function installCard() {
  if (isStandalone()) return '';
  const title = tt('Install on your phone', 'نصب روی گوشی');
  if (isFramed) return `<section class="card note"><b>${title}</b><p>${tt('This page works for practice right here. To install it as an app, use it offline, check your speech and share it with friends who don\'t use Claude, open the full version: <b dir="ltr">amis883.github.io/Hopopo</b>. Send lessons you prepare here with the 📤 button next to each book.', 'همین صفحه برای تمرین کار می‌کند. برای نصب به‌شکل اپ، کار آفلاین، بررسی گفتار و دادن به دوستانی که Claude ندارند، نسخهٔ کامل را باز کن: <b dir="ltr">amis883.github.io/Hopopo</b>. درس‌هایی را که اینجا آماده کرده‌ای با دکمهٔ 📤 کنار هر کتاب برایشان بفرست.')}</p></section>`;
  const d = ui.deferredInstall;
  return `<section class="card note"><b>${title}</b><p>${d ? tt('Install with one tap:', 'با یک دکمه نصب کن:') : tt('iPhone: in Safari tap Share → Add to Home Screen. Android: Chrome menu ⋮ → Install app.', 'آیفون: در Safari دکمهٔ Share ← Add to Home Screen. اندروید: منوی Chrome ← Install app.')}</p>${d ? `<button class="primary" data-act="install">${tt('Install app', 'نصب اپ')}</button>` : ''}</section>`;
}

export const actions = {
  home: () => renderHome(),
  track: el => renderTrack(el.dataset.lang),
  uilang: () => { setUI(getUI() === 'fa' ? 'en' : 'fa'); S.ui = getUI(); save(); renderHome(); },
  removetrack: el => {
    const l = el.dataset.lang;
    if (!confirmTap(el, tt(`Remove ${langName(l)}?`, `حذف ${langName(l)}؟`))) return;
    forgetBooks(removeTrack(l));
    toast(tt(`${langName(l)} removed`, `${langName(l)} حذف شد`));
    renderHome();
  },
  install: () => { if (ui.deferredInstall) { ui.deferredInstall.prompt(); ui.deferredInstall = null; } },
  addlang: () => {
    const l = document.getElementById('newlang').value, level = document.getElementById('newlevel').value;
    addTrack(l, level);
    toast(tt(`✓ ${langName(l)} added — now add a book or lesson`, `✓ ${langName(l)} اضافه شد — حالا یک کتاب یا درس اضافه کن`), 4000);
    renderTrack(l);
  },
};
