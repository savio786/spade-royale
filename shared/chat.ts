// Free table chat: quick phrases and emoji anyone can send. Typing your own message needs a Chat Pass.
export const QUICK_PHRASES = [
  'Hello', 'Good luck', 'Faster please', 'Lucky', 'Ha ha', 'Thanks', 'Good job', 'So close', 'Nice try', 'No way',
  'Well played', 'Nice bid', 'Cover my nil', 'Oops', 'Good game', 'Bye',
];
export const FREE_EMOJI = [
  '😃', '🙁', '😐', '😧', '😮', '😞', '😡', '😏', '😍', '😚', '😊', '😵', '😝', '😇', '😱', '😎', '🤑', '🤔', '🤓', '💩', '😘',
  '😂', '😭', '👏', '🔥', '🙏', '👍',
];
const FREE = new Set([...QUICK_PHRASES, ...FREE_EMOJI]);
/** True for the preset phrases and emoji that are free to send. */
export const isFreeChat = (text: string) => FREE.has(text);
