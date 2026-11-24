// In-app guide. Written in the interface language and tailored to the learner's own languages.
import { lang as langInfo, isNoSpace } from '../core/languages.js';
import { S } from '../data/store.js';
import { tt, langName } from '../i18n.js';
import { app, esc, ui, isFramed } from './dom.js';

let back = null; // where the back button returns to

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Per-language practical notes: voices to install, OCR availability, script hints. */
function languageNotes() {
  const langs = S.order.length ? S.order : [];
  if (!langs.length) return `<p>${tt('Add a language first; this section then shows tips for it.', 'اول یک زبان اضافه کن؛ بعد اینجا نکته‌های مخصوص همان زبان نمایش داده می‌شود.')}</p>`;
  return langs.map(l => {
    const L = langInfo(l), name = langName(l);
    const ocr = ['de', 'en'].includes(l)
      ? tt('Text recognition for photos works offline (built in).', 'تشخیص متن عکس‌ها آفلاین کار می‌کند (داخل اپ هست).')
      : tt('Text recognition for photos downloads its data once (needs internet the first time).', 'تشخیص متن عکس‌ها بار اول داده‌هایش را دانلود می‌کند (فقط بار اول اینترنت لازم است).');
    const voice = isIOS()
      ? tt(`Voice: Settings → Accessibility → Spoken Content → Voices → ${L.name} → download an "Enhanced" or "Premium" voice.`, `صدا: Settings ← Accessibility ← Spoken Content ← Voices ← ${L.name} ← یک صدای Enhanced یا Premium دانلود کن.`)
      : tt(`Voice: Settings → Text-to-speech (Google) → Install voice data → ${L.name}.`, `صدا: Settings ← Text-to-speech (Google) ← Install voice data ← ${L.name}.`);
    const extra = isNoSpace(l)
      ? tt('This script has no spaces, so the speech check compares character by character.', 'این خط فاصلهٔ بین کلمات ندارد؛ بررسی گفتار حرف‌به‌حرف مقایسه می‌کند.')
      : L.rtl ? tt('Text is shown right-to-left.', 'متن راست‌به‌چپ نمایش داده می‌شود.') : '';
    return `<div class="helplang"><b>${esc(name)} <span class="sub">— ${esc(L.native)} · ${tt('level', 'سطح')} ${S.tracks[l].level}</span></b>
      <ul><li>${voice}</li><li>${ocr}</li>${extra ? `<li>${extra}</li>` : ''}
      <li>${tt('Test it:', 'امتحان:')} <i dir="auto">${esc(L.hello)}</i> — ${tt('use "Test" next to the voice and "Test the speech check" in Book & settings.', 'در «کتاب و تنظیمات» دکمهٔ «تست» کنار صدا و «تست بررسی گفتار» را بزن.')}</li></ul></div>`;
  }).join('');
}

