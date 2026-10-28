// Crows Haven table chat: preset phrases and emoji only (no typing), like the free chat at Spades tables.
// Computer players answer now and then, using the same fixed list.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../components/ui';
import { sfx } from '../lib/sound';
import { CROWS_PHRASES, CROWS_EMOJI, BOT_REPLY, BOT_GREET, BOT_MADE, BOT_SET } from '../../shared/crows/chat';
export { CROWS_PHRASES, CROWS_EMOJI };

export interface ChatMsg { id: number; seat: number; text: string; at: number }
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
let seq = 0;

/** Chat for one table. `bots` = seats played by the computer. */
export function useCrowsChat(bots: number[]) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [now, setNow] = useState(Date.now());
  const timers = useRef<number[]>([]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => { clearInterval(t); timers.current.forEach(clearTimeout); }; }, []);

  const say = useCallback((seat: number, text: string) => {
    setMsgs((m) => [...m.slice(-60), { id: ++seq, seat, text, at: Date.now() }]);
    sfx.chat();
  }, []);
  const later = useCallback((ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)); }, []);

  /** A computer player may answer what someone said. */
  const botMaybeReply = useCallback((from: number) => {
    const others = bots.filter((b) => b !== from);
    if (!others.length || Math.random() > 0.45) return;
    later(900 + Math.random() * 1400, () => say(pick(others), pick(BOT_REPLY)));
  }, [bots, later, say]);

  const greet = useCallback(() => {
    for (const b of bots) if (Math.random() < 0.5) later(800 + Math.random() * 2500, () => say(b, pick(BOT_GREET)));
  }, [bots, later, say]);

  /** End of a hand: one computer player may comment on the bid. */
  const handEnded = useCallback((bidderSide: number, made: boolean) => {
    if (Math.random() > 0.5 || !bots.length) return;
    const b = pick(bots);
    const ownSide = b % 2 === bidderSide;
    later(600 + Math.random() * 800, () => say(b, pick(made === ownSide ? BOT_MADE : BOT_SET)));
  }, [bots, later, say]);

  /** The newest message of a seat while it's still on screen (4 s). */
  const bubble = (seat: number) => {
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].seat === seat) return now - msgs[i].at < 4000 ? msgs[i].text : null;
    return null;
  };
  return { msgs, say, bubble, botMaybeReply, greet, handEnded };
}

export function ChatPanel({ msgs, names, me, onSend, onClose }: {
  msgs: ChatMsg[]; names: string[]; me: number; onSend: (t: string) => void; onClose: () => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);
  return (
    <Modal title="Table chat" onClose={onClose} wide>
      <div className="crows-chat">
        <div className="cc-log" aria-live="polite">
          {msgs.length === 0 && <p className="crows-small-note">No messages yet — say hello!</p>}
          {msgs.map((m) => <div key={m.id} className={`cc-line ${m.seat === me ? 'mine' : ''}`}><b>{m.seat === me ? 'You' : names[m.seat]}:</b> {m.text}</div>)}
          <div ref={end} />
        </div>
        <div className="cc-phrases">{CROWS_PHRASES.map((p) => <button key={p} onClick={() => onSend(p)}>{p}</button>)}</div>
        <div className="cc-emoji">{CROWS_EMOJI.map((e) => <button key={e} onClick={() => onSend(e)} aria-label={`Send ${e}`}>{e}</button>)}</div>
        <p className="crows-small-note">Chat uses these ready-made phrases and emoji only.</p>
      </div>
    </Modal>
  );
}
