import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The multiplayer server runs on :8787 (npm run server). In dev/preview the
// websocket is proxied so the client can always use same-origin "/ws".
const proxy = { '/ws': { target: 'ws://localhost:8787', ws: true }, '/api': { target: 'http://localhost:8787' } };

// Crows Haven site (builds with VITE_CROWS=1, e.g. the crows-haven Vercel project): give index.html the
// Crows Haven title, icon, manifest and link-preview text. Without VITE_CROWS the page is left exactly as is (Spades).
const CROWS_URL = 'https://crows-haven.vercel.app/';
const CROWS_DESC = 'Crows Haven is a free four-player partnership card game: bid for the nest, name trump and capture the Crow. Play in your browser against computer players.';
const CROW_PATH = 'M70 30c-4-6-12-8-18-4-5 3-7 8-7 13-8 1-17 7-21 16l-7 2 8 3c1 5 6 9 13 10l-4 9h4l5-8h7l-2 8h4l3-9c9-2 15-9 15-18 0-5-2-9-5-12l10-3-10-1c0-2 1-4 0-6z';
function crowsHtml(): Plugin {
  return {
    name: 'crows-haven-html',
    transformIndexHtml(html) {
      return html
        // catch the browser's one-time "you can install this" signal before the game has even loaded
        .replace('<head>', `<head>\n    <script>window.__crowsBip=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__crowsBip=e;dispatchEvent(new Event('crowsbip'));});addEventListener('appinstalled',function(){window.__crowsBip=null;window.__crowsInstalled=true;dispatchEvent(new Event('crowsbip'));});</script>`)
        .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${CROWS_DESC}" />`)
        .replace(/<meta name="keywords"[^>]*>/, '<meta name="keywords" content="crows haven, partnership card game, trick-taking card game, bidding card game, nest card game" />')
        .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${CROWS_URL}" />`)
        .replace(/<meta name="theme-color"[^>]*>/, '<meta name="theme-color" content="#0f2b22" />')
        .replace(/<meta name="apple-mobile-web-app-title"[^>]*>/, '<meta name="apple-mobile-web-app-title" content="Crows Haven" />')
        .replace(/<link rel="manifest"[^>]*>/, '<link rel="manifest" href="./crows/manifest.webmanifest" />')
        .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/svg+xml" href="./crows/icon.svg" />')
        .replace(/<link rel="apple-touch-icon"[^>]*>/, '<link rel="apple-touch-icon" href="./crows/apple-touch-icon.png" />')
        .replace(/\s*<meta (property|name)="(og|twitter):image[^>]*>/g, '')
        .replace(/<meta property="og:site_name"[^>]*>/, '<meta property="og:site_name" content="Crows Haven" />')
        .replace(/<meta (property|name)="(og|twitter):title"[^>]*>/g, (_m, a, b) => `<meta ${a}="${b}:title" content="Crows Haven — bid for the nest, capture the Crow" />`)
        .replace(/<meta (property|name)="(og|twitter):description"[^>]*>/g, (_m, a, b) => `<meta ${a}="${b}:description" content="${CROWS_DESC}" />`)
        .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${CROWS_URL}" />`)
        .replace(/<meta name="twitter:card"[^>]*>/, '<meta name="twitter:card" content="summary" />')
        .replace(/<title>[^<]*<\/title>/, '<title>Crows Haven — bid for the nest, capture the Crow</title>')
        .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"Crows Haven","url":"${CROWS_URL}","description":"${CROWS_DESC}","applicationCategory":"GameApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}</script>`)
        .replace('background: #12052e;', 'background: #0f2b22;')
        .replace('radial-gradient(circle at 50% 40%, #4b1fa8, #12052e 70%)', 'radial-gradient(circle at 50% 40%, #1f5a46, #0b1f19 70%)')
        .replace('aria-label="Loading Spade Haven"', 'aria-label="Loading Crows Haven"')
        .replace(/<svg viewBox="0 0 100 100" fill="#ffc83d" aria-hidden="true"><path d="[^"]*"\/><\/svg>/, `<svg viewBox="0 0 100 100" fill="#f3e6c4" aria-hidden="true"><path d="${CROW_PATH}"/></svg>`)
        .replace('<b>SPADE HAVEN</b>', '<b>CROWS HAVEN</b>')
        .replace(/<h1>[^<]*<\/h1>\s*<p>[\s\S]*?<\/p>/, `<h1>Crows Haven</h1>\n        <p>${CROWS_DESC}</p>`)
        .replace(/<noscript>[\s\S]*?<\/noscript>/, '<noscript><p style="color:#fff;font-family:system-ui,sans-serif;padding:24px">Crows Haven is a free card game. Please turn on JavaScript to play.</p></noscript>');
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  return {
    plugins: [react(), ...(env.VITE_CROWS === '1' ? [crowsHtml()] : [])],
    base: './',
    server: { host: true, proxy },
    preview: { host: true, proxy },
    build: { target: 'es2019', chunkSizeWarningLimit: 900 },
  };
});