function sections() {
  return [
    ['🐦', tt('What is shadowing?', 'شادوینگ چیست؟'), `<p>${tt(
      'You listen to a native sentence and say it out loud right after, or together with, the speaker, copying the melody, rhythm and stress. Done daily for 10–20 minutes, it trains listening, pronunciation and speaking fluency at the same time.',
      'یک جملهٔ اصلی را می‌شنوی و بلافاصله بعدش، یا همزمان با گوینده، بلند می‌گویی و آهنگ، ریتم و تکیهٔ جمله را تقلید می‌کنی. اگر هر روز ۱۰ تا ۲۰ دقیقه انجامش بدهی، شنیدن، تلفظ و روانی حرف زدنت با هم تقویت می‌شود.')}</p>`],
    ['🚀', tt('Get started in 3 steps', 'شروع در ۳ قدم'), `<ol>
      <li>${tt('<b>Choose your language and level</b> (A1 beginner … C1 advanced). The level decides how long each chunk is and how slow the voice speaks.', '<b>زبان و سطحت را انتخاب کن</b> (A1 مبتدی تا C1 پیشرفته). سطح تعیین می‌کند هر تکه چقدر کوتاه باشد و صدا چقدر آهسته بخواند.')}</li>
      <li>${tt('<b>Add your material</b> in "Book & settings": photos of book pages, a PDF (scanned is fine), EPUB, TXT, pasted text, or a recorded MP3 lesson. The app keeps dialogues, reading texts and everyday phrases and drops exercises. Check the picks and tap "Add selected texts".', '<b>کتاب یا درست را اضافه کن</b> در «کتاب و تنظیمات»: عکس صفحه‌ها، PDF (اسکن‌شده هم قبول است)، EPUB، TXT، متن کپی‌شده، یا درس صوتی MP3. اپ گفت‌وگوها، متن‌های خواندنی و جمله‌های روزمره را نگه می‌دارد و تمرین‌ها را کنار می‌گذارد. انتخاب‌ها را ببین و «افزودن متن‌های انتخاب‌شده» را بزن.')}</li>
      <li>${tt('<b>Tap "Start today\'s session"</b> every day. Tomorrow it continues where you stopped.', '<b>هر روز «شروع جلسهٔ امروز» را بزن.</b> فردا از همان‌جایی ادامه می‌دهد که امروز تمام کردی.')}</li></ol>
      <p class="sub">${tt('The built-in "Sample" texts (English, German, Dutch) are only for trying the app. Delete them with 🗑 once you add your own book.', 'متن‌های «Sample» (انگلیسی، آلمانی، هلندی) فقط برای امتحان اپ هستند؛ وقتی کتاب خودت را اضافه کردی، با 🗑 پاکشان کن.')}</p>`],
    ['🎧', tt('A session, step by step', 'یک جلسه، قدم‌به‌قدم'), `<ul>
      <li>${tt('<b>Simple style (default)</b>: the app says the sentence once, you say it once. 80% or more → next sentence. Below 80% → you hear it once more and try once more, then it moves on. (Book & settings → "Practice style" → "Full shadowing" adds the steps below.)', '<b>روش ساده (پیش‌فرض)</b>: اپ جمله را یک بار می‌گوید و تو یک بار می‌گویی. ۸۰٪ یا بیشتر ← جملهٔ بعد. کمتر از ۸۰٪ ← یک بار دیگر می‌شنوی و یک بار دیگر می‌گویی، بعد می‌رود جملهٔ بعد. («کتاب و تنظیمات» ← «روش تمرین» ← «شادوینگ کامل» مراحل زیر را اضافه می‌کند.)')}</li>
      <li>${tt('<b>Review</b> — warm up with the last sentences from yesterday.', '<b>مرور</b> — گرم کردن با آخرین جمله‌های دیروز.')}</li>
      <li>${tt('<b>Just listen</b> — hear the sentence; notice melody and pauses.', '<b>فقط گوش بده</b> — جمله را بشنو و به آهنگ و مکث‌ها دقت کن.')}</li>
      <li>${tt('<b>Listen, then say it</b> — after the audio, say the sentence. Words turn <span class="okc">green</span> (right), <span class="closec">orange</span> (almost) or <span class="badc">red</span> (wrong/missing).', '<b>گوش بده، بعد بگو</b> — بعد از صدا جمله را بگو. کلمه‌ها <span class="okc">سبز</span> (درست)، <span class="closec">نارنجی</span> (تقریباً) یا <span class="badc">قرمز</span> (غلط یا جاافتاده) می‌شوند.')}</li>
      <li>${tt('<b>Speak along</b> — the real shadowing: speak together with the voice. In the last round the text may be hidden — follow by ear (tap the card to peek).', '<b>همزمان بخوان</b> — شادوینگ اصلی: همراه صدا بلند بخوان. در دور آخر ممکن است متن پنهان باشد؛ با گوش دنبال کن (برای دیدن روی کارت بزن).')}</li>
      <li>${tt('<b>Continuous shadowing</b> — at the end, all of today\'s text plays without stopping.', '<b>شادوینگ پیوسته</b> — در پایان، کل متن امروز بدون توقف پخش می‌شود.')}</li></ul>
      <p>${tt('Controls: ⏮ previous sentence · ⟲ replay · ⏯ pause · ⏭ next sentence · ✕ end (progress is saved). Tap any word for its meaning and pronunciation; "Translate sentence" opens a translation.', 'دکمه‌ها: ⏮ جملهٔ قبل · ⟲ تکرار · ⏯ توقف · ⏭ جملهٔ بعد · ✕ پایان (پیشرفت ذخیره می‌شود). روی هر کلمه بزن تا معنی و تلفظش را ببینی؛ «ترجمهٔ جمله» ترجمه را باز می‌کند.')}</p>`],
    ['🎙', tt('Speech check: tips', 'بررسی گفتار: نکته‌ها'), `<ul>
      <li>${tt('<b>Hands-free</b>: the microphone opens once when you tap "Start" and stays on for the session, so just speak after each sentence. If your phone doesn\'t allow it, the app still gives you a pause to repeat; you can choose "Tap 🎙 before speaking" in Book & settings.', '<b>بدون دکمه</b>: میکروفون با زدن «شروع» یک بار باز می‌شود و تا آخر جلسه روشن می‌ماند؛ فقط بعد از هر جمله بگو. اگر گوشی اجازه ندهد، اپ باز هم مکث برای تکرار می‌دهد؛ در «کتاب و تنظیمات» می‌توانی «قبل از گفتن 🎙 را بزن» را انتخاب کنی.')}</li>
      <li>${tt('In automatic mode, start speaking when you see "Now say it… I\'m listening". Speak clearly, phone 20–30 cm away, in a quiet place.', 'وقتی «حالا بگو… گوش می‌دهم» آمد شروع کن. واضح بگو، گوشی ۲۰ تا ۳۰ سانتی‌متر دور، جای ساکت.')}</li>
      <li>${tt('In Full shadowing, green (80%+) skips the second try; you still shadow the sentence. Change this in Book & settings → "When a sentence turns green".', 'در شادوینگ کامل، سبز (۸۰٪ به بالا) تلاش دوم را رد می‌کند و بعد همزمان‌خوانی می‌آید. در «کتاب و تنظیمات» ← «وقتی جمله سبز شد» قابل تغییر است.')}</li>
      <li>${tt('If it never hears you: use "Test the speech check". On iPhone turn on Settings → Siri → Siri & Dictation, and allow the microphone. If it still fails, turn the check off — the app then gives you a pause to repeat.', 'اگر هیچ‌وقت صدایت را نمی‌گیرد: «تست بررسی گفتار» را بزن. در آیفون Settings ← Siri ← Siri & Dictation را روشن کن و اجازهٔ میکروفون بده. اگر باز نشد، بررسی را خاموش کن؛ اپ به‌جایش مکث برای تکرار می‌گذارد.')}</li>
      <li>${tt('<b>In-app recognition (Whisper)</b>: on iPhone home-screen apps the phone\'s own recognition never returns words, so Hopopo uses its own speech recognizer that runs on the phone. It downloads once (~40 MB) and then works offline; what you say never leaves the phone. Choose it in Book & settings → "Speech recognition".', '<b>تشخیص گفتار داخل اپ (Whisper)</b>: در اپ نصب‌شدهٔ آیفون، تشخیص گفتار خود گوشی هیچ کلمه‌ای برنمی‌گرداند؛ برای همین Hopopo از تشخیص گفتار خودش استفاده می‌کند که روی گوشی اجرا می‌شود. یک بار دانلود می‌شود (حدود ۴۰ مگابایت) و بعد آفلاین کار می‌کند؛ صدایت از گوشی بیرون نمی‌رود. در «کتاب و تنظیمات» ← «تشخیص گفتار».')}</li>
      <li>${tt('The check compares words, not accent: it tells you whether you said the right words.', 'بررسی، کلمه‌ها را می‌سنجد نه لهجه را؛ یعنی می‌گوید کلمه‌های درست را گفتی یا نه.')}</li></ul>`],
    ['🌍', tt('Your languages', 'زبان‌های تو'), languageNotes()],
    ['📱', tt('Install & updates', 'نصب و به‌روزرسانی'), `<ul>
      <li>${isFramed ? tt('You are using the preview inside Claude. For the full app (install, offline, speech check) open <b dir="ltr">amis883.github.io/Hopopo</b>.', 'الان پیش‌نمایش داخل Claude را می‌بینی. برای اپ کامل (نصب، آفلاین، بررسی گفتار) <b dir="ltr">amis883.github.io/Hopopo</b> را باز کن.') : isIOS() ? tt('iPhone: open the link in <b>Safari</b> → Share → <b>Add to Home Screen</b>.', 'آیفون: لینک را در <b>Safari</b> باز کن ← Share ← <b>Add to Home Screen</b>.') : tt('Android: in Chrome tap ⋮ → <b>Install app</b>.', 'اندروید: در Chrome منوی ⋮ ← <b>Install app</b>.')}</li>
      <li>${tt('The app updates itself when you open it. The version is shown at the bottom of the home screen.', 'اپ هر بار که بازش کنی خودش به‌روز می‌شود. شمارهٔ نسخه پایین صفحهٔ اصلی است.')}</li>
      <li>${tt('Works offline after the first use. Keep the screen on during a session — on iPhone, audio stops when the screen locks.', 'بعد از اولین استفاده آفلاین کار می‌کند. در طول جلسه صفحه را روشن نگه دار؛ در آیفون با قفل شدن صفحه صدا قطع می‌شود.')}</li></ul>`],
    ['⚙️', tt('Settings & more', 'تنظیمات و بیشتر'), `<ul>
      <li>${tt('<b>Level, minutes, speed, voice</b>: in "Book & settings" for each language.', '<b>سطح، دقیقه، سرعت، صدا</b>: در «کتاب و تنظیمات» هر زبان.')}</li>
      <li>${tt('<b>Another language</b>: "Learn another language" on the home screen. Remove one with 🗑 on its card (tap twice).', '<b>زبان دیگر</b>: «افزودن زبان دیگر» در صفحهٔ اصلی. برای حذف، روی 🗑 کارت آن زبان دو بار بزن.')}</li>
      <li>${tt('<b>Start somewhere else</b>: search the book or type a sentence number in "Next session starts here".', '<b>شروع از جای دیگر</b>: در «جلسهٔ بعد از اینجا شروع می‌شود» جستجو کن یا شمارهٔ جمله را بزن.')}</li>
      <li>${tt('<b>Add more lessons later</b>: tick "Add to the end of …" when importing.', '<b>اضافه کردن درس‌های بعدی</b>: موقع وارد کردن، «اضافه شود به انتهای …» را تیک بزن.')}</li>
      <li>${tt('<b>Share a lesson</b>: 📤 next to a book creates a small file your friends can open in Hopopo. It also works as a backup.', '<b>اشتراک درس</b>: 📤 کنار هر کتاب یک فایل کوچک می‌سازد که دوستانت در Hopopo باز می‌کنند؛ پشتیبان هم حساب می‌شود.')}</li>
      <li>${tt('<b>Natural voices</b>: MP3 lessons made with <a href="https://github.com/salmansoltaniyan/Dutch-Language-Shadowing-Audio-Generator" target="_blank" rel="noopener">Shadowing Audio Generator</a> play with their recorded voice and translations (🎧 in "Book & settings").', '<b>صدای طبیعی</b>: درس‌های MP3 ساخته‌شده با <a href="https://github.com/salmansoltaniyan/Dutch-Language-Shadowing-Audio-Generator" target="_blank" rel="noopener">Shadowing Audio Generator</a> با همان صدای ضبط‌شده و ترجمه پخش می‌شوند (🎧 در «کتاب و تنظیمات»).')}</li></ul>`],
    ['🔒', tt('Privacy', 'حریم خصوصی'), `<p>${tt('No account, no server: your books, progress and recordings stay on this phone. Deleting the app or clearing browser data deletes them too — use 📤 to keep a copy.', 'بدون حساب و بدون سرور: کتاب‌ها، پیشرفت و ضبط‌هایت روی همین گوشی می‌ماند. با حذف اپ یا پاک کردن داده‌های مرورگر پاک می‌شوند؛ با 📤 یک نسخه نگه دار.')}</p>`],
  ];
}

export function renderHelp() {
  if (ui.view !== 'help') back = ui.view === 'track' && ui.lang ? { view: 'track', lang: ui.lang } : { view: ui.view };
  ui.view = 'help';
  app.innerHTML = `<header class="top"><button class="icon" data-act="helpback" aria-label="Back">${tt('←', '→')}</button><h2>${tt('How to use Hopopo', 'راهنمای Hopopo')}</h2></header>
    ${sections().map(([icon, title, body], i) => `<details class="card help" ${i < 2 ? 'open' : ''}><summary><span>${icon}</span> ${title}</summary><div class="helpbody">${body}</div></details>`).join('')}
    <button class="primary" data-act="helpback">${tt('Got it', 'فهمیدم')}</button>`;
  window.scrollTo(0, 0);
}

export const actions = {
  help: () => renderHelp(),
  helpback: async () => {
    const b = back || { view: 'home' };
    if (b.view === 'track' && S.tracks[b.lang]) return (await import('./track.js')).renderTrack(b.lang);
    if (b.view === 'welcome' || !S.order.length) return (await import('./welcome.js')).renderWelcome();
    return (await import('./home.js')).renderHome();
  },
};
