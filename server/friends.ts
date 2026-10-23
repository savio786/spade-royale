// Friends: requests that the other player accepts or rejects, kept on the server.
// Each player has a small record of ids (friends / requests received / requests sent) plus a
// directory entry (name, picture, level, coins) so offline friends can still be shown.
// Whether someone is online is not stored: index.ts knows who is connected.
import { getRecord, putRecord } from './storage';
import type { SocialPerson, SocialView } from '../shared/protocol';

interface Social { friends: string[]; incoming: string[]; outgoing: string[]; declined: string[] }
interface Dir { name: string; avatar: string; level: number; coins: number; seen: number }

const MAX_FRIENDS = 200, MAX_PENDING = 30, MAX_DECLINED = 200;
const safe = (id: string) => String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
const nameKey = (n: string) => `pname-${n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')}`;

const socials = new Map<string, Social>();
const dirs = new Map<string, Dir>();

/** One operation at a time, so two players answering each other's requests can't corrupt the lists. */
let chain: Promise<unknown> = Promise.resolve();
const locked = <T>(fn: () => Promise<T>): Promise<T> => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };

async function social(id: string): Promise<Social> {
  const k = safe(id);
  let s = socials.get(k);
  if (!s) {
    const rec = await getRecord<Partial<Social>>(`social-${k}`);
    s = { friends: rec?.friends ?? [], incoming: rec?.incoming ?? [], outgoing: rec?.outgoing ?? [], declined: rec?.declined ?? [] };
    socials.set(k, s);
  }
  return s;
}
const saveSocial = (id: string) => putRecord(`social-${safe(id)}`, socials.get(safe(id)));

async function dir(id: string): Promise<Dir | null> {
  const k = safe(id);
  let d = dirs.get(k) ?? null;
  if (!d) { d = await getRecord<Dir>(`dir-${k}`); if (d) dirs.set(k, d); }
  return d;
}

/** Called when a verified player connects: keeps their name, picture, level and coins fresh, and lets others find them by name. */
export function registerPlayer(id: string, info: { name: string; avatar: string; level: number; coins: number }) {
  return locked(async () => {
    const k = safe(id), old = await dir(id), now = Date.now();
    const d: Dir = { name: info.name.slice(0, 20), avatar: info.avatar, level: info.level, coins: info.coins, seen: now };
    const changed = !old || old.name !== d.name || old.avatar !== d.avatar || old.level !== d.level || Math.abs(old.coins - d.coins) > Math.max(50, old.coins * 0.05) || now - old.seen > 3_600_000;
    dirs.set(k, d);
    if (!changed) return;
    await putRecord(`dir-${k}`, d);
    // first player to use a name owns it for searching (guest names are always unique)
    const nk = nameKey(d.name);
    if (!(await getRecord<{ id: string }>(nk))) await putRecord(nk, { id: k });
  });
}

/** Everyone linked to this player (so they can be told when this player comes online or goes offline). */
export async function relatives(id: string): Promise<string[]> {
  const s = await social(id);
  return [...new Set([...s.friends, ...s.incoming, ...s.outgoing])];
}

async function person(id: string, online: (id: string) => boolean): Promise<SocialPerson> {
  const d = await dir(id);
  return { id, name: d?.name ?? 'Player', avatar: d?.avatar ?? 'a1', level: d?.level ?? 1, coins: d?.coins ?? 0, online: online(id) };
}

export async function view(id: string, online: (id: string) => boolean): Promise<SocialView> {
  const s = await social(id);
  const all = (ids: string[]) => Promise.all(ids.map((x) => person(x, online)));
  const [friends, incoming, outgoing] = await Promise.all([all(s.friends), all(s.incoming), all(s.outgoing)]);
  // online friends first, then by name
  friends.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  incoming.sort((a, b) => Number(b.online) - Number(a.online));
  return { friends, incoming, outgoing };
}

export interface Result { ok: boolean; message: string; touched: string[]; notes: { to: string; text: string }[] }
const fail = (message: string): Result => ({ ok: false, message, touched: [], notes: [] });
const without = (a: string[], id: string) => a.filter((x) => x !== id);
const add = (a: string[], id: string) => (a.includes(id) ? a : [...a, id]);

async function becomeFriends(a: string, b: string) {
  const sa = await social(a), sb = await social(b);
  sa.friends = add(sa.friends, b); sb.friends = add(sb.friends, a);
  sa.incoming = without(sa.incoming, b); sa.outgoing = without(sa.outgoing, b);
  sb.incoming = without(sb.incoming, a); sb.outgoing = without(sb.outgoing, a);
  await Promise.all([saveSocial(a), saveSocial(b)]);
}

