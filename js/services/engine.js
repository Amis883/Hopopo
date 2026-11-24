// Which speech recognizer to use for the speech check.
//  'phone'   – the browser's Web Speech recognition (Siri / Google). Fast, no download.
//  'whisper' – in-app Whisper (services/whisper.js). Works where the phone's recognizer doesn't,
//              e.g. iPhone home-screen apps, which get the API but never receive results.
import { recognitionSupported } from './speech.js';
import { micSupported } from './mic.js';

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isInstalled = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

export function engineFor(track) {
  const pref = track.srEngine || 'auto';
  if (pref === 'phone' && recognitionSupported()) return 'phone';
  if (pref === 'whisper' && micSupported()) return 'whisper';
  if ((isIOS() && isInstalled()) || !recognitionSupported()) return micSupported() ? 'whisper' : 'phone';
  return 'phone';
}
