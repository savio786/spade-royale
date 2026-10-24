// The page behind the install link (…/install): works out what device + browser this is and shows the one thing that works there.
// The same link works for everybody (iPhone, Android, Windows, Mac, Linux, Chromebook; Safari, Chrome, Edge, Firefox, Samsung, Opera…).
import { useEffect, useState } from 'react';
import { Icon, Logo } from '../components/ui';
import { BROWSER_NAME, OTHER_DEVICES, PLATFORM_NAME, alreadyInstalled, installGuide, thisDevice } from '../lib/device';

export const INSTALL_URL = () => `${window.location.origin}/install`;

/** The iPhone "Share" icon: a square with an arrow coming out of the top. */
export const ShareIcon = ({ className = 'inst-ico' }: { className?: string }) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share"><path d="M12 15V3M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
);

/** "Tap **Share** {share}" → text with bold words and the Share icon. */
export function Rich({ text, iconClass }: { text: string; iconClass?: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|\{share\})/g).map((part, i) =>
    part === '{share}' ? <ShareIcon key={i} className={iconClass} />
      : part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b>
        : <span key={i}>{part}</span>)}</>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return <li className="inst-step"><span className="inst-n">{n}</span><span>{children}</span></li>;
}

export function InstallPage({ installPrompt }: { installPrompt: null | (() => void) }) {
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);
  const [dev] = useState(thisDevice);
  const installed = alreadyInstalled();
  const guide = installGuide(dev, !!installPrompt);
  const { platform, browser, inApp } = dev;
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
  const showing = !installed && !done;
  const where = platform === 'other' ? 'this device' : `${PLATFORM_NAME[platform]}${browser === 'other' ? '' : ` · ${BROWSER_NAME[browser]}`}`;

  return (
    <div className="inst felt-bg">
      <div className="inst-card">
        <Logo compact />
        <h1>Install Spade Haven</h1>
        <p className="inst-lead">Put the game on your home screen or desktop: one tap to open, full screen, no browser bars. Works on phones, tablets and computers.</p>

        {!showing && (
          <div className="inst-box ok">
            <b>✓ Spade Haven is installed on this device.</b>
            <span>Open it from your home screen or desktop, or play right now:</span>
            <button className="pill green big" onClick={play}><Icon name="play" size={20} /> Play now</button>
          </div>
        )}

        {showing && inApp && (
          <div className="inst-box warn">
            <b>This browser can’t install apps</b>
            <span>You opened the link inside Facebook, Messenger or another app. Open it in {platform === 'ios' ? 'Safari' : 'your browser'} first:</span>
            {platform === 'android' && <a className="pill green big" href={chromeIntent}>Open in Chrome</a>}
            <ol className="inst-steps">
              {platform === 'ios'
                ? <><Step n={1}>Tap the <b>⋯</b> or <b>Share</b> button at the top or bottom of this screen.</Step><Step n={2}>Choose <b>Open in Safari</b>.</Step></>
                : <><Step n={1}>Tap the <b>⋮</b> or <b>⋯</b> menu.</Step><Step n={2}>Choose <b>Open in browser</b> / <b>Open in Chrome</b>.</Step></>}
            </ol>
          </div>
        )}

        {showing && !inApp && (
          <div className="inst-box">
            <span className="inst-where">Detected: <b>{where}</b></span>
            {installPrompt && (
              <>
                <button className="pill green big" onClick={installPrompt}><Icon name="download" size={20} /> Install the app</button>
                <span>Click Install, then Install again in the box that pops up.</span>
              </>
            )}
            {!(installPrompt && guide.supported && (platform === 'android' || platform === 'windows' || platform === 'linux' || platform === 'chromeos' || platform === 'mac')) && (
              <>
                <b>{guide.supported ? 'How to add it' : `${BROWSER_NAME[browser]} can’t add it here`}</b>
                <ol className="inst-steps">
                  {guide.steps.map((s, i) => <Step key={i} n={i + 1}><Rich text={s} /></Step>)}
                </ol>
                {guide.note && <span className="inst-fine">{guide.note}</span>}
              </>
            )}
            {installPrompt && guide.supported && <span className="inst-fine">Button not working? {guide.short}</span>}
          </div>
        )}

        {showing && (
          <details className="inst-others" open={!dev.mobile && !installPrompt}>
            <summary>Installing on another device?</summary>
            <span>Open this link on that device (copy it or share it from here):</span>
            <code className="inst-link">{INSTALL_URL()}</code>
            <ul>
              {OTHER_DEVICES.map(d => <li key={d.name}><b>{d.name}</b> {d.how}</li>)}
            </ul>
          </details>
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
