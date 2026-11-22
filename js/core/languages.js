// Language catalog and learning profiles. Pure data: no DOM, no browser APIs.

/**
 * Every language a learner can add as a track.
 *  id      – short key used in storage and packs
 *  tts     – BCP-47 tag for speech synthesis and speech recognition
 *  ocr     – Tesseract traineddata code
 *  wps     – average spoken words per second at rate 1 (used to estimate session length)
 *  nospace – script without spaces between words (counted by characters instead)
 *  rtl     – written right-to-left
 */
export const CATALOG = [
  { id: 'en', name: 'English',    fa: 'انگلیسی',   native: 'English',    tts: 'en-US', ocr: 'eng', wps: 2.6, hello: 'Hello! I practise a little English every day.' },
  { id: 'de', name: 'German',     fa: 'آلمانی',    native: 'Deutsch',    tts: 'de-DE', ocr: 'deu', wps: 2.2, hello: 'Hallo! Ich lerne jeden Tag ein bisschen Deutsch.' },
  { id: 'nl', name: 'Dutch',      fa: 'هلندی',     native: 'Nederlands', tts: 'nl-NL', ocr: 'nld', wps: 2.4, hello: 'Hallo! Ik oefen elke dag een beetje Nederlands.' },
  { id: 'fr', name: 'French',     fa: 'فرانسوی',   native: 'Français',   tts: 'fr-FR', ocr: 'fra', wps: 2.6, hello: 'Bonjour ! Je pratique un peu le français chaque jour.' },
  { id: 'es', name: 'Spanish',    fa: 'اسپانیایی', native: 'Español',    tts: 'es-ES', ocr: 'spa', wps: 2.8, hello: 'Hola. Practico un poco de español cada día.' },
  { id: 'it', name: 'Italian',    fa: 'ایتالیایی', native: 'Italiano',   tts: 'it-IT', ocr: 'ita', wps: 2.6, hello: 'Ciao! Pratico un po’ di italiano ogni giorno.' },
  { id: 'pt', name: 'Portuguese', fa: 'پرتغالی',   native: 'Português',  tts: 'pt-BR', ocr: 'por', wps: 2.6, hello: 'Olá! Pratico um pouco de português todos os dias.' },
  { id: 'sv', name: 'Swedish',    fa: 'سوئدی',     native: 'Svenska',    tts: 'sv-SE', ocr: 'swe', wps: 2.4, hello: 'Hej! Jag övar lite svenska varje dag.' },
  { id: 'da', name: 'Danish',     fa: 'دانمارکی',  native: 'Dansk',      tts: 'da-DK', ocr: 'dan', wps: 2.4, hello: 'Hej! Jeg øver lidt dansk hver dag.' },
  { id: 'no', name: 'Norwegian',  fa: 'نروژی',     native: 'Norsk',      tts: 'nb-NO', ocr: 'nor', wps: 2.4, hello: 'Hei! Jeg øver litt norsk hver dag.' },
  { id: 'pl', name: 'Polish',     fa: 'لهستانی',   native: 'Polski',     tts: 'pl-PL', ocr: 'pol', wps: 2.2, hello: 'Cześć! Codziennie trochę ćwiczę polski.' },
  { id: 'tr', name: 'Turkish',    fa: 'ترکی',      native: 'Türkçe',     tts: 'tr-TR', ocr: 'tur', wps: 2.2, hello: 'Merhaba! Her gün biraz Türkçe çalışıyorum.' },
  { id: 'ru', name: 'Russian',    fa: 'روسی',      native: 'Русский',    tts: 'ru-RU', ocr: 'rus', wps: 2.2, hello: 'Привет! Я каждый день немного занимаюсь русским.' },
  { id: 'uk', name: 'Ukrainian',  fa: 'اوکراینی',  native: 'Українська', tts: 'uk-UA', ocr: 'ukr', wps: 2.2, hello: 'Привіт! Я щодня трохи вчу українську.' },
  { id: 'el', name: 'Greek',      fa: 'یونانی',    native: 'Ελληνικά',   tts: 'el-GR', ocr: 'ell', wps: 2.4, hello: 'Γεια σου! Εξασκούμαι λίγο στα ελληνικά κάθε μέρα.' },
  { id: 'ar', name: 'Arabic',     fa: 'عربی',      native: 'العربية',    tts: 'ar-SA', ocr: 'ara', wps: 2.0, rtl: true, hello: 'مرحبا! أتدرب قليلا على العربية كل يوم.' },
  { id: 'fa', name: 'Persian',    fa: 'فارسی',     native: 'فارسی',      tts: 'fa-IR', ocr: 'fas', wps: 2.2, rtl: true, hello: 'سلام! هر روز کمی فارسی تمرین می‌کنم.' },
  { id: 'hi', name: 'Hindi',      fa: 'هندی',      native: 'हिन्दी',       tts: 'hi-IN', ocr: 'hin', wps: 2.4, hello: 'नमस्ते! मैं हर दिन थोड़ी हिंदी का अभ्यास करता हूँ।' },
  { id: 'ja', name: 'Japanese',   fa: 'ژاپنی',     native: '日本語',      tts: 'ja-JP', ocr: 'jpn', wps: 2.4, nospace: true, hello: 'こんにちは。毎日少し日本語を練習しています。' },
  { id: 'zh', name: 'Chinese',    fa: 'چینی',      native: '中文',        tts: 'zh-CN', ocr: 'chi_sim', wps: 2.4, nospace: true, hello: '你好！我每天练习一点中文。' },
  { id: 'ko', name: 'Korean',     fa: 'کره‌ای',    native: '한국어',       tts: 'ko-KR', ocr: 'kor', wps: 2.2, hello: '안녕하세요! 저는 매일 한국어를 조금씩 연습해요.' },
];

