// Privacy Policy and Terms of Service. Operator details come from build-time env vars.
import { useEffect } from 'react';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const OPERATOR = env.VITE_OPERATOR_NAME || 'SE Digital Transformation';
const BY = OPERATOR ? ` (operated by ${OPERATOR})` : '';
const EMAIL = env.VITE_SUPPORT_EMAIL || 'support@sedigitaltransformation.com';
const UPDATED = 'October 17, 2026';

export function LegalPage({ page }: { page: 'privacy' | 'terms' | 'delete' }) {
  useEffect(() => { window.scrollTo(0, 0); document.title = page === 'privacy' ? 'Privacy Policy · Spade Haven' : page === 'terms' ? 'Terms of Service · Spade Haven' : 'Delete your data · Spade Haven'; return () => { document.title = 'Spade Haven'; }; }, [page]);
  const home = () => { if (/^\/(privacy|terms|data-deletion)\/?$/.test(window.location.pathname)) window.location.href = '/'; else window.location.hash = ''; };
  const back = () => { if (history.length > 1) history.back(); else home(); };
  return (
    <div className="legal-page">
      <header className="legal-top">
        <a href="/" className="legal-brand" onClick={(e) => { e.preventDefault(); home(); }}>♠ Spade Haven</a>
        <nav><a href="/privacy" className={page === 'privacy' ? 'on' : ''}>Privacy</a><a href="/terms" className={page === 'terms' ? 'on' : ''}>Terms</a><button onClick={back}>Back</button></nav>
      </header>
      <article className="legal-body">
        {page === 'privacy' ? <Privacy /> : page === 'terms' ? <Terms /> : <DeleteData />}
        <p className="legal-meta">Last updated {UPDATED}.{EMAIL && <> Questions: <a href={`mailto:${EMAIL}`}>{EMAIL}</a></>}</p>
      </article>
    </div>
  );
}

function Privacy() {
  return (<>
    <h1>Privacy Policy</h1>
    <p>This policy explains what information Spade Haven{BY} (“we”) collects when you play, and how it is used.</p>
    <h2>What we collect</h2>
    <ul>
      <li><b>Game profile:</b> your player name, avatar (and your profile photo, if you upload one — it is shown to other players at your table and on leaderboards), coins, level, game results and settings. Guest accounts receive an automatic name and a recovery code.</li>
      <li><b>Account details:</b> if you create an account, your email address (or the name and email your Google or Facebook account shares with us). Passwords are stored only as a secure one-way hash — we never see or store your actual password.</li>
      <li><b>Chat messages</b> you send at tables, which are relayed to the other players at that table and are not stored after the table closes.</li>
      <li><b>Purchases:</b> when you buy coins or a Chat Pass, payment is handled by Stripe (or by Google Play / the App Store in the mobile apps). We receive a record of what you bought, not your full card details.</li>
      <li><b>Technical data:</b> basic server logs (such as IP address and time of request) used to keep the service running and to prevent abuse.</li>
    </ul>
    <h2>How we use it</h2>
    <p>To run games and leaderboards, keep your progress, deliver purchases, prevent cheating and abuse, and fix problems. We do not sell your personal information and we do not show third-party advertising.</p>
    <h2>Storage on your device</h2>
    <p>Your profile is saved in your browser's local storage so you stay signed in. Clearing your browser data removes it; guests can restore their account with their guest code.</p>
    <h2>Retention and deletion</h2>
    <p>Account and leaderboard data is kept while your account is active. To delete your data, contact us{EMAIL ? <> at <a href={`mailto:${EMAIL}`}>{EMAIL}</a></> : ''} with your player name or guest code.</p>
    <h2>Children</h2>
    <p>Spade Haven is intended for players aged 18 and over and is not directed to children. If you believe a child has given us information, contact us and we will delete it.</p>
    <h2>Changes</h2>
    <p>We may update this policy. The date below shows when it last changed.</p>
  </>);
}

function DeleteData() {
  const subject = encodeURIComponent('Delete my Spade Haven data');
  return (<>
    <h1>Delete your data</h1>
    <p>You can ask us to delete your Spade Haven account and the information we hold about you at any time.</p>
    <h2>How to ask</h2>
    <ol>
      <li>Email <a href={`mailto:${EMAIL}?subject=${subject}`}>{EMAIL}</a> from the address you signed up with (or tell us your player name or guest code).</li>
      <li>Put “Delete my Spade Haven data” in the subject.</li>
      <li>We will confirm by email and delete your account within 30 days.</li>
    </ol>
    <h2>What is deleted</h2>
    <p>Your profile, name, avatar and photo, coins, level, game history, leaderboard entries, and the email, name and ID that came from Email, Google or Facebook sign-in. If you signed in with Facebook, you can also remove Spade Haven in Facebook under Settings → Apps and Websites.</p>
    <h2>What we may keep</h2>
    <p>Records of purchases that we are required by law to keep (for tax and accounting). These are held by our payment provider and contain no game data.</p>
    <p>See also our <a href="/privacy">Privacy Policy</a>.</p>
  </>);
}

function Terms() {
  return (<>
    <h1>Terms of Service</h1>
    <p>By playing Spade Haven{BY} you agree to these terms.</p>
    <h2>Eligibility</h2>
    <p>You must be at least 18 years old to play.</p>
    <h2>Virtual coins — no real-money gambling</h2>
    <p>Coins, Chat Passes, trophies and other items are virtual and for entertainment only. They have no cash value, cannot be exchanged for money or prizes, and cannot be transferred or sold. Spade Haven is not a real-money gaming or gambling service.</p>
    <h2>Purchases</h2>
    <p>Purchases of coins and Chat Passes are final once delivered, except where refunds are required by law or by the store you purchased through. Prices are shown before you pay.</p>
    <h2>Fair play and conduct</h2>
    <ul>
      <li>No cheating, collusion between opponents, bots or automation, or exploiting bugs.</li>
      <li>No harassment, hate speech, threats, spam or sharing personal information in chat.</li>
      <li>Profile photos must be appropriate for all players and must not show someone else without their permission. We remove photos that break this rule.</li>
      <li>Players who repeatedly miss turns are removed from the table automatically.</li>
    </ul>
    <p>We may suspend accounts, remove coins or reset leaderboard positions that break these rules.</p>
    <h2>Accounts</h2>
    <p>Keep your guest code safe — it is the only way to restore a guest account on a new device.</p>
    <h2>The service</h2>
    <p>The game is provided “as is”. We work to keep it available but may change, pause or end features at any time. To the extent the law allows, we are not liable for indirect losses or for loss of virtual items.</p>
    <h2>Changes</h2>
    <p>We may update these terms; continuing to play after an update means you accept them.</p>
  </>);
}
