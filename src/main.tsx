import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/lobster/latin-400.css';
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/latin-800.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Offline support + installability (Windows / macOS / iPadOS / Android browsers)
// (The Crows Haven site has no game server — VITE_OFFLINE=1 — but still installs and works offline, so it registers too.)
if ('serviceWorker' in navigator && import.meta.env.PROD && (import.meta.env.VITE_OFFLINE !== '1' || import.meta.env.VITE_CROWS === '1') && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {}); // registered right away so app stores (PWABuilder) detect it
}

// Auto-update: when a new version is deployed, reload so players get it — but never in the middle of a game.
if (import.meta.env.PROD && location.protocol.startsWith('http')) {
  const bundle = (html: string) => html.match(/assets\/index-[\w-]+\.js/)?.[0];
  const mine = bundle(document.documentElement.innerHTML);
  let newer = false;
  const check = async () => {
    if (!newer) {
      try { const html = await (await fetch('./index.html', { cache: 'no-store' })).text(); const live = bundle(html); newer = !!(mine && live && live !== mine); } catch { /* offline */ }
    }
    if (newer && !document.querySelector('.table-screen')) location.reload();
  };
  setInterval(check, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
}
