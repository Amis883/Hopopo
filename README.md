<p align="center"><img src="icons/icon-512.png" width="120" alt="Hopopo"></p>

<h1 align="center">Hopopo</h1>
<p align="center"><b>هر روز کمی تکرار، مثل هدهد</b><br>Daily shadowing practice for English &amp; German. Installable PWA, works offline.</p>

---

## فارسی

**Hopopo** یک اپ وب نصب‌شدنی (PWA) برای تمرین روزانهٔ **شادوینگ** است، با دو مسیر جدا برای انگلیسی و آلمانی.

- **کتاب خودت:** عکس صفحه‌ها، PDF (اسکن‌شده یا متنی)، EPUB یا TXT را وارد کن. متن عکس‌ها روی خود گوشی خوانده می‌شود (OCR).
- **انتخاب متن‌های مفید:** گفت‌وگوها، متن‌های خواندنی و جمله‌های روزمره نگه داشته می‌شوند و تمرین‌ها، جای‌خالی‌ها و فهرست لغت کنار می‌روند.
- **جلسه‌های ۱۰ تا ۲۰ دقیقه‌ای:** متن بر اساس سطح تو (A1 تا C1) تکه‌تکه می‌شود. هر تکه این مراحل را دارد: گوش دادن، گفتن و بررسی، و شادوینگ همزمان. آخر جلسه کل متن آن روز یک بار پیوسته شادوینگ می‌شود.
- **بررسی گفتار:** بعد از هر جمله اپ صدایت را می‌شنود. کلمه‌های درست سبز و اشتباه‌ها قرمز می‌شوند (۲ بار برای هر جمله).
- **پیشرفت:** روزهای پشت‌سرهم شمرده می‌شوند، تقویم هفتگی و درصد پیشرفت در کتاب نشان داده می‌شود، و فردا از همان‌جایی ادامه می‌دهی که امروز تمام کردی.
- **اشتراک‌گذاری:** هر درس را با دکمهٔ 📤 به شکل یک بستهٔ `.shadow.json` برای دوستت بفرست.

### نصب روی گوشی
1. **Settings ← Pages** را باز کن و در بخش Branch گزینهٔ `main` و پوشهٔ `/ (root)` را انتخاب کن و Save را بزن.
2. آدرس سایت را باز کن: `https://amis883.github.io/Hopopo/`
   - **آیفون:** در Safari دکمهٔ Share و بعد **Add to Home Screen** را بزن.
   - **اندروید:** در Chrome از منوی ⋮ گزینهٔ **Install app** را بزن.
3. **صدای آلمانی:** در آیفون از Settings ← Accessibility ← Spoken Content ← Voices، و در اندروید از Text-to-speech، صدای Deutsch را دانلود کن.

## English

**Hopopo** is an installable web app for daily **shadowing** practice in English and German, with a separate track, level and progress for each language.

- Import your own textbook: page photos, scanned or text PDFs, EPUB or TXT. OCR runs on the device (Tesseract.js, bundled).
- Keeps dialogues, reading texts and everyday phrases, and skips exercises and word lists.
- Builds 10–20 minute daily sessions sized to your level (A1–C1). Each chunk goes through: listen → say it and get checked (×2) → shadow along. The session ends with a continuous shadowing pass.
- Speech check uses the browser's speech recognition and marks each word green, orange or red.
- Works offline once installed. Your data stays on your device.

### Tech
Plain HTML, CSS and JS with no build step. Text-to-speech uses the Web Speech API. Bundled libraries: `ocr/` holds Tesseract.js with German and English data, and `lib/` holds pdf.js and JSZip.
