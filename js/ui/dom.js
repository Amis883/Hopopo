// Small DOM helpers and UI-wide state shared by the view modules.

export const app = document.getElementById('app');
export const $ = s => document.querySelector(s);
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
export function toast(msg, ms = 3200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

/** Status line inside the import panel. */
export function say(text, isError) { const m = $('#impmsg'); if (m) { m.className = isError ? 'msg err' : 'msg'; m.textContent = text; } }

/** Running inside an iframe (e.g. the Claude artifact viewer): no service worker, mic or downloads there. */
export const isFramed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
export const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

/** Which screen is showing and which language track it is about. */
export const ui = { view: 'home', lang: null, deferredInstall: null };

const pad = n => String(n).padStart(2, '0');
export const mmss = sec => { sec = Math.max(0, Math.round(sec)); return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`; };
