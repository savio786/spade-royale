// Messages between the Crows Haven game and its game server (crows-server/, Cloudflare).
import type { CrowsAction, CrowsPublicState } from './engine';

/** HTTP: POST /quick {target} → {tableId} · POST /private {target} → {tableId, code} · GET /code/:CODE → {tableId}
 *  WebSocket: GET /ws/:tableId */
export type ClientMsg =
  | { t: 'hello'; pid: string; name: string; avatar: string; token?: string | null }
  | { t: 'act'; action: CrowsAction }
  | { t: 'chat'; text: string }
  | { t: 'start' }          // fill the empty seats with computer players now
  | { t: 'ready' }          // done reading the hand summary
  | { t: 'leave' };

export interface TableInfo {
  tableId: string;
  code: string | null;      // private tables: the 5-letter invite code
  isPrivate: boolean;
  target: number;
  fillAt: number | null;    // public tables: when the next computer player sits down
  filling: boolean;         // "Start now" was pressed: computer players are joining one by one (5 s apart)
  startAt: number | null;   // all seats taken: when the first hand is dealt
  turnAt: number | null;    // when the player whose turn it is runs out of time
  turnTotal: number;
  nextAt: number | null;    // hand summary: when the next hand starts
  humans: boolean[];        // seats played by people
  away: boolean[];          // people who lost connection (a computer player plays for them)
  ready: boolean[];
  now: number;              // server clock, to correct the countdowns
}

export type ServerMsg =
  | { t: 'joined'; seat: number; token: string; info: TableInfo }
  | { t: 'state'; view: CrowsPublicState; info: TableInfo }
  | { t: 'chat'; seat: number; text: string }
  | { t: 'error'; message: string; code?: 'full' | 'gone' | 'bad' }
  | { t: 'closed'; reason: string };
