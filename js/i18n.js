// Interface language (English / Persian). UI strings stay next to the code that uses them via tt(en, fa).
import { lang as langInfo } from './core/languages.js';

let UI = 'en';
export const getUI = () => UI;
export function setUI(v) {
  UI = v === 'fa' ? 'fa' : 'en';
  if (typeof document !== 'undefined') { document.documentElement.lang = UI; document.documentElement.dir = UI === 'fa' ? 'rtl' : 'ltr'; }
}

/** Pick the string for the current interface language. */
export const tt = (en, fa) => UI === 'fa' ? fa : en;
/** Number formatted for the interface language (Persian digits in fa). */
export const num = n => Number(n).toLocaleString(UI === 'fa' ? 'fa-IR' : 'en-US');
export const locale = () => UI === 'fa' ? 'fa-IR' : 'en-US';
/** A learning language's display name in the interface language. */
export const langName = id => UI === 'fa' ? langInfo(id).fa : langInfo(id).name;
export const weekdays = () => UI === 'fa' ? ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const PHASES = {
  en: {
    listen: ['Just listen', 'Notice the melody, stress and pauses of the sentence.'],
    echo: ['Listen, then repeat', 'When the audio stops, say the same sentence aloud with the same melody.'],
    shadow: ['Speak along', 'Speak aloud together with the audio (or half a second behind it).'],
    blind: ['Shadow without text', 'The text is hidden; follow by ear only. Tap the card to peek.'],
    check: ['Listen, then say it', 'After the audio, say the sentence aloud. Correct words turn green, close ones orange, wrong or missing ones red.'],
    final: ['Continuous shadowing', "All of today's text plays back to back; speak along without stopping."],
    review: ['Review last session', 'Warm up with the last sentences from last time; speak along.'],
  },
  fa: {
    listen: ['فقط گوش بده', 'به آهنگ، تکیه و مکث‌های جمله دقت کن.'],
    echo: ['گوش بده، بعد تکرار کن', 'وقتی صدا تمام شد، همان جمله را بلند و با همان آهنگ بگو.'],
    shadow: ['همزمان بخوان', 'هم‌زمان با صدا (یا نیم‌ثانیه پشتش) بلند بخوان.'],
    blind: ['شادوینگ بدون متن', 'متن پنهان است؛ فقط با گوش دنبال کن. برای دیدن، روی کارت بزن.'],
    check: ['گوش بده، بعد بگو', 'بعد از صدا جمله را بلند بگو. کلمه‌های درست سبز، تقریباً درست نارنجی و اشتباه یا جاافتاده قرمز می‌شوند.'],
    final: ['شادوینگ پیوسته', 'کل متن امروز پشت سر هم پخش می‌شود؛ بدون توقف همراهش بخوان.'],
    review: ['مرور جلسهٔ قبل', 'گرم کردن با آخرین جمله‌های دفعهٔ پیش؛ همزمان بخوان.'],
  },
};
export const phaseText = key => PHASES[UI][key];

const TYPES = {
  en: { dialogue: 'Dialogue', reading: 'Reading', phrases: 'Useful phrases', routine: 'Daily routine' },
  fa: { dialogue: 'گفت‌وگو', reading: 'متن خواندنی', phrases: 'جمله‌های کاربردی', routine: 'روتین روزانه' },
};
export const typeName = t => TYPES[UI][t] || tt('Text', 'متن');
