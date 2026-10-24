// "Add Spade Haven to your home screen": a small banner on phones and tablets so players can come back to the game with one tap.
// Browsers never allow a website to put an icon on the home screen by itself, so this offers it:
// Android (Chrome) = one tap on ADD · iPhone / iPad = it shows the two taps in Safari · Messenger / Facebook browsers = how to open it properly.
import { useEffect, useState } from 'react';
import { alreadyInstalled, inAppBrowser, isAndroid, isIOS } from '../screens/Install';
import { sfx } from '../lib/sound';

const DISMISS_KEY = 'spade-haven-a2h-dismissed', DONE_KEY = 'spade-haven-a2h-done';
const SHOW_AGAIN_AFTER = 7 * 24 * 3600e3;   // someone who says "not now" is asked again after a week
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

const ShareIcon = () => (
  <svg className="a2h-share" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share"><path d="M12 15V3M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
);

export function AddToHome({ installPrompt }: { installPrompt: null | (() => void) }) {
  const phone = isIOS() || isAndroid();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!phone || alreadyInstalled() || read(DONE_KEY)) return;
    const d = Number(read(DISMISS_KEY) || 0);
    if (d && Date.now() - d < SHOW_AGAIN_AFTER) return;
    const t = setTimeout(() => setShow(true), 3500); // let the lobby appear first
    return () => clearTimeout(t);
  }, [phone]);
  useEffect(() => {
    const h = () => { write(DONE_KEY, '1'); setShow(false); };
    window.addEventListener('appinstalled', h);
    return () => window.removeEventListener('appinstalled', h);
  }, []);
  if (!show) return null;

  const iab = inAppBrowser(), ios = isIOS();
  const close = () => { sfx.click(); write(DISMISS_KEY, String(Date.now())); setShow(false); };
  const add = () => { sfx.click(); installPrompt?.(); setShow(false); };

  return (
    <div className="a2h" role="dialog" aria-label="Add Spade Haven to your home screen">
      <span className="a2h-ico" aria-hidden="true">♠</span>
      <div className="a2h-text">
        <b>Add Spade Haven to your home screen</b>
        {iab
          ? <small>You’re in {ios ? 'an in-app browser' : 'Messenger / Facebook’s browser'}. Open the game in {ios ? 'Safari' : 'Chrome'} to add it.</small>
          : installPrompt
            ? <small>One tap to come back to your game any time.</small>
            : ios
              ? <small>Tap <ShareIcon /> in Safari, then <b>Add to Home Screen</b>.</small>
              : <small>Tap the <b>⋮</b> menu, then <b>Install app</b> or <b>Add to Home screen</b>.</small>}
      </div>
      {iab
        ? <a className="a2h-add" href="/install" onClick={() => sfx.click()}>HOW</a>
        : installPrompt && <button className="a2h-add" onClick={add}>ADD</button>}
      <button className="a2h-x" onClick={close} aria-label="Not now" title="Not now">✕</button>
    </div>
  );
}
