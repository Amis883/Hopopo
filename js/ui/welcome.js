// First run: the learner picks the language they practise, their level and session length.
import { CATALOG, LEVELS } from '../core/languages.js';
import { S, save, addTrack } from '../data/store.js';
import { tt, langName, getUI, setUI } from '../i18n.js';
import { app, esc, ui, toast } from './dom.js';
import { renderTrack } from './track.js';

const LEVEL_TEXT = {
  A1: ['Beginner', 'I know a few words and simple phrases.', 'مبتدی', 'چند کلمه و جملهٔ ساده بلدم.'],
  A2: ['Elementary', 'I can handle simple everyday situations.', 'مقدماتی', 'از پس موقعیت‌های سادهٔ روزمره برمی‌آیم.'],
  B1: ['Intermediate', 'I can talk about familiar topics.', 'متوسط', 'دربارهٔ موضوعات آشنا حرف می‌زنم.'],
  B2: ['Upper-intermediate', 'I follow most conversations and texts.', 'بالاتر از متوسط', 'بیشتر گفت‌وگوها و متن‌ها را می‌فهمم.'],
  C1: ['Advanced', 'I speak fluently; I want to polish.', 'پیشرفته', 'روان حرف می‌زنم و می‌خواهم دقیق‌تر شوم.'],
};

export function renderWelcome() {
  ui.view = 'welcome'; ui.lang = null;
  const guess = (navigator.language || 'en').slice(0, 2);
  const first = CATALOG.find(c => c.id !== guess) || CATALOG[0];
  app.innerHTML = `
  <header class="top"><img src="icons/icon.svg" alt="" width="56" height="56" style="border-radius:14px"><div class="grow"><h1>Hopopo</h1><p class="sub">${tt('Daily shadowing with your own book', 'شادوینگ روزانه با کتاب خودت')}</p></div><button class="langbtn" data-act="help" aria-label="${tt('Guide', 'راهنما')}">❓</button><button class="langbtn" data-act="welcomeui">${getUI() === 'fa' ? 'EN' : 'فا'}</button></header>
  <section class="card">
    <h3>${tt('Which language do you want to practise?', 'کدام زبان را می‌خواهی تمرین کنی؟')}</h3>
    <select id="wlang">${CATALOG.map(c => `<option value="${c.id}" ${c.id === first.id ? 'selected' : ''}>${esc(langName(c.id))} — ${esc(c.native)}</option>`).join('')}</select>
    <h3 style="margin-top:12px">${tt('Your level', 'سطح تو')}</h3>
    <div class="levels">${LEVELS.map((k, i) => { const [en, enD, fa, faD] = LEVEL_TEXT[k]; return `<label class="lvl"><input type="radio" name="wlevel" value="${k}" ${i === 0 ? 'checked' : ''}><span><b>${k} · ${tt(en, fa)}</b><small>${tt(enD, faD)}</small></span></label>`; }).join('')}</div>
    <h3 style="margin-top:12px">${tt('Minutes per day', 'چند دقیقه در روز؟')}</h3>
    <div class="row">${[10, 15, 20].map(m => `<label class="pill"><input type="radio" name="wmin" value="${m}" ${m === 15 ? 'checked' : ''}><span>${m}</span></label>`).join('')}</div>
    <button class="primary" style="margin-top:16px" data-act="welcomego">${tt('Start', 'شروع')}</button>
    <p class="hint">${tt('You can add more languages and change your level any time.', 'هر وقت خواستی می‌توانی زبان دیگری اضافه کنی یا سطحت را عوض کنی.')} <a href="#" data-act="help">${tt('How does it work? → Guide', 'چطور کار می‌کند؟ ← راهنما')}</a></p>
  </section>`;
}

export const actions = {
  welcomeui: () => { setUI(getUI() === 'fa' ? 'en' : 'fa'); S.ui = getUI(); save(); renderWelcome(); },
  welcomego: () => {
    const l = document.getElementById('wlang').value;
    const level = (document.querySelector('input[name=wlevel]:checked') || {}).value || 'A1';
    const minutes = +((document.querySelector('input[name=wmin]:checked') || {}).value || 15);
    const t = addTrack(l, level); t.minutes = minutes;
    S.onboarded = true; save();
    renderTrack(l);
    toast(tt('Next: add your book or lesson below. Tap ❓ on the home screen for the guide.', 'قدم بعد: کتاب یا درست را همین پایین اضافه کن. راهنما با ❓ در صفحهٔ اصلی.'), 6000);
  },
};
