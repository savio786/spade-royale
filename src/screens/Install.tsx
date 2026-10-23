// The page behind the install link (…/install): works out what phone / browser this is and shows the one thing that works there.
import { useEffect, useState } from 'react';
import { Icon, Logo } from '../components/ui';

export const INSTALL_URL = () => `${window.location.origin}/install`;

const ua = () => navigator.userAgent;
const isIOS = () => /iPhone|iPad|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/i.test(ua());
/** Facebook / Messenger / Instagram… open links in their own mini browser, which cannot install apps. */
const inAppBrowser = () => /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|Snapchat|TikTok|MicroMessenger|Twitter/i.test(ua());
const alreadyInstalled = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return <li className="inst-step"><span className="inst-n">{n}</span><span>{children}</span></li>;
}

/** The iPhone "Share" icon: a square with an arrow coming out of the top. */
const ShareIcon = () => (
  <svg className="inst-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share"><path d="M12 15V3M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
);

export function InstallPage({ installPrompt }: { installPrompt: null | (() => void) }) {
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);
  const ios = isIOS(), android = isAndroid(), iab = inAppBrowser(), installed = alreadyInstalled();
  const desktop = !ios && !android;
  useEffect(() => { document.title = 'Install Spade Haven'; }, []);
  useEffect(() => { const h = () => setDone(true); window.addEventListener('appinstalled', h); return () => window.removeEventListener('appinstalled', h); }, []);

  const copy = async () => {
    try { await navigator.clipboard.writeText(INSTALL_URL()); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt('Copy this link:', INSTALL_URL()); }
  };
  const share = () => { navigator.share?.({ title: 'Spade Haven', text: 'Play Spades with me on Spade Haven — install it from this link:', url: INSTALL_URL() }).catch(() => {}); };
  const play = () => { window.location.href = `${window.location.origin}/#play`; };
  // Android: ask Chrome to open this very page (Messenger and Facebook's browser allow this "intent" link)
  const chromeIntent = `intent://${window.location.host}/install#Intent;scheme=https;package=com.android.chrome;end`;

  return (
    <div className="inst felt-bg">
      <div className="inst-card">
        <Logo compact />
        <h1>Install Spade Haven</h1>
        <p className="inst-lead">Put the game on your home screen: one tap to open, full screen, no browser bars.</p>

        {(installed || done) && (
          <div className="inst-box ok">
            <b>✓ Spade Haven is installed on this device.</b>
            <span>Open it from your home screen, or play right now:</span>
            <button className="pill green big" onClick={play}><Icon name="play" size={20} /> Play now</button>
          </div>
        )}

        {!installed && !done && iab && (
          <div className="inst-box warn">
            <b>This browser can’t install apps</b>
            <span>You opened the link inside Facebook, Messenger or another app. Open it in {ios ? 'Safari' : 'Chrome'} first:</span>
            {android && <a className="pill green big" href={chromeIntent}>Open in Chrome</a>}
            <ol className="inst-steps">
              {ios
                ? <><Step n={1}>Tap the <b>⋯</b> or <b>Share</b> button at the top or bottom of this screen.</Step><Step n={2}>Choose <b>Open in Safari</b>.</Step></>
                : <><Step n={1}>Or tap the <b>⋮</b> menu at the top right.</Step><Step n={2}>Choose <b>Open in browser</b> / <b>Open in Chrome</b>.</Step></>}
            </ol>
          </div>
        )}

        {!installed && !done && !iab && android && (
          installPrompt ? (
            <div className="inst-box">
              <button className="pill green big" onClick={installPrompt}><Icon name="download" size={20} /> Install the app</button>
              <span>Tap Install, then Install again in the box that pops up.</span>
            </div>
          ) : (
            <div className="inst-box">
              <b>Install from Chrome’s menu</b>
              <ol className="inst-steps">
                <Step n={1}>Tap the <b>⋮</b> menu at the top right of Chrome.</Step>
                <Step n={2}>Tap <b>Install app</b> (or <b>Add to Home screen</b>).</Step>
                <Step n={3}>Tap <b>Install</b>. Spade Haven appears on your home screen.</Step>
              </ol>
              <span className="inst-fine">Not seeing it? Use Chrome (or Samsung Internet), and make sure you opened the link in the browser, not inside another app.</span>
            </div>
          )
        )}

        {!installed && !done && !iab && ios && (
          <div className="inst-box">
            <b>Add it to your Home Screen</b>
            <ol className="inst-steps">
              <Step n={1}>Tap the <b>Share</b> button <ShareIcon /> in Safari (bottom of the screen on iPhone, top on iPad).</Step>
              <Step n={2}>Scroll down and tap <b>Add to Home Screen</b>.</Step>
              <Step n={3}>Tap <b>Add</b>. Spade Haven appears on your home screen.</Step>
            </ol>
            <span className="inst-fine">iPhone and iPad only allow this from Safari or Chrome, and not from inside other apps.</span>
          </div>
        )}

        {!installed && !done && desktop && (
          <div className="inst-box">
            {installPrompt && <button className="pill green big" onClick={installPrompt}><Icon name="download" size={20} /> Install on this computer</button>}
            <b>Installing on a phone?</b>
            <span>Open this link on the phone — copy it or share it from here:</span>
            <code className="inst-link">{INSTALL_URL()}</code>
          </div>
        )}

        <div className="inst-actions">
          <button className="pill blue" onClick={copy}>{copied ? '✓ Link copied' : 'Copy install link'}</button>
          {typeof navigator.share === 'function' && <button className="pill blue" onClick={share}>Share link</button>}
        </div>
        <button className="inst-play" onClick={play}>Or just play in the browser →</button>
      </div>
    </div>
  );
}