/** Send a friend request, by player name or by id (from a player's profile card). */
export function request(me: string, target: { name?: string; id?: string }): Promise<Result> {
  return locked(async () => {
    me = safe(me);
    let other = '';
    if (target.id) other = safe(target.id);
    else {
      const n = String(target.name ?? '').trim();
      if (n.replace(/[^\p{L}\p{N}]/gu, '').length < 3) return fail('Type the full player name.');
      other = (await getRecord<{ id: string }>(nameKey(n)))?.id ?? '';
    }
    const od = other ? await dir(other) : null;
    if (!other || !od) return fail(target.name ? `No player named “${String(target.name).trim().slice(0, 20)}” was found. Check the spelling.` : 'That player could not be found.');
    if (other === me) return fail('That’s you!');
    const mine = await social(me), theirs = await social(other);
    if (mine.friends.includes(other)) return fail(`You and ${od.name} are already friends.`);
    if (mine.incoming.includes(other)) { // they already asked me: asking them back makes us friends
      await becomeFriends(me, other);
      const md = await dir(me);
      return { ok: true, message: `You and ${od.name} are now friends!`, touched: [me, other], notes: [{ to: other, text: `${md?.name ?? 'A player'} accepted your friend request` }] };
    }
    if (mine.outgoing.includes(other)) return fail(`Your request to ${od.name} is already waiting for an answer.`);
    if (mine.outgoing.length >= MAX_PENDING) return fail('You have too many requests waiting. Wait for answers or cancel some.');
    if (mine.friends.length >= MAX_FRIENDS) return fail('Your friends list is full.');
    mine.outgoing = add(mine.outgoing, other);
    const notes: Result['notes'] = [];
    // someone who declined you before doesn't get nagged: the request just stays on your side
    if (!theirs.declined.includes(me) && theirs.incoming.length < 100 && theirs.friends.length < MAX_FRIENDS) {
      theirs.incoming = add(theirs.incoming, me);
      const md = await dir(me);
      notes.push({ to: other, text: `${md?.name ?? 'A player'} sent you a friend request` });
      await saveSocial(other);
    }
    await saveSocial(me);
    return { ok: true, message: `Friend request sent to ${od.name}.`, touched: [me, other], notes };
  });
}

/** Accept or reject a request someone sent me. */
export function respond(me: string, other: string, accept: boolean): Promise<Result> {
  return locked(async () => {
    me = safe(me); other = safe(other);
    const mine = await social(me);
    if (!mine.incoming.includes(other)) return fail('That request is no longer there.');
    const od = await dir(other), md = await dir(me);
    if (accept) {
      if (mine.friends.length >= MAX_FRIENDS) return fail('Your friends list is full.');
      await becomeFriends(me, other);
      return { ok: true, message: `You and ${od?.name ?? 'the player'} are now friends!`, touched: [me, other], notes: [{ to: other, text: `${md?.name ?? 'A player'} accepted your friend request` }] };
    }
    const theirs = await social(other);
    mine.incoming = without(mine.incoming, other);
    theirs.outgoing = without(theirs.outgoing, me); // the sender isn't told it was declined
    mine.declined = add(mine.declined, other).slice(-MAX_DECLINED);
    await Promise.all([saveSocial(me), saveSocial(other)]);
    return { ok: true, message: 'Request declined.', touched: [me, other], notes: [] };
  });
}

export function remove(me: string, other: string): Promise<Result> {
  return locked(async () => {
    me = safe(me); other = safe(other);
    const mine = await social(me), theirs = await social(other);
    if (!mine.friends.includes(other)) return fail('You are not friends with that player.');
    mine.friends = without(mine.friends, other); theirs.friends = without(theirs.friends, me);
    await Promise.all([saveSocial(me), saveSocial(other)]);
    return { ok: true, message: 'Friend removed.', touched: [me, other], notes: [] };
  });
}

/** Take back a request I sent. */
export function cancel(me: string, other: string): Promise<Result> {
  return locked(async () => {
    me = safe(me); other = safe(other);
    const mine = await social(me), theirs = await social(other);
    mine.outgoing = without(mine.outgoing, other); theirs.incoming = without(theirs.incoming, me);
    await Promise.all([saveSocial(me), saveSocial(other)]);
    return { ok: true, message: 'Request cancelled.', touched: [me, other], notes: [] };
  });
}
