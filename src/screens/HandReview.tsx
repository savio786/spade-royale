// Hand history: look back at any recent hand: who bid what, how every trick went, and exactly how the points were scored.
// Loaded only when opened (own code chunk), and built from the small records kept by lib/handlog: nothing here runs at the table.
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/ui';
import { SUIT_SYMBOL, rankLabel, seatsOfSide, sideOf, sortHand, type Card } from '../../shared/engine';
import { decodeCard, hands, type HandRec } from '../lib/handlog';
import { explain } from '../lib/handscore';
import { track } from '../lib/track';

const first = (r: HandRec, seat: number) => (r.names[seat] || 'Player').split(' ')[0].slice(0, 9);
const sideName = (r: HandRec, side: number) => {
  const mine = sideOf(r.mode, r.me) === side;
  const who = seatsOfSide(r.mode, side).map((s) => (s === r.me ? 'You' : first(r, s))).join(' & ');
  return r.mode === 'partners' ? (mine ? `Your team (${who})` : `Them (${who})`) : who;
};
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function Chip({ card, win, tag }: { card: Card; win?: boolean; tag?: string }) {
  const red = card.s === 'H' || card.s === 'D';
  return <span className={`hr-card ${red ? 'red' : ''} ${win ? 'win' : ''}`}>{rankLabel(card.r)}{SUIT_SYMBOL[card.s]}{tag && <small>{tag}</small>}</span>;
}

function Bids({ r }: { r: HandRec }) {
  const res = r.res!;
  return (
    <table className="hr-table">
      <thead><tr><th>Player</th><th>Bid</th><th>Took</th><th /></tr></thead>
      <tbody>
        {[0, 1, 2, 3].map((s) => {
          const b = res.bids[s] ?? 0, nil = b === 0;
          return (
            <tr key={s} className={s === r.me ? 'me' : ''}>
              <td>{s === r.me ? 'You' : first(r, s)}</td>
              <td>{nil ? (res.blind?.[s] ? 'Blind nil' : 'Nil') : b}</td>
              <td>{res.tricks[s]}</td>
              <td>{nil ? (res.nilResults[s] ? <b className="ok">✓ made</b> : <b className="no">✗ set</b>) : ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Tricks({ r }: { r: HandRec }) {
  const [all, setAll] = useState(false);
  const seatHands = useMemo(() => [0, 1, 2, 3].map((s) => sortHand(r.tricks.map((t) => decodeCard(t.cards[(s - t.lead + 4) % 4])))), [r]);
  return (
    <div>
      <ol className="hr-tricks">
        {r.tricks.map((t, i) => (
          <li key={i}>
            <span className="hr-n">{i + 1}</span>
            {t.cards.map((c, k) => { const seat = (t.lead + k) % 4; return <span key={k} className="hr-play"><small className={seat === r.me ? 'me' : ''}>{seat === r.me ? 'You' : first(r, seat)}</small><Chip card={decodeCard(c)} win={seat === t.winner} /></span>; })}
          </li>
        ))}
      </ol>
      <button className="hr-toggle" onClick={() => setAll((v) => !v)}>{all ? 'Hide everyone’s starting hands' : 'Show everyone’s starting hands'}</button>
      {all && seatHands.map((h, s) => (
        <div key={s} className="hr-hand"><b>{s === r.me ? 'You' : first(r, s)}</b><div>{h.map((c, i) => <Chip key={i} card={c} />)}</div></div>
      ))}
    </div>
  );
}

function Score({ r }: { r: HandRec }) {
  const res = r.res!;
  const sides = r.mode === 'partners' ? [sideOf(r.mode, r.me), 1 - sideOf(r.mode, r.me)] : [0, 1, 2, 3];
  return (
    <div className="hr-score">
      {sides.map((side) => (
        <section key={side} className={side === sideOf(r.mode, r.me) ? 'mine' : ''}>
          <header><span>{sideName(r, side)}</span><b className={res.delta[side] >= 0 ? 'ok' : 'no'}>{signed(res.delta[side])}</b></header>
          <ul>{explain(r, side).map((l, i) => <li key={i}><span>{l.t}</span><b>{signed(l.p)}</b></li>)}</ul>
          <footer>Score now {r.scores?.[side] ?? '–'} · Bags {r.bags?.[side] ?? '–'}{res.bagsAdded[side] ? ` (+${res.bagsAdded[side]} this hand)` : ''}</footer>
        </section>
      ))}
    </div>
  );
}

export default function HandReview({ gid, onClose }: { gid: string; onClose: () => void }) {
  useEffect(() => { track('hand_review_open'); }, []);
  const list = useMemo(() => hands().filter((h) => h.res).reverse(), []);
  const [pick, setPick] = useState<HandRec | null>(null);
  const [tab, setTab] = useState<'bids' | 'tricks' | 'score'>('score');
  const when = (ts: number) => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const groups = useMemo(() => { const g: { gid: string; items: HandRec[] }[] = []; for (const h of list) { const last = g.at(-1); if (last && last.gid === h.gid) last.items.push(h); else g.push({ gid: h.gid, items: [h] }); } return g; }, [list]);

  return (
    <Modal title={pick ? `Hand ${pick.n}` : 'Hand history'} onClose={onClose} wide className="hr-modal">
      {!pick && (list.length === 0
        ? <p className="muted hr-empty">Finished hands show up here. Play a hand and come back!</p>
        : groups.map((g) => (
          <section key={g.gid + g.items[0].ts} className="hr-group">
            <h4>{g.gid === gid ? 'This game' : `${when(g.items[0].ts)} · ${g.items[0].city}`} <small>{g.items[0].mode === 'partners' ? 'Partners' : 'Solo'}</small></h4>
            {g.items.map((h) => {
              const mySide = sideOf(h.mode, h.me), res = h.res!, bid = res.bids[h.me] ?? 0;
              return (
                <button key={h.ts + '-' + h.n} className="hr-row" onClick={() => { setPick(h); setTab('score'); }}>
                  <span className="hr-n">#{h.n}</span>
                  <span className="grow">Bid {bid === 0 ? 'nil' : bid} · took {res.tricks[h.me]}</span>
                  <b className={res.delta[mySide] >= 0 ? 'ok' : 'no'}>{signed(res.delta[mySide])}</b>
                </button>
              );
            })}
          </section>
        )))}
      {pick && (
        <>
          <button className="hr-back" onClick={() => setPick(null)}>‹ All hands</button>
          <div className="hr-tabs" role="tablist">
            {(['score', 'bids', 'tricks'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'score' ? 'Score' : t === 'bids' ? 'Bids' : 'Tricks'}</button>)}
          </div>
          {tab === 'score' && <Score r={pick} />}
          {tab === 'bids' && <Bids r={pick} />}
          {tab === 'tricks' && <Tricks r={pick} />}
        </>
      )}
    </Modal>
  );
}
