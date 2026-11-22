// Serves the bundled language data (stored as .js) to the OCR worker instead of downloading .gz files.
const _fetch = self.fetch.bind(self);
self.fetch = async (input, opts) => {
  const u = String(input && input.url ? input.url : input);
  const m = u.match(/\/(deu|eng)\.traineddata(\.gz)?(\?.*)?$/);
  if (m) {
    self.TESS_DATA = self.TESS_DATA || {};
    if (!self.TESS_DATA[m[1]]) importScripts(new URL('lang/' + m[1] + '.traineddata.js', self.location.href).href);
    const s = atob(self.TESS_DATA[m[1]]), bin = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
    return new Response(bin, { status: 200 });
  }
  return _fetch(input, opts);
};
importScripts('worker.min.js');
