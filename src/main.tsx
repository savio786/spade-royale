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
if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.VITE_OFFLINE !== '1' && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {}); // registered right away so app stores (PWABuilder) detect it
}
