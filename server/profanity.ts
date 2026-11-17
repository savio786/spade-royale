// Simple foul-language filter for typed chat. Free quick phrases never need it.
// Strong words are caught even when spaced out or disguised (f.u.c.k, sh1t); short or ambiguous ones only as whole words.
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '€': 'e' };
const STRONG = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'asshole', 'bastard', 'wanker', 'motherfucker', 'bullshit', 'dickhead', 'cocksucker', 'killyourself'];
const WORDS = new Set(['ass', 'arse', 'dick', 'cock', 'pussy', 'slut', 'twat', 'prick', 'piss', 'douche', 'douchebag', 'retard', 'retarded', 'fag', 'fags', 'kys', 'spic', 'chink', 'kike', 'tranny', 'rape', 'rapist', 'jackass', 'dumbass', 'fk', 'fck', 'fuk', 'stfu', 'wtf']);
const INSIDE = ['fuck', 'shit', 'bitch', 'nigger', 'nigga', 'faggot', 'motherfucker', 'bullshit', 'killyourself'];   // caught even inside a longer word
const OK = new Set(['shiitake', 'shitake', 'shitzu', 'shihtzu', 'scunthorpe']);
const norm = (s: string) => s.toLowerCase().replace(/[01!34@5$7+€]/g, (c) => LEET[c] ?? c);
const squash = (s: string) => norm(s).replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
const STRONG_SQ = STRONG.map((w) => w.replace(/(.)\1+/g, '$1'));

/** Returns the message with bad words starred out, and whether anything was caught. */
export function cleanChat(text: string): { text: string; flagged: boolean } {
  let flagged = false;
  const out = text.replace(/[^\s]+/g, (tok) => {
    const n = norm(tok).replace(/[^a-z]/g, '');
    const sq = n.replace(/(.)\1+/g, '$1');
    if (WORDS.has(n) || WORDS.has(sq) || (!OK.has(n) && INSIDE.some((w) => n.includes(w) || sq.includes(w.replace(/(.)\1+/g, '$1')))) || STRONG.some((w) => n === w || n.startsWith(w) && w.length > 4) || STRONG_SQ.some((w) => sq === w)) { flagged = true; return '*'.repeat(Math.min(tok.length, 8)); }
    return tok;
  });
  // words split up with spaces or dots (f u c k): the whole message is hidden
  if (!flagged && STRONG_SQ.some((w) => squash(text).includes(w)) && /(?:\b\w[\s._-]+){3,}/.test(text + ' ')) return { text: '***', flagged: true };
  return { text: out, flagged };
}
