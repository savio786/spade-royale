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

export type ClientMsg =
  | { t: 'hello'; player: PlayerHello }
  | { t: 'list' }
  | { t: 'quick'; settings: TableSettings }
  | { t: 'join'; tableId: string }
  | { t: 'createPrivate'; settings: TableSettings }
  | { t: 'joinPrivate'; code: string }
  | { t: 'fillBots' }
  | { t: 'act'; action: Action }
  | { t: 'chat'; text: string }
  | { t: 'leave' }
  | { t: 'rejoin'; tableId: string };   // after a dropped connection: take my seat back

export type ServerMsg =
  | { t: 'welcome'; online: OnlineCounts }
  | { t: 'tables'; tables: TableSummary[]; online: OnlineCounts }
  | { t: 'joined'; tableId: string; seat: number; code: string | null; host: boolean; settings: TableSettings }
  | { t: 'snap'; snap: Snapshot }
  | { t: 'error'; message: string }
  | { t: 'left' }
  | { t: 'kicked'; reason: string }
  | { t: 'tableGone' }                  // the table no longer exists (e.g. the server restarted)
  | { t: 'notice'; message: string };
