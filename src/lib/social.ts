// Friends, as told by the game server: your friends, requests people sent you, and requests you sent.
// The server also says who is online right now, so names can light up.
import { useSyncExternalStore } from 'react';
import type { ClientMsg, SocialPerson } from '../../shared/protocol';
import { net } from './net';
import { profile } from './profile';
import { toast } from './toast';
import { sfx } from './sound';

export interface Social { loaded: boolean; friends: SocialPerson[]; incoming: SocialPerson[]; outgoing: SocialPerson[] }
const EMPTY: Social = { loaded: false, friends: [], incoming: [], outgoing: [] };
let state: Social = EMPTY;
const subs = new Set<() => void>();
const set = (s: Social) => { state = s; subs.forEach((f) => f()); };

net.on((m) => {
  if (m.t === 'social') {
    set({ loaded: true, friends: m.friends, incoming: m.incoming, outgoing: m.outgoing });
  } else if (m.t === 'friendMsg') {
    toast(m.message, m.ok ? 'info' : 'error');
    if (m.ok && /sent you a friend request|accepted/.test(m.message)) sfx.coins();
  }
});
// signing out or switching player: forget the previous player's friends
profile.onBeforeReset(() => set(EMPTY));

/** Friends need the live server; say so instead of silently queuing the tap. */
const live = (m: ClientMsg) => {
  if (net.status !== 'online') { toast('Friends need a connection to the game server — try again in a moment.', 'error'); return; }
  net.send(m);
};
export const social = {
  get: () => state,
  addByName: (name: string) => live({ t: 'friendRequest', name }),
  addById: (id: string) => live({ t: 'friendRequest', id }),
  accept: (id: string) => live({ t: 'friendRespond', id, accept: true }),
  reject: (id: string) => live({ t: 'friendRespond', id, accept: false }),
  remove: (id: string) => live({ t: 'friendRemove', id }),
  cancel: (id: string) => live({ t: 'friendCancel', id }),
};

export function useSocial() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
}

/** Friends that are online right now (for the lobby badge). */
export const onlineCount = (s: Social) => s.friends.filter((f) => f.online).length;
