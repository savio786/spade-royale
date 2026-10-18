// Spade Royale help bot: free, offline, keyword-matched answers about the game.
import { useSyncExternalStore } from 'react';

export type BotAction = 'store-coins' | 'store-chat' | 'rules' | 'play';
export interface Topic {
  id: string;
  title: string;                 // shown as a suggestion chip
  keys: string[];                // words or short phrases; phrases count double
  answer: string;
  actions?: { label: string; action: BotAction }[];
  related?: string[];
}

const SUPPORT = (import.meta.env?.VITE_SUPPORT_EMAIL as string | undefined) || '';

export const TOPICS: Topic[] = [
  { id: 'hello', title: 'Hi', keys: ['hi', 'hello', 'hey', 'yo', 'sup', 'good morning', 'good evening'],
    answer: "Hi! I'm the Spade Royale helper. Ask me about rules, bidding, coins, the Chat Pass, private tables or the leaderboard.",
    related: ['rules', 'coins-free', 'private'] },
  { id: 'thanks', title: 'Thanks', keys: ['thanks', 'thank you', 'thx', 'ty', 'appreciate', 'great', 'cool', 'awesome'],
    answer: "You're welcome. Good luck at the table! ♠", related: ['rules', 'bidding'] },

  // ---- rules ----
  { id: 'rules', title: 'How to play', keys: ['how to play', 'how do i play', 'how do you play', 'how to win tricks', 'rules', 'rule', 'learn', 'play spades', 'how does it work', 'explain', 'beginner', 'new'],
    answer: 'Spades is a trick-taking game for four players. Everyone gets 13 cards and bids how many tricks ("books") they expect to win. You must follow the suit that was led if you can. Spades are always trump, so any spade beats any other suit. Make your bid to score points; miss it and you lose points.',
    actions: [{ label: 'Read full rules', action: 'rules' }], related: ['bidding', 'nil', 'scoring'] },
  { id: 'bidding', title: 'How bidding works', keys: ['bid', 'bidding', 'how many', 'suggested', 'suggestion', 'books', 'tricks', 'how much to bid'],
    answer: 'When it\'s your turn to bid, pick 1–13 or Nil. Count your sure winners: aces, protected kings, and spades (long spades win extra tricks). The game shows a Suggested bid in gold based on your hand. In Partners your bid is added to your partner\'s.',
    related: ['nil', 'bags', 'scoring'] },
  { id: 'nil', title: 'What is Nil?', keys: ['nil', 'zero', 'bid zero', 'bid 0', 'no tricks', 'blind'],
    answer: 'Bidding Nil means you promise to win zero tricks. Make it: +100 points. Take even one trick: −100. Play your highest cards that won\'t win, and in Partners your partner should try to win tricks to cover you.',
    related: ['bidding', 'scoring'] },
  { id: 'bags', title: 'What are bags?', keys: ['bag', 'bags', 'sandbag', 'overtrick', 'extra trick', 'penalty'],
    answer: 'Every trick you win above your bid is a "bag" worth 1 point. But every 10 bags costs your side 100 points, so don\'t win too many extra tricks once your bid is made.',
    related: ['scoring', 'bidding'] },
  { id: 'spades-broken', title: 'Leading spades', keys: ['broken', 'break', 'lead', 'lead a spade', 'lead spade', 'cant play spade', "can't lead", 'start with spade', 'trump'],
    answer: 'You can\'t lead (start a trick with) a spade until spades are "broken", which happens when someone plays a spade because they couldn\'t follow suit. The exception: if you only have spades left, you may lead one. The ♠ circle under the scoreboard lights up once spades are broken.',
    related: ['rules', 'follow-suit'] },
  { id: 'follow-suit', title: "Why can't I play that card?", keys: ['cant play', "can't play", 'play this card', 'play that card', 'card greyed', 'grey', 'dim', 'dark card', 'follow suit', 'not allowed', 'illegal', 'wont let me'],
    answer: 'Cards you\'re not allowed to play are dimmed. You must follow the suit that was led if you have it; only when you\'re out of that suit can you play anything (including a spade). Legal cards are raised with a gold glow.',
    related: ['spades-broken', 'rules'] },
  { id: 'scoring', title: 'How scoring works', keys: ['score', 'scoring', 'points', 'how many points', 'calculate', 'set', 'lost points', 'negative'],
    answer: 'Make your bid: 10 × your bid, plus 1 point per extra trick (bag). Miss it ("get set"): −10 × your bid. Nil: +100 or −100. Every 10 bags: −100. After each round a summary shows bids, books and points.',
    related: ['bags', 'winning', 'nil'] },
  { id: 'winning', title: 'How do I win?', keys: ['win', 'winning', 'end', 'ending points', 'end game', 'game end', 'game over', 'max points', 'min points', 'how long', 'when does it end', 'prize'],
    answer: 'Each table has game-ending points, for example −100/100. The game ends when a side reaches the maximum or drops to the minimum, and the highest score wins. Winners get the prize: 1.8× the bet each in Partners, 3.6× in Solo (+10% with VIP).',
    related: ['solo-partners', 'scoring'] },
  { id: 'solo-partners', title: 'Solo vs Partners', keys: ['solo', 'partner', 'partners', 'team', 'teammate', 'difference', 'mode', 'alone'],
    answer: 'Partners: classic Spades, two teams of two. You sit across from your partner and your bids and books are combined. Solo: four players, everyone for themselves, and the winner takes a bigger prize.',
    related: ['winning', 'private'] },
  { id: 'timer', title: 'Turn timer', keys: ['timer', 'time', 'too slow', 'auto play', 'autoplay', 'played for me', 'for me', 'played a card', 'afk', 'took too long', 'kicked out', 'removed', 'inactive', 'inactivity', 'seconds'],
    answer: 'You have 12 seconds to bid or play (watch the green ring around your avatar and the countdown). If time runs out, the game bids or plays a sensible card for you based on your hand. Miss 3 turns in the same game and you\'re disconnected from the table: a computer player takes your seat and your bet is lost.',
    related: ['disconnect'] },

  // ---- tables ----
  { id: 'private', title: 'Play with friends', keys: ['friend', 'friends', 'with my friend', 'with friends', 'private', 'invite', 'invite code', 'play together', 'family', 'room', 'host'],
    answer: 'Tap PRIVATE GAME → Create table → choose Solo or Partners, the bet and points → PLAY NOW. You\'ll get a 5-letter invite code: send it to your friends. In Partners, the first friend to join sits across from you as your partner. Tap "Fill empty seats with bots" if you\'re short of players.',
    related: ['join-code', 'bots'] },
  { id: 'join-code', title: 'Join with a code', keys: ['join', 'code', 'sent me', 'enter code', 'have a code', 'got a code', 'join friend', 'join table'],
    answer: 'Tap PRIVATE GAME → "Join with code", type the 5-letter code your friend sent, and tap Join table. Codes don\'t use the letters O or I, or the digits 0 and 1, so there\'s no mixing them up.',
    related: ['private'] },
  { id: 'lobby', title: 'Online lobby & tables', keys: ['online lobby', 'lobby', 'table', 'tables', 'city', 'new york', 'seattle', 'vegas', 'monaco', 'filter', 'create table', 'bet size'],
    answer: 'ONLINE LOBBY lists tables by city. The city depends on the bet (New York starts at 100 coins, Monaco at 2 million). Use the arrows at the top to switch Solo/Partners and filter by game-ending points, or tap CREATE TABLE to set your own bet and points.',
    related: ['play-now', 'coins-buy'] },
  { id: 'play-now', title: 'Quick match', keys: ['play now', 'quick', 'fast game', 'start game', 'matchmaking', 'random'],
    answer: 'PLAY NOW → pick Solo or Partners and you\'re seated at a table with a bet that suits your coin balance. Empty seats fill with computer players if no one else joins within a few seconds.',
    actions: [{ label: 'Start playing', action: 'play' }], related: ['bots', 'lobby'] },
  { id: 'bots', title: 'Computer players', keys: ['bot', 'bots', 'cpu', 'computer', 'ai player', 'fake', 'real', 'other players', 'real people', 'real players', 'are they real'],
    answer: 'Players marked CPU are computer players that fill empty seats so you never wait long. Real people show their level (Lv) instead. Computer players never appear on the leaderboard.',
    related: ['private', 'leaderboard'] },
  { id: 'leave', title: 'Leaving a table', keys: ['leave', 'leave the table', 'leave table', 'quit', 'exit', 'forfeit', 'get out', 'stop playing'],
    answer: 'Open the menu (☰, top right) → Leave table. Leaving before the game starts is free; leaving during a game forfeits your bet, and a computer player takes your seat.',
    related: ['disconnect'] },
  { id: 'disconnect', title: 'Disconnected / game stopped', keys: ['disconnect', 'disconnected', 'lag', 'kicked', 'froze', 'frozen', 'stuck', 'connection', 'reconnect', 'crash', 'restart', 'not loading', 'slow'],
    answer: 'If the game stops responding, refresh the page. The server restarts now and then (and whenever the game is updated); a game in progress at that moment ends, but your coins, level and leaderboard results are kept. If it keeps happening, check your internet connection.',
    related: ['account', 'leave'] },

  // ---- coins & store ----
  { id: 'coins-free', title: 'Free coins', keys: ['free coins', 'free', 'earn coins', 'get coins', 'more coins', 'daily', 'bonus', 'wheel', 'spin', 'gift', 'ad', 'watch'],
    answer: 'Free coins: the daily gift (2,000 coins, GIFTS), the bonus wheel every 4 hours (the big gold chip), +100 coins for watching an ad, trophy rewards (TROPHY), and weekly leaderboard rewards for the top 100. And of course, winning games!',
    related: ['coins-buy', 'leaderboard', 'trophies'] },
  { id: 'coins-buy', title: 'Buy coins', keys: ['buy', 'purchase', 'price', 'cost', 'how much', 'pay', 'payment', 'credit card', 'money', 'store', 'shop', 'pack'],
    answer: 'Tap BUY COINS (or the + next to your balance). Packs go from 25,000 coins for $0.99 up to 8,000,000 for $99.99. VIP members get +20% coins on every pack.',
    actions: [{ label: 'Open coin store', action: 'store-coins' }], related: ['out-of-coins', 'coins-free', 'refund'] },
  { id: 'out-of-coins', title: 'Out of coins', keys: ['out of coins', 'no coins', 'not enough', 'broke', 'ran out', 'zero coins', 'low coins', 'cant afford', "can't afford"],
    answer: 'No problem: collect the free daily gift and spin the bonus wheel first. If you still need more, tap any table you can\'t afford and the store opens showing exactly how many coins you\'re missing.',
    actions: [{ label: 'Open coin store', action: 'store-coins' }], related: ['coins-free'] },
  { id: 'refund', title: 'Purchase problems', keys: ['refund', 'charged', 'didnt get', "didn't get", 'missing coins', 'purchase failed', 'payment failed', 'not received'],
    answer: 'Purchases normally appear within a few seconds of paying. If something is missing, refresh the game: delivered purchases are picked up automatically. Still missing? Contact support' + (SUPPORT ? ` at ${SUPPORT}` : ' through the site owner') + ' with the time of the purchase.',
    related: ['coins-buy', 'support'] },
  { id: 'chat-pass', title: 'Chat Pass', keys: ['chat', 'chat pass', 'cant chat', "can't chat", 'cant i chat', "can't i chat", 'chat at the table', 'chat with', 'message', 'talk', 'type', 'locked', 'send message', 'emoji', 'quick phrase'],
    answer: 'Sending messages at tables needs a Chat Pass: $0.99 for 1 day, $2.99 for 30 days, or $9.99 for life (VIP includes chat). Without one you can still read the chat and send gifts.',
    actions: [{ label: 'Get Chat Pass', action: 'store-chat' }], related: ['gifts', 'vip'] },
  { id: 'gifts', title: 'Table gifts', keys: ['gift', 'gifts', 'send gift', 'rose', 'drink', 'present', 'trophy gift', 'diamond'],
    answer: 'Tap the small gift icon on any player\'s avatar at the table to send them a gift (a rose, coffee, a trophy…). Gifts cost from 100 coins and are free to send without a Chat Pass.',
    related: ['chat-pass'] },
  { id: 'vip', title: 'VIP Club', keys: ['vip', 'club', 'premium', 'membership', 'subscription', 'privileges', 'gold frame'],
    answer: 'VIP Club: gold avatar frame, +10% on every prize, +20% coins on store packs, double bonus-wheel rewards, and chat included. Tap the VIP badge in the lobby.',
    related: ['chat-pass', 'coins-buy'] },

  // ---- progress ----
  { id: 'leaderboard', title: 'Leaderboard & rewards', keys: ['leaderboard', 'leaders', 'rank', 'ranking', 'top', 'weekly', 'wall of fame', 'fame', 'champion', 'reward'],
    answer: 'LEADERS shows this week\'s top winners (coins won from games). The week resets every Sunday. Top 100 earn rewards: 50,000 for 1st, 25,000 for 2nd, 10,000 for 3rd, down to 1,000 for 51–100. Collect yours from "Last week results". Each week\'s champion joins the Wall of Fame.',
    related: ['coins-free', 'bots'] },
  { id: 'trophies', title: 'Levels & trophies', keys: ['level', 'xp', 'experience', 'trophy', 'trophies', 'achievement', 'stats', 'win rate', 'level up'],
    answer: 'Every game gives XP (+40, and +80 more for a win) to level up. TROPHY shows your stats and achievements like "Nil Ninja" or "Table Boss", each with a coin reward to collect.',
    related: ['leaderboard', 'coins-free'] },

  // ---- account & devices ----
  { id: 'account', title: 'My account', keys: ['account', 'profile', 'name', 'change name', 'avatar', 'picture', 'sign out', 'log out', 'logout', 'guest', 'lost progress', 'new phone', 'another device', 'facebook', 'google', 'login', 'sign in'],
    answer: 'Change your name or avatar in Settings (the gear, or tap your avatar). Your coins and progress are saved on this device and browser, so clearing your browser data or switching devices starts a new account. Sign out is in Settings too.',
    related: ['install', 'disconnect'] },
  { id: 'install', title: 'Install the app', keys: ['install', 'app', 'download', 'iphone', 'ipad', 'android', 'windows', 'mac', 'macbook', 'phone', 'tablet', 'home screen', 'play store', 'app store'],
    answer: 'Windows/Mac (Chrome or Edge): click the install icon in the address bar, or Settings → Install app. iPad/iPhone (Safari): Share → Add to Home Screen. Android (Chrome): menu → Install app. Turn your phone sideways for the best table view.',
    related: ['account'] },
  { id: 'support', title: 'Contact support', keys: ['support', 'help me', 'contact', 'email', 'bug', 'problem', 'report', 'cheat', 'cheating', 'abuse', 'human', 'owner', 'admin'],
    answer: SUPPORT ? `You can reach support at ${SUPPORT}. Include your player name and what happened.` : 'I can answer most questions about the game. For anything else (a bug, a payment problem, reporting a player), contact the site owner and include your player name and what happened.',
    related: ['refund', 'disconnect'] },
];

