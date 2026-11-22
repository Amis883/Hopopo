// Reading books: PDF (pdf.js) and EPUB (JSZip). Libraries ship with the app and load on demand.
const PDFJS = 'lib/pdf.min.js', PDFJS_WORKER = 'lib/pdf.worker.min.js', JSZIP = 'lib/jszip.min.js';

export function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => rej(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}

export async function openPdf(file) {
  // Loading the worker script first lets pdf.js run in the page when real workers are blocked (sandboxed frames).
  if (!window.pdfjsLib) { await loadScript(PDFJS_WORKER); await loadScript(PDFJS); }
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(PDFJS_WORKER, location.href).href;
  return pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
}

/** True when the first pages have (almost) no text layer — i.e. it's a scan and needs OCR. */
export async function pdfLooksScanned(pdf) {
  let letters = 0; const probe = Math.min(pdf.numPages, 6);
  for (let i = 1; i <= probe; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    letters += tc.items.map(x => x.str || '').join('').replace(/[^\p{L}]/gu, '').length;
  }
  return letters / probe < 60;
}

/** Text layer → lines, inserting blank lines where vertical gaps suggest paragraph breaks. */
export async function pdfToText(pdf, onProgress) {
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const lines = []; let line = '', lastY = null, lastH = 0, prevLineY = null;
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2 && line.trim()) {
        if (prevLineY !== null && Math.abs(prevLineY - lastY) > (lastH || 10) * 1.9) lines.push('');
        lines.push(line); prevLineY = lastY; line = '';
      }
      line += it.str; lastY = y; lastH = it.height || lastH;
      if (it.hasEOL) { if (line.trim()) { lines.push(line); prevLineY = y; } line = ''; }
    }
    if (line.trim()) lines.push(line);
    pages.push(lines.join('\n'));
    if (onProgress) onProgress(p, pdf.numPages);
  }
  return pages.join('\n');
}

export async function pdfPageCanvas(page) {
  const v1 = page.getViewport({ scale: 1 }), scale = Math.min(3, 2200 / Math.max(v1.width, v1.height)), v = page.getViewport({ scale });
  const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: x, viewport: v }).promise;
  return c;
}

/** Photo → canvas (downscaled to keep OCR fast on phones). */
export async function imageCanvas(file) {
  let img, w, h;
  try { img = await createImageBitmap(file); w = img.width; h = img.height; }
  catch (e) {
    img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(`Could not open "${file.name}" (HEIC? convert to JPG)`)); im.src = URL.createObjectURL(file); });
    w = img.naturalWidth; h = img.naturalHeight;
  }
  const sc = Math.min(1, 2400 / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.round(w * sc); c.height = Math.round(h * sc);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export function canvasBlob(c, maxSide = 1600) {
  const sc = Math.min(1, maxSide / Math.max(c.width, c.height));
  let src = c;
  if (sc < 1) { src = document.createElement('canvas'); src.width = Math.round(c.width * sc); src.height = Math.round(c.height * sc); src.getContext('2d').drawImage(c, 0, 0, src.width, src.height); }
  return new Promise(res => src.toBlob(b => res(b), 'image/jpeg', 0.85));
}

const normPath = p => { const out = []; for (const seg of p.split('/')) { if (seg === '..') out.pop(); else if (seg && seg !== '.') out.push(seg); } return out.join('/'); };

/** EPUB: follow container.xml → OPF spine, take leaf text blocks of each chapter. */
export async function epubToText(file) {
  if (!window.JSZip) await loadScript(JSZIP);
  const zip = await JSZip.loadAsync(file);
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const opfPath = xml(await zip.file('META-INF/container.xml').async('string')).querySelector('rootfile').getAttribute('full-path');
  const opf = xml(await zip.file(opfPath).async('string'));
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const man = {}; opf.querySelectorAll('manifest > item').forEach(i => { man[i.getAttribute('id')] = i.getAttribute('href'); });
  const out = [];
  for (const ref of opf.querySelectorAll('spine > itemref')) {
    const href = man[ref.getAttribute('idref')]; if (!href) continue;
    const f = zip.file(decodeURIComponent(normPath(base + href.split('#')[0]))); if (!f) continue;
    const doc = new DOMParser().parseFromString(await f.async('string'), 'text/html');
    doc.querySelectorAll('script,style,h1,h2,h3,h4,h5,h6').forEach(n => n.remove());
    const blocks = [...doc.body.querySelectorAll('p,li,blockquote,dd,div')].filter(el => !el.querySelector('p,li,div,blockquote'));
    out.push(blocks.map(b => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n'));
  }
  return out.join('\n\n');
}
