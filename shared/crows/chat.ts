// Crows Haven fixed chat: preset phrases and emoji only (no typing). Used by the game and the game server.
import { QUICK_PHRASES, FREE_EMOJI } from '../chat';

/** The Spades phrase list without the Spades-only lines, plus a few for Crows Haven. */
export const CROWS_PHRASES = [
  ...QUICK_PHRASES.filter((p) => !/nil/i.test(p)),
  'Nice nest', 'Take the Crow!', 'Great trump call', 'We got this',
];
export const CROWS_EMOJI = FREE_EMOJI;
const ALLOWED = new Set([...CROWS_PHRASES, ...CROWS_EMOJI]);
export const isCrowsChat = (text: string) => ALLOWED.has(text);

export const BOT_REPLY = ['Ha ha', 'Thanks', 'Good job', 'Lucky', '😂', '👍', '😎', 'Well played', 'No way', '🔥'];
export const BOT_GREET = ['Hello', 'Good luck', '😃', 'We got this'];
export const BOT_MADE = ['Nice bid', 'Well played', 'Good job', '😎', '🔥'];
export const BOT_SET = ['So close', 'Oops', 'Nice try', '😞', 'No way'];
