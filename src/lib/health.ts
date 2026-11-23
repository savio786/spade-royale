// Timing only, no names or ids: every 30 s, if the app felt slow (a click that took over 150 ms to respond, or the page blocked for a while),
// tell the server how long the app has been open and what was slow, so a lag that grows over time can be tracked down.
import { net } from './net';

let started = false;

export function startHealth() {
  if (started || typeof PerformanceObserver === 'undefined') return;
  started = true;
  const t0 = Date.now();
  let lt = 0, ltMs = 0, ev = 0, evName = '', sent = 0;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { lt++; ltMs += e.duration; } }).observe({ type: 'longtask' });
  } catch { /* not supported */ }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as Array<{ duration: number; name: string; interactionId?: number }>) {
        if (e.interactionId && e.duration > ev) { ev = e.duration; evName = e.name; }
      }
    }).observe({ type: 'event', durationThreshold: 40 } as PerformanceObserverInit);
  } catch { /* not supported */ }
  setInterval(() => {
    const slow = ev >= 150 || ltMs >= 400;
    if ((slow || sent === 0) && !document.hidden && net.isOpen()) {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      net.send({
        t: 'health', up: Math.round((Date.now() - t0) / 60000), lt, ltMs: Math.round(ltMs), ev: Math.round(ev), evName,
        heap: mem ? Math.round(mem.usedJSHeapSize / 1048576) : -1, dom: document.getElementsByTagName('*').length,
        screen: document.querySelector('.table-screen') ? 'table' : document.querySelector('.modal') ? 'modal' : 'lobby',
      });
      sent++;
    }
    lt = 0; ltMs = 0; ev = 0; evName = '';
  }, 30_000);
}
