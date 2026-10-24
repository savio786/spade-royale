// "Add Spade Haven to your home screen": a small banner so players can come back to the game with one tap.
// Browsers never allow a website to put an icon on the home screen by itself, so this offers it:
// Chrome / Edge / Opera / Samsung = one tap on ADD · iPhone / iPad = the two taps in Safari · Mac Safari = File → Add to Dock
// · Messenger / Facebook browsers = how to open it properly. Firefox on a computer can't install web apps, so it gets no banner.
import { useEffect, useState } from 'react';
import { Rich } from '../screens/Install';
import { alreadyInstalled, installGuide, thisDevice } from '../lib/device';
import { sfx } from '../lib/sound';

const DISMISS_KEY = 'spade-haven-a2h-dismissed', DONE_KEY = 'spade-haven-a2h-done';
const SHOW_AGAIN_AFTER = 7 * 24 * 3600e3;   // someone who says "not now" is asked again after a week
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export function AddToHome({ installPrompt }: { installPrompt: null | (() => void) }) {
  const dev = thisDevice();
  const guide = installGuide(dev, !!installPrompt);
  // phones & tablets always; computers only when the browser can really install (its one-tap offer, or Safari on a Mac)
  const eligible = dev.inApp ? dev.mobile : dev.mobile ? true : !!installPrompt || (dev.platform === 'mac' && dev.browser === 'safari');
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!eligible || alreadyInstalled() || read(DONE_KEY)) return;
    const d = Number(read(DISMISS_KEY) || 0);
    if (d && Date.now() - d < SHOW_AGAIN_AFTER) return;
    const t = setTimeout(() => setShow(true), 3500); // let the lobby appear first
    return () => clearTimeout(t);
  }, [eligible]);
  useEffect(() => {
    const h = () => { write(DONE_KEY, '1'); setShow(false); };
    window.addEventListener('appinstalled', h);
    return () => window.removeEventListener('appinstalled', h);
  }, []);
  if (!show || !eligible) return null;

  const close = () => { sfx.click(); write(DISMISS_KEY, String(Date.now())); setShow(false); };
  const add = () => { sfx.click(); installPrompt?.(); setShow(false); };
  const where = dev.mobile ? 'your home screen' : dev.platform === 'mac' ? 'your Dock' : 'your desktop';

  return (
    <div className="a2h" role="dialog" aria-label={`Add Spade Haven to ${where}`}>
      <span className="a2h-ico" aria-hidden="true">♠</span>
      <div className="a2h-text">
        <b>Add Spade Haven to {where}</b>
        {dev.inApp
          ? <small>You’re in an app’s own browser. Open the game in {dev.platform === 'ios' ? 'Safari' : 'Chrome'} to add it.</small>
          : installPrompt
            ? <small>One tap to come back to your game any time.</small>
            : <small><Rich text={guide.short.replace('Share', '**Share**')} iconClass="a2h-share" /></small>}
      </div>
      {dev.inApp || !guide.supported
        ? <a className="a2h-add" href="/install" onClick={() => sfx.click()}>HOW</a>
        : installPrompt && <button className="a2h-add" onClick={add}>ADD</button>}
      <button className="a2h-x" onClick={close} aria-label="Not now" title="Not now">✕</button>
    </div>
  );
}
