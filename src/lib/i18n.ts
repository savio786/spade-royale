// Translations: the English text itself is the key, so a string with no translation simply shows in English.
// Each language is its own small file, downloaded only for players who use it.
import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'es' | 'hi';
export const LANGS: { id: Lang; name: string }[] = [{ id: 'en', name: 'English' }, { id: 'es', name: 'Español' }, { id: 'hi', name: 'हिन्दी' }];
const KEY = 'spade-haven-lang';
const loaders: Record<Exclude<Lang, 'en'>, () => Promise<{ default: Record<string, string> }>> = {
  es: () => import('../locales/es'),
  hi: () => import('../locales/hi'),
};

let lang: Lang = 'en';
let dict: Record<string, string> = {};
const subs = new Set<() => void>();

/** Translate a string. {name}-style placeholders are filled from vars. */
export function t(s: string, vars?: Record<string, string | number>): string {
  const out = dict[s] ?? s;
  return vars ? out.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : out;
}

function pick(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved && (saved === 'en' || saved in loaders)) return saved;
  } catch { /* storage blocked */ }
  return 'en';   // English unless the player chose another language in Settings
}

async function load(l: Lang) {
  dict = l === 'en' ? {} : (await loaders[l]()).default;
  lang = l;
  document.documentElement.lang = l;
  subs.forEach((f) => f());
}

/** Called once before the first paint, so a Spanish or Hindi player never sees a flash of English. */
export async function initLang() {
  const l = pick();
  if (l !== 'en') { try { await load(l); } catch { /* offline: stay in English */ } }
}

export async function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  try { await load(l); } catch { /* offline: keep the current language */ }
}

export function useLang(): Lang {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => lang);
}
