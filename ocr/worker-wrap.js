// Runs inside the OCR Web Worker before Tesseract. Serves language data:
//  - German and English ship with the app as ocr/lang/<code>.traineddata.js (works offline and inside
//    sandboxes that block downloads);
//  - any other language is fetched once from the tesseract.js-data package on jsDelivr.
const BUNDLED = ['deu', 'eng'];
const _fetch = self.fetch.bind(self);
self.fetch = async (input, opts) => {
  const u = String(input && input.url ? input.url : input);
  const m = u.match(/\/([a-z_]+)\.traineddata(\.gz)?(\?.*)?$/);
  if (m) {
    const code = m[1];
    if (BUNDLED.includes(code)) {
      self.TESS_DATA = self.TESS_DATA || {};
      if (!self.TESS_DATA[code]) importScripts(new URL('lang/' + code + '.traineddata.js', self.location.href).href);
      const s = atob(self.TESS_DATA[code]), bin = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
      return new Response(bin, { status: 200 });
    }
    return _fetch(`https://cdn.jsdelivr.net/npm/@tesseract.js-data/${code}/4.0.0_best_int/${code}.traineddata.gz`, opts);
  }
  return _fetch(input, opts);
};
importScripts('worker.min.js');
