// Crows Haven player names: the same rules as Spade Haven (server/names.ts). Used by the game and the game server.
// Spaces, capitals and punctuation don't make a name different: "Savio Dias", "saviodias" and "SAVIO_DIAS" are one name.
import { CROWS_PORTRAITS } from '../../src/crows/portraits';
import { BOT_PHOTOS } from '../botphotos';

export const NAME_MIN = 3, NAME_MAX = 20;
export const squash = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const isGuestName = (n: string) => /^Guest\d{5}$/.test(n);
const RESERVED = new Set([...CROWS_PORTRAITS, ...BOT_PHOTOS].map((p) => squash(p.name))
  .concat(['admin', 'administrator', 'moderator', 'mod', 'support', 'staff', 'official', 'system', 'computer', 'crowshaven', 'crow', 'spadehaven', 'player']));

export type NameCheck = { ok: true; name: string } | { ok: false; message: string };

/** Is this a name we'd accept at all? Automatic Guest12345 names are only allowed when `guest` is set. */
export function validateName(raw: unknown, guest = false): NameCheck {
  const s = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (guest && isGuestName(s)) return { ok: true, name: s };
  if (s.length > NAME_MAX) return { ok: false, message: `Use at most ${NAME_MAX} characters.` };
  if (/[^\p{L}\p{N} _.-]/u.test(s)) return { ok: false, message: 'Use letters, numbers, spaces and _ - . only.' };
  const sq = squash(s);
  if (sq.length < NAME_MIN) return { ok: false, message: `Names need at least ${NAME_MIN} letters or numbers.` };
  if (RESERVED.has(sq) || /^guest\d*$/.test(sq) || /^player\d*$/.test(sq)) return { ok: false, message: 'That name is reserved — please pick another.' };
  return { ok: true, name: s };
}
