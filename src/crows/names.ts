// Crows Haven player names: the same rules as Spade Haven (server/names.ts), checked on this device.
// (The Crows Haven site has no account server, so names are not reserved across players yet.)
import { profile } from '../lib/profile';
import { CROWS_PORTRAITS } from './portraits';
import { BOT_PHOTOS } from '../../shared/botphotos';

export const NAME_MIN = 3, NAME_MAX = 20;
const squash = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const RESERVED = new Set([...CROWS_PORTRAITS, ...BOT_PHOTOS].map((p) => squash(p.name))
  .concat(['admin', 'administrator', 'moderator', 'mod', 'support', 'staff', 'official', 'system', 'computer', 'crowshaven', 'crow', 'spadehaven']));

/** Returns the tidied name, or a message saying what's wrong. */
export function checkName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (s.length > NAME_MAX) return { ok: false, message: `Use at most ${NAME_MAX} characters.` };
  if (/[^\p{L}\p{N} _.-]/u.test(s)) return { ok: false, message: 'Use letters, numbers, spaces and _ - . only.' };
  const sq = squash(s);
  if (sq.length < NAME_MIN) return { ok: false, message: `Names need at least ${NAME_MIN} letters or numbers.` };
  if (RESERVED.has(sq) || /^guest\d*$/.test(sq)) return { ok: false, message: 'That name is reserved — please pick another.' };
  return { ok: true, name: s };
}

/** Save the new name on this device (and in the remembered guest, so it stays after the app is closed). */
export function saveName(name: string) {
  profile.set({ name });
  try {
    const v = JSON.parse(localStorage.getItem('spade-royale-guest') || 'null');
    if (v) localStorage.setItem('spade-royale-guest', JSON.stringify({ ...v, name, profile: profile.get() }));
  } catch { /* storage unavailable */ }
}
