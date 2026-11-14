// Usage counts (first-party, no third party): "the tutorial was finished", "a rematch started"… Counts are collected in memory and sent
// as one tiny message every 20 seconds or when the player leaves the page. It never waits on the network and never touches a card play.
import { serverOrigin } from './config';
import { profile } from './profile';

export type EventName =
  | 'app_open' | 'tutorial_shown' | 'tutorial_start' | 'tutorial_done' | 'tutorial_skip'
  | 'game_start' | 'game_online' | 'game_end' | 'rematch_request' | 'rematch_start'
  | 'table_invite_share' | 'table_link_open' | 'invite_link_open' | 'daily_gift' | 'hand_review_open';

let pending: Partial<Record<EventName, number>> = {};
let timer: ReturnType<typeof setTimeout> | null = null;
const off = () => typeof navigator !== 'undefined' && (navigator.doNotTrack === '1' || (window as unknown as { doNotTrack?: string }).doNotTrack === '1');

function send(final: boolean) {
  if (timer) { clearTimeout(timer); timer = null; }
  const ev = pending;
  if (!Object.keys(ev).length) return;
  pending = {};
  const base = serverOrigin();
  if (!base) return;
  const body = JSON.stringify({ id: profile.get().id, ev });
  try {
    // text/plain keeps it a "simple" request (no extra round trip); the server reads the JSON either way
    if (final && navigator.sendBeacon) navigator.sendBeacon(`${base}/api/track`, new Blob([body], { type: 'text/plain' }));
    else void fetch(`${base}/api/track`, { method: 'POST', body, headers: { 'content-type': 'text/plain' }, keepalive: true }).catch(() => {});
  } catch { /* counting must never break the game */ }
}

/** Count one event. Safe to call anywhere: it only adds to a number in memory. */
export function track(e: EventName) {
  if (off()) return;
  pending[e] = (pending[e] ?? 0) + 1;
  if (!timer) timer = setTimeout(() => send(false), 20_000);
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(true); });
  window.addEventListener('pagehide', () => send(true));
}
