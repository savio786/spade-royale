import { useSyncExternalStore } from 'react';

export interface Toast { id: number; text: string; kind: 'info' | 'coins' | 'error' }
let toasts: Toast[] = [];
let id = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function toast(text: string, kind: Toast['kind'] = 'info') {
  const t = { id: ++id, text, kind };
  toasts = [...toasts, t].slice(-3);
  emit();
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); emit(); }, 2800);
}
export function useToasts() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => toasts);
}
