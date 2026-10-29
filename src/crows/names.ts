// Crows Haven player names. The rules are in shared/crows/names.ts (the same as Spade Haven).
// With the game server switched on, names are unique: the server keeps the list (crows-server → Names).
import { profile } from '../lib/profile';
import { validateName, isGuestName, NAME_MAX } from '../../shared/crows/names';
import { onlineAvailable, nameOnServer } from './online';
import { deviceSecret } from './CrowsRanking';
export { NAME_MAX };

export type SaveResult = { ok: true; name: string } | { ok: false; message: string; taken?: boolean };

/** Save the name on this device (and in the remembered guest, so it stays after the app is closed). */
function keepName(name: string) {
  profile.set({ name });
  try {
    const v = JSON.parse(localStorage.getItem('spade-royale-guest') || 'null');
    if (v) localStorage.setItem('spade-royale-guest', JSON.stringify({ ...v, name, profile: profile.get() }));
  } catch { /* storage unavailable */ }
}

/** Take a new name: checked against the rules, then reserved on the game server so nobody else can have it. */
export async function changeName(raw: string): Promise<SaveResult> {
  const v = validateName(raw);
  if (!v.ok) return v;
  if (!onlineAvailable()) { keepName(v.name); return v; }
  const secret = deviceSecret();
  if (!secret) return { ok: false, message: 'This browser won’t let us save your name (private mode?).' };
  try {
    const r = await nameOnServer(profile.get().id, secret, v.name);
    if (!r.ok) return { ok: false, message: r.message ?? 'That name can’t be used.', taken: r.taken };
    keepName(r.name ?? v.name);
    return { ok: true, name: r.name ?? v.name };
  } catch {
    return { ok: false, message: 'Can’t reach the game server to check the name. Check your connection and try again.' };
  }
}

const newGuestName = () => `Guest${10000 + Math.floor(Math.random() * 90000)}`;

/** On opening the game: make sure the server has your name. Returns a message if you need to pick another one. */
export async function registerMyName(): Promise<string | null> {
  if (!onlineAvailable()) return null;
  const secret = deviceSecret();
  if (!secret) return null;
  const p = profile.get();
  try {
    let name = p.name;
    for (let tries = 0; tries < 5; tries++) {
      const r = await nameOnServer(p.id, secret, name);
      // the server knows a different name for us (chosen on this device earlier): use it — but never undo a
      // name the player saved while this check was on its way
      if (r.ok) { if (r.name && r.name !== name && profile.get().name === p.name) keepName(r.name); return null; }
      if (!r.taken && !isGuestName(name)) return r.message ?? null;
      if (!isGuestName(name)) return `Someone else already has the name “${name}”. Please pick a new name.`;
      name = newGuestName();                       // two guests with the same number: quietly take another
      keepName(name);
    }
  } catch { /* server unreachable: try again next time */ }
  return null;
}
