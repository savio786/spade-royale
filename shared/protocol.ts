import type { Action, Mode, TableSettings } from './engine';
import type { Snapshot } from './runtime';

export type OnlineCounts = Record<Mode, number> & { total: number };

export interface PlayerHello { id: string; name: string; avatar: string; level: number; chat?: boolean }

export interface TableSummary {
  id: string;
  settings: TableSettings;
  players: number;   // humans + bots seated
  humans: number;
  phase: string;
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
  | { t: 'leave' };

export type ServerMsg =
  | { t: 'welcome'; online: OnlineCounts }
  | { t: 'tables'; tables: TableSummary[]; online: OnlineCounts }
  | { t: 'joined'; tableId: string; seat: number; code: string | null; host: boolean; settings: TableSettings }
  | { t: 'snap'; snap: Snapshot }
  | { t: 'error'; message: string }
  | { t: 'left' }
  | { t: 'kicked'; reason: string };
