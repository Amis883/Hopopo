// Entry point: wires DOM events to the view modules' actions and boots the app.
import { S } from './data/store.js';
import { setUI, tt } from './i18n.js';
import { ttsSupported } from './services/speech.js';
import { ui, toast, isFramed } from './ui/dom.js';
import * as home from './ui/home.js';
import * as track from './ui/track.js';
import * as importFlow from './ui/importFlow.js';
import * as session from './ui/session.js';
import * as welcome from './ui/welcome.js';

setUI(S.ui || 'en');

/**
 * Event delegation: every interactive element carries data-act="name"; each view module
 * exports an `actions` map. One listener per event type for the whole app.
 */
const actions = { ...home.actions, ...track.actions, ...importFlow.actions, ...session.actions, ...welcome.actions };

document.addEventListener('click', ev => {
  if (session.onTextClick(ev)) return;
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const fn = actions[el.dataset.act]; if (!fn) return;
  try { const r = fn(el, ev); if (r && r.catch) r.catch(reportError); } catch (e) { reportError(e); }
});
document.addEventListener('input', ev => track.onInput(ev));
document.addEventListener('change', ev => { importFlow.onChange(ev); track.onChange(ev); });
document.addEventListener('keydown', ev => track.onKeydown(ev));

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); ui.deferredInstall = e; if (ui.view === 'home') home.renderHome(); });
/*
 * Self-update for the installed app. Phones resume a PWA instead of restarting it, so on every
 * resume we ask the browser to re-check sw.js. A new service worker takes over (skipWaiting +
 * clients.claim) and fires `controllerchange`; we then reload — immediately on the home screens,
 * or after the current session so practice is never interrupted.
 */
if ('serviceWorker' in navigator && !isFramed) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;            // first install: nothing to update
    reloading = true;
    if (ui.view === 'session') { ui.pendingReload = true; toast(tt('A new version is ready — it will load after this session.', 'نسخهٔ جدید آماده است — بعد از این جلسه بارگذاری می‌شود.'), 5000); }
    else location.reload();
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      setInterval(check, 30 * 60 * 1000);
    } catch (e) { /* offline or unsupported */ }
  });
}
if (!ttsSupported()) setTimeout(() => toast(tt('This browser doesn\'t support text-to-speech. Try Safari or Chrome.', 'این مرورگر از تبدیل متن به گفتار پشتیبانی نمی‌کند. Safari یا Chrome را امتحان کن.'), 6000), 500);

/** Show unexpected errors instead of failing silently, so problems can be reported with a screenshot. */
function reportError(e) {
  const msg = (e && (e.message || e.reason && e.reason.message)) || String(e);
  console.error(e);
  toast('⚠ ' + tt('Something went wrong: ', 'خطا: ') + msg, 6000);
}
window.addEventListener('error', e => reportError(e.error || e.message));
window.addEventListener('unhandledrejection', e => reportError(e.reason));

if (S.onboarded === false || !S.order.length) welcome.renderWelcome(); else home.renderHome();
