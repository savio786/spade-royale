// Player names are unique. The first player to take a name owns it until they change to a different one,
// and then it is free for anybody else. Spaces, capitals and punctuation don't make a name different:
// "Apex Spade", "apexspade" and "APEX_SPADE" are the same name.
import { getRecord, putRecord } from './storage';
import { BOT_NAMES } from '../shared/bot';
import { PEOPLE_NAMES } from '../shared/runtime';

export const NAME_MIN = 3, NAME_MAX = 20;
const ALLOWED = /[^\p{L}\p{N} _.-]/u;

/** What makes two names "the same": letters and numbers only, lower case. */
export const squash = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const nameKey = (n: string) => `pname-${squash(n)}`;
/** Quietly tidy a name that came from somewhere else (a Google or Facebook profile, say). */
export const cleanName = (n: unknown) => String(n ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

// names nobody can pick: the computer players, official-sounding words, and the automatic Guest12345 names
const RESERVED = new Set([...BOT_NAMES, ...PEOPLE_NAMES].map(squash).concat(['admin', 'administrator', 'moderator', 'mod', 'support', 'staff', 'official', 'system', 'computer', 'spadehaven', 'spaderoyale', 'anonymous']));
const reserved = (sq: string) => RESERVED.has(sq) || /^guest\d*$/.test(sq);

export type NameCheck = { ok: true; name: string } | { ok: false; message: string; code: 'invalid' | 'taken' };
const bad = (message: string, code: 'invalid' | 'taken' = 'invalid'): NameCheck => ({ ok: false, message, code });

/** Is this a name we'd accept at all (ignores whether somebody already has it)? */
export function validate(raw: unknown): NameCheck {
  const s = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (s.length > NAME_MAX) return bad(`Use at most ${NAME_MAX} characters.`);
  if (ALLOWED.test(s)) return bad('Use letters, numbers, spaces and _ - . only.');
  if (squash(s).length < NAME_MIN) return bad(`Names need at least ${NAME_MIN} letters or numbers.`);
  return { ok: true, name: s };
}

export async function ownerOf(name: string): Promise<string> {
  return (await getRecord<{ id?: string }>(nameKey(name)))?.id ?? '';
}

/** Can `selfId` have this name? (`selfName` = the name they have now: keeping it, or only changing capitals, is always fine.) */
export async function availability(raw: unknown, selfId: string, selfName?: string): Promise<NameCheck> {
  const v = validate(raw);
  if (!v.ok) return v;
  const sq = squash(v.name);
  const mine = !!selfName && squash(selfName) === sq;
  if (!mine && reserved(sq)) return bad('That name isn’t available. Try another.', 'taken');
  const owner = await ownerOf(v.name);
  if (owner && owner !== selfId) return bad('That name is already taken. Try another.', 'taken');
  return v;
}

/** One name change at a time, so two players asking for the same name can't both get it. */
let chain: Promise<unknown> = Promise.resolve();
const locked = <T>(fn: () => Promise<T>): Promise<T> => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };

/** Give `id` this name and free the one they had. Fails (and changes nothing) if somebody else already has it. */
export function takeName(id: string, raw: unknown, oldName?: string): Promise<NameCheck> {
  return locked(async () => {
    const v = await availability(raw, id, oldName);
    if (!v.ok) return v;
    await putRecord(nameKey(v.name), { id });
    if (oldName && squash(oldName) !== squash(v.name) && (await ownerOf(oldName)) === id) await putRecord(nameKey(oldName), { id: '' });
    return v;
  });
}

/** Claim a name for an account that already uses it, if nobody else has it (first come, first served). */
export function reserveIfFree(id: string, name: string): Promise<boolean> {
  return locked(async () => {
    if (squash(name).length < 1) return false;
    const owner = await ownerOf(name);
    if (owner && owner !== id) return false;
    if (!owner) await putRecord(nameKey(name), { id });
    return true;
  });
}

/** A name close to `base` that is free: the name itself, or with a few digits added. */
export async function uniqueName(base: string, id = ''): Promise<string> {
  const first = cleanName(base);
  for (let i = 0; i < 25; i++) {
    const tail = i === 0 ? '' : String(Math.floor(1000 + Math.random() * 9000));
    const cand = first.slice(0, NAME_MAX - tail.length) + tail;
    const r = await availability(cand, id);
    if (r.ok) return r.name;
  }
  return `Player${Math.floor(100000 + Math.random() * 900000)}`;
}
