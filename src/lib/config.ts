// Where the game server lives.
// - Website served by the server itself (Render): same address as the page.
// - Android / iPhone / iPad apps: the app runs from inside the phone, so it must be told the live server.
//   Override with VITE_SERVER_URL (e.g. wss://your-domain.com/ws) when building the apps.
import { Capacitor } from '@capacitor/core';

export const LIVE_SERVER = 'https://spade-haven.onrender.com';

/** https://… origin of the game server, or null when there is none (offline build). */
export function serverOrigin(): string | null {
  if (import.meta.env.VITE_OFFLINE === '1') return null;
  const ws = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (ws) return ws.replace(/^ws/, 'http').replace(/\/ws\/?$/, '');
  if (Capacitor.isNativePlatform()) return LIVE_SERVER;
  const { protocol, origin } = window.location;
  return protocol === 'http:' || protocol === 'https:' ? origin : null;
}

/** wss://… address of the multiplayer socket. */
export function socketUrl(): string | null {
  const ws = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (ws && import.meta.env.VITE_OFFLINE !== '1') return ws;
  const o = serverOrigin();
  return o ? o.replace(/^http/, 'ws') + '/ws' : null;
}
