// A player deleting their own account: removes what identifies them, keeps what the game must keep.
// Removed: the account (progress, email, password), guest code, email login, name reservation, friends, profile picture, leaderboard entries, chat mute.
// Kept: payment records (accounting), reports other players sent about them, and any suspension.
import { Account, acctKey, codeKey } from './accounts';
import { emailRef } from './auth';
import { erase } from './friends';
import { removePlayer } from './leaderboard';
import { forget } from './moderation';
import { nameKey } from './names';
import { deleteRecord, getRecord, putRecord } from './storage';

export async function deleteAccount(id: string, key: string): Promise<{ ok: true; photo?: string } | { ok: false; status: number; message: string }> {
  const a = await getRecord<Account>(acctKey(id));
  if (!a || !key || a.key !== key) return { ok: false, status: 403, message: 'Sign in again to delete your account.' };
  if ((await getRecord<{ id?: string }>(nameKey(a.name)))?.id === a.id) await putRecord(nameKey(a.name), { id: '' });   // the name is free again
  if (a.email && a.kind === 'email') await deleteRecord(emailRef(a.email.trim().toLowerCase()));
  await Promise.all([deleteRecord(codeKey(a.code)), erase(a.id)]);
  removePlayer(a.id, a.name);
  forget(a.id);
  await deleteRecord(acctKey(a.id));
  const av = String((a.profile as { avatar?: unknown } | null)?.avatar ?? '');
  return { ok: true, photo: /^u:[a-f0-9]{24}$/.test(av) ? av.slice(2) : undefined };
}