const BY_ID = Object.fromEntries(CATALOG.map(l => [l.id, l]));
const FALLBACK = { id: 'xx', name: 'Unknown', fa: '؟', native: '?', tts: 'en-US', ocr: 'eng', wps: 2.4, hello: 'Hello!' };

export const lang = id => BY_ID[id] || { ...FALLBACK, id, tts: id };
export const isKnownLang = id => id in BY_ID;
export const isNoSpace = id => !!(BY_ID[id] && BY_ID[id].nospace);
export const isRtl = id => !!(BY_ID[id] && BY_ID[id].rtl);

const PALETTE = ['#2f6fed', '#d9861a', '#1f9e89', '#c2410c', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];
export const trackColor = (id, index) => id === 'en' ? 'var(--en)' : id === 'de' ? 'var(--de)' : PALETTE[(index + 2) % PALETTE.length];

/**
 * Learning profiles per CEFR level. A chunk runs through `phases` in order:
 *  listen – just listen;  echo – listen, then a silent gap to repeat;  shadow – speak along;
 *  blind  – shadow with the text hidden.  `r` is the speech rate.
 */
export const PROFILES = {
  A1: { maxWords: 8,  phases: [{ t: 'listen', r: .7 }, { t: 'echo', r: .7 }, { t: 'echo', r: .8 }, { t: 'shadow', r: .8 }, { t: 'shadow', r: .85 }], finalRate: .8 },
  A2: { maxWords: 10, phases: [{ t: 'listen', r: .8 }, { t: 'echo', r: .8 }, { t: 'shadow', r: .85 }, { t: 'shadow', r: .9 }], finalRate: .85 },
  B1: { maxWords: 15, phases: [{ t: 'listen', r: .9 }, { t: 'echo', r: .9 }, { t: 'shadow', r: .95 }, { t: 'shadow', r: .95, blind: true }], finalRate: .95 },
  B2: { maxWords: 22, phases: [{ t: 'listen', r: 1 }, { t: 'shadow', r: 1 }, { t: 'shadow', r: 1.05, blind: true }], finalRate: 1 },
  C1: { maxWords: 30, phases: [{ t: 'listen', r: 1.05 }, { t: 'shadow', r: 1.05 }, { t: 'shadow', r: 1.1, blind: true }], finalRate: 1.05 },
};
export const LEVELS = Object.keys(PROFILES);

/** Built-in sample texts (original), so a new track can be tried before importing a book. */
export const SAMPLES = {
  de: { title: 'Sample: Mein Tag (A1)', text:
`Ich heiße Lena. Ich bin dreißig Jahre alt. Ich wohne in Hamburg. Meine Wohnung ist klein, aber hell.

Am Morgen stehe ich um sieben Uhr auf. Ich trinke einen Kaffee und esse ein Brötchen. Dann fahre ich mit dem Bus zur Arbeit. Ich arbeite in einem Büro. Meine Kollegen sind nett.

Um zwölf Uhr esse ich mit Tom zu Mittag. Tom kommt aus Spanien. Er spricht gut Deutsch. Am Nachmittag habe ich viele Termine. Um fünf Uhr gehe ich nach Hause.

Am Abend koche ich gern. Heute koche ich Nudeln mit Tomatensoße. Dann lese ich ein Buch, oder ich sehe fern.

Am Wochenende besuche ich meine Eltern. Sie wohnen in einem Dorf. Dort ist es sehr ruhig. Wir gehen zusammen spazieren. Ich bin gern bei meinen Eltern.` },
  en: { title: 'Sample: The Quiet Power of Small Habits (B2)', text:
`Most people imagine that big changes require big decisions. In reality, the habits that shape our lives are usually small, almost invisible actions repeated day after day.

Consider someone who wants to become fluent in a new language. Spending an entire weekend memorising vocabulary might feel productive, but the knowledge tends to fade within a week. On the other hand, fifteen minutes of focused practice every morning builds a foundation that keeps growing.

The secret is not intensity but consistency. When an activity becomes part of your routine, it stops depending on motivation. You no longer have to negotiate with yourself every time you sit down to practise.

Researchers who study learning often point out that the brain strengthens the connections it uses most frequently. In other words, repetition is not boring busywork; it is how skills become automatic.

Of course, a habit only works if it is realistic. If you set a goal that requires two hours a day, you will probably give up as soon as life gets busy. It is far better to choose something so manageable that you can do it even on your worst day.

Over months, those modest sessions add up to hundreds of hours of practice. Looking back, you may be surprised by how far you have travelled, one small step at a time.` },
  nl: { title: 'Sample: Mijn dag (A1)', text:
`Ik heet Sanne. Ik woon in Utrecht. Mijn huis is klein, maar gezellig.

Ik sta om zeven uur op. Ik drink koffie en ik eet een boterham. Dan fiets ik naar mijn werk. Ik werk in een bibliotheek. Mijn collega's zijn aardig.

's Avonds kook ik graag. Vandaag maak ik soep. Daarna lees ik een boek of ik kijk televisie.

In het weekend bezoek ik mijn ouders. Ze wonen in een dorp. Het is daar heel rustig. We wandelen samen in het bos.` },
};
