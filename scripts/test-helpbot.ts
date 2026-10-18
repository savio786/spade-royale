// Checks that typical player questions reach the right help topic.
import { findTopic } from '../src/lib/helpbot';

const cases: [string, string | null][] = [
  ['how do i play', 'rules'], ['what are the rules?', 'rules'], ['how many should I bid', 'bidding'],
  ['what does nil mean', 'nil'], ['what are bags', 'bags'], ['why cant i lead a spade', 'spades-broken'],
  ["why can't I play this card", 'follow-suit'], ['how is the score calculated', 'scoring'], ['when does the game end', 'winning'],
  ['difference between solo and partners', 'solo-partners'], ['how do I play with my friends', 'private'],
  ['my friend sent me a code', 'join-code'], ['how do i get free coins', 'coins-free'], ['how much do coins cost', 'coins-buy'],
  ["I'm out of coins", 'out-of-coins'], ['why cant i chat', 'chat-pass'], ["why can't I chat at the table?", 'chat-pass'], ['how do I chat with other players', 'chat-pass'], ['how do I send a message', 'chat-pass'],
  ['what is vip', 'vip'], ['how does the leaderboard work', 'leaderboard'], ['how do i level up', 'trophies'],
  ['change my name', 'account'], ['can I install it on my ipad', 'install'], ['the game froze', 'disconnect'],
  ['are the other players real', 'bots'], ['I paid but didnt get my coins', 'refund'], ['how do i leave the table', 'leave'],
  ['the game played a card for me', 'timer'], ['hello', 'hello'], ['thanks!', 'thanks'], ['report a bug', 'support'],
  ['what is the weather in paris', null], ['asdfgh', null],
];
let ok = 0;
for (const [q, want] of cases) {
  const got = findTopic(q).topic?.id ?? null;
  const pass = got === want;
  if (pass) ok++; else console.log(`MISS  "${q}"  → ${got}  (wanted ${want})`);
}
console.log(`${ok}/${cases.length} questions matched`);
