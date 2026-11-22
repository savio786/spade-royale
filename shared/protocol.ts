import type { Action, Mode, TableSettings } from './engine';
import type { Snapshot } from './runtime';

/** solo/partners: real people seated at tables of that mode · lobby: connected people not at a table · total: everyone connected */
export type OnlineCounts = Record<Mode, number> & { total: number; lobby?: number };

export interface PlayerHello { id: string; name: string; avatar: string; level: number; chat?: boolean; stats?: import('./engine').PublicStats }

export interface TableSummary {
  id: string;
  settings: TableSettings;
  players: number;   // humans + bots seated
  humans: number;
  phase: string;
  /** who sits where (null = empty seat) */
  seats: ({ name: string; avatar: string; bot: boolean; level: number } | null)[];
}

/** One person in your friends screen. `online` = connected to the game server right now. */
export interface SocialPerson { id: string; name: string; avatar: string; level: number; coins: number; online: boolean }
/** Your friends, requests people sent you (incoming) and requests you sent (outgoing). */
export interface SocialView { friends: SocialPerson[]; incoming: SocialPerson[]; outgoing: SocialPerson[] }

export type ClientMsg =
  | { t: 'hello'; player: PlayerHello; key?: string }   // key: the account secret, needed for friends
  | { t: 'friendRequest'; name?: string; id?: string }
  | { t: 'friendRespond'; id: string; accept: boolean }
  | { t: 'friendRemove'; id: string }
  | { t: 'friendCancel'; id: string }
  | { t: 'gift'; to: number | 'all'; gift: string; cost?: number }   // a seat number, or 'all' = a round for the whole table
  | { t: 'list' }
  | { t: 'wallet' }                          // coins held by the server: send me my balance
  | { t: 'earn'; kind: string; amount: number; key: string }   // coins held by the server: pay a free reward (the server checks its limits)
  | { t: 'spend'; amount: number }           // coins held by the server: I bought something
  | { t: 'watch'; tableId: string }          // look at a public game in progress (no seat, no cards)
  | { t: 'unwatch' }
  | { t: 'quick'; settings: TableSettings }
  | { t: 'join'; tableId: string }
  | { t: 'createPrivate'; settings: TableSettings }
  | { t: 'joinPrivate'; code: string }
  | { t: 'fillBots' }
  | { t: 'perf'; ms: number; open: boolean; waited: number; pre?: number; paint?: number }   // how long the "Connecting to table" screen lasted (timing only)
  | { t: 'act'; action: Action }
  | { t: 'chat'; text: string }
  | { t: 'leave' }
  | { t: 'rematch' }                    // on the game-over screen: I want to play the same people again
  | { t: 'ping' }                      // heartbeat: the server answers with pong, so a dead connection is noticed quickly
  | { t: 'rejoin'; tableId: string };   // after a dropped connection: take my seat back

export type ServerMsg =
  | { t: 'pong' }
  | { t: 'rematch'; votes: number[]; humans: number[]; deadline: number; cancelled?: boolean }   // who has said yes (seats), who is asked (seats), when the offer ends
  | { t: 'rematchTo'; code: string }          // everyone said yes: sit down at this new private table (your old seat is held for you)
  | { t: 'welcome'; online: OnlineCounts; wallet?: boolean }   // wallet: the server keeps the coin balance
  | { t: 'wallet'; coins: number; note?: string }            // your coin balance on the server
  | { t: 'tables'; tables: TableSummary[]; online: OnlineCounts }
  | { t: 'joined'; tableId: string; seat: number; code: string | null; host: boolean; settings: TableSettings; wallet?: boolean }   // wallet: the server holds your bet for this table and pays the prize
  | { t: 'watching'; tableId: string; settings: TableSettings }   // you are now watching this table
  | { t: 'snap'; snap: Snapshot }
  | { t: 'error'; message: string }
  | { t: 'left' }
  | { t: 'kicked'; reason: string }
  | { t: 'tableGone'; forfeit?: boolean }                  // the table no longer exists (e.g. the server restarted)
  | { t: 'notice'; message: string }
  | { t: 'banned'; message: string }
  | ({ t: 'social' } & SocialView)
  | { t: 'friendMsg'; message: string; ok: boolean };
