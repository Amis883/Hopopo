<p align="center"><img src="icons/icon-512.png" width="120" alt="Hopopo"></p>

<h1 align="center">Hopopo</h1>
<p align="center"><b>A little repetition every day, like the hoopoe</b><br>Daily shadowing practice for any language, from your own textbook. Installable PWA, works offline.</p>

<p align="center"><a href="https://amis883.github.io/Hopopo/"><b>Open the app →</b></a></p>

---

## English

**Hopopo** turns your textbook into short daily **shadowing** sessions (listen, then speak along) in any of 21 languages: English, German, Dutch, French, Spanish, Italian, Portuguese, Swedish, Danish, Norwegian, Polish, Turkish, Russian, Ukrainian, Greek, Arabic, Persian, Hindi, Japanese, Chinese and Korean. Each language is a separate track with its own level, book and progress.

- **Your own material:** photos of pages, PDFs (scanned or text), EPUB, TXT or pasted text. OCR runs on your device.
- **Keeps what's worth shadowing:** dialogues, reading texts and everyday phrases. Drops exercises, gap-fills and word lists. You review the picks before adding them.
- **10–20 minute sessions sized to your level (A1–C1):** listen → say it and get checked (×2) → speak along. Each session ends with one continuous pass and starts the next day with a short review.
- **Speech check:** after each sentence the app listens and colours each word green, orange or red.
- **Streaks and progress per language.** Share prepared lessons with friends as `.shadow.json` packs.
- **Interface in English or Persian** (RTL). Private by design: no account, no server, data stays on your device.

### Works with Shadowing Audio Generator 🎧
Hopopo pairs with **[Dutch Language Shadowing Audio Generator](https://github.com/salmansoltaniyan/Dutch-Language-Shadowing-Audio-Generator)** by [Salman Soltaniyan](https://github.com/salmansoltaniyan), a tool that renders a lesson to MP3 with natural neural voices (Google Chirp 3 HD / Microsoft Edge) and adds a translation after each sentence.

| | Audio Generator | Hopopo |
|---|---|---|
| Role | **Produces** the audio: studio-quality voices, translations, repeats and pauses | **Runs the practice**: daily plan, speech check, progress, streaks |
| Runs on | Windows / Python | Any phone browser (installable PWA) |

Open the generated **MP3** in Hopopo (*Book & settings → 🎧 Recorded audio lesson*). Hopopo reads the timeline the generator embeds in the MP3 (ID3 `TXXX:SHADOWING_TIMELINE`, or the `.json` next to it), detects the language, and turns every sentence into a step: you hear the **recorded voice**, see the **translation** under the sentence, then say it and get it checked. The shared timeline format is the contract between the two projects (see [ARCHITECTURE.md §5.7](ARCHITECTURE.md#57-interop-with-the-audio-generator)).

Architecture, design decisions and testing: **[ARCHITECTURE.md](ARCHITECTURE.md)**.

### Install on your phone
1. Open **https://amis883.github.io/Hopopo/**
2. **iPhone:** open it in Safari, tap Share → **Add to Home Screen**. **Android:** in Chrome, tap ⋮ → **Install app**.
3. Make sure your phone has a voice for the language you're learning (iPhone: Settings → Accessibility → Spoken Content → Voices; Android: Text-to-speech → Install voice data).

### Develop
```bash
npm start   # serves the folder on http://localhost:8080 (any static server works)
npm test    # unit tests for the core logic (Node 20+, no dependencies)
```
No build step: plain HTML, CSS and native ES modules. Third-party libraries are vendored: `ocr/` (Tesseract.js and its WASM core) and `lib/` (pdf.js, JSZip).

---

## فارسی

**Hopopo** کتاب درسی خودت را به جلسه‌های کوتاه روزانهٔ **شادوینگ** تبدیل می‌کند، برای ۲۱ زبان (انگلیسی، آلمانی، هلندی، فرانسوی، اسپانیایی و …). هر زبان مسیر جدای خودش را دارد، با سطح، کتاب و پیشرفت جدا. زبان دیگری هم بخواهی، از صفحهٔ اول «افزودن زبان دیگر» را بزن.

- **کتاب خودت:** عکس صفحه‌ها، PDF (اسکن‌شده یا متنی)، EPUB، TXT یا متن کپی‌شده. تشخیص متن روی خود گوشی انجام می‌شود.
- **انتخاب متن‌های مفید:** گفت‌وگوها، متن‌های خواندنی و جمله‌های روزمره نگه داشته می‌شوند و تمرین‌ها و فهرست لغت کنار می‌روند. قبل از افزودن، انتخاب‌ها را می‌بینی.
- **جلسه‌های ۱۰ تا ۲۰ دقیقه‌ای متناسب با سطحت (A1 تا C1):** گوش دادن، گفتن و بررسی (۲ بار)، و شادوینگ همزمان.
- **بررسی گفتار:** کلمه‌های درست سبز، تقریباً درست نارنجی و اشتباه یا جاافتاده قرمز می‌شوند.
- **زبان خود اپ** انگلیسی یا فارسی است و با دکمهٔ «فا / EN» در صفحهٔ اول عوض می‌شود.

- **همکاری با [Shadowing Audio Generator](https://github.com/salmansoltaniyan/Dutch-Language-Shadowing-Audio-Generator):** فایل MP3 ساخته‌شده با آن ابزار (صدای طبیعی + ترجمهٔ فارسی) را در Hopopo باز کن تا جلسه‌های تمرین با همان صدا، ترجمه و بررسی گفتار اجرا شود.

**نصب:** آدرس بالا را در Safari آیفون (Share ← Add to Home Screen) یا Chrome اندروید (⋮ ← Install app) باز کن.