const STARTERS = ['rules', 'coins-free', 'private', 'chat-pass', 'bidding', 'leaderboard'];

// ---- matching ----
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const stem = (w: string) => w.replace(/'s$/, '').replace(/(ing|ed)$/, '').replace(/([^s])s$/, '$1');
const words = (s: string) => norm(s).split(' ').filter(Boolean).map(stem);

export function findTopic(question: string): { topic: Topic | null; score: number } {
  const q = norm(question);
  const qw = new Set(words(question));
  let best: Topic | null = null, bestScore = 0;
  for (const t of TOPICS) {
    let score = 0;
    for (const k of t.keys) {
      const nk = norm(k);
      if (nk.includes(' ')) { if (q.includes(nk)) score += 3; }
      else if (qw.has(stem(nk))) score += t.id === 'hello' || t.id === 'thanks' ? 0.8 : 1.5;
    }
    if (score > bestScore) { best = t; bestScore = score; }
  }
  return bestScore >= 1.5 || (best && ['hello', 'thanks'].includes(best.id) && bestScore > 0 && q.split(' ').length <= 4)
    ? { topic: best, score: bestScore } : { topic: null, score: 0 };
}

export const topicById = (id: string) => TOPICS.find((t) => t.id === id)!;
export const starterTopics = () => STARTERS.map(topicById);
export const FALLBACK = "Sorry, I don't have an answer for that yet. Try one of these topics, or ask in a different way (for example \"how do I get free coins?\").";

// ---- open/close from anywhere ----
let open = false;
const subs = new Set<() => void>();
export const helpBot = {
  open() { open = true; subs.forEach((f) => f()); },
  close() { open = false; subs.forEach((f) => f()); },
  toggle() { open = !open; subs.forEach((f) => f()); },
};
export const useHelpBotOpen = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => open);
