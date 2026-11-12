import { useState } from 'react';
import { profile, useProfile } from '../lib/profile';
import { sfx } from '../lib/sound';
import { toast } from '../lib/toast';
import { Modal } from './ui';
import { BG_IMG, BuiltAvatar, decode, encode, IDX, isOwned, ownedKey, SLOT_DEFS } from './avatarbuilder';

/** The designer: a live preview plus one tab per slot. Locked parts can be bought with coins. */
export function AvatarBuilderModal({ initial, onClose, onDone }: { initial: string; onClose: () => void; onDone: (code: string) => void }) {
  const p = useProfile();
  const owned = p.avatarOwned ?? [];
  const [v, setV] = useState<number[]>(decode(initial));
  const [tab, setTab] = useState(1);
  const slot = SLOT_DEFS[tab];
  const code = encode(v);
  const pick = (i: number) => {
    const o = slot.opts[i];
    if (isOwned(owned, slot.id, i)) { sfx.click(); setV((x) => x.map((n, k) => (k === tab ? i : n))); return; }
    if (p.coins < o.price) { sfx.click(); toast(`You need ${o.price.toLocaleString()} coins for ${o.name}`); return; }
    profile.set((q) => ({ coins: q.coins - o.price, avatarOwned: [...(q.avatarOwned ?? []), ownedKey(slot.id, i)] }));
    sfx.coins(); toast(`${o.name} unlocked`);
    setV((x) => x.map((n, k) => (k === tab ? i : n)));
  };
  const shuffle = () => {
    sfx.click();
    setV(SLOT_DEFS.map((s) => { const ok = s.opts.map((_, i) => i).filter((i) => isOwned(owned, s.id, i)); return ok[Math.floor(Math.random() * ok.length)]; }));
  };
  const cell = (i: number) => {
    const o = slot.opts[i];
    const locked = !isOwned(owned, slot.id, i);
    const preview = encode(v.map((n, k) => (k === tab ? i : n)));
    return (
      <button key={i} type="button" className={`ab-opt ${v[tab] === i ? 'on' : ''} ${locked ? 'locked' : ''}`} onClick={() => pick(i)} aria-label={`${o.name}${locked ? `, ${o.price} coins` : ''}`}>
        {o.color && ['skin', 'hcol', 'outfit', 'bg'].includes(slot.id) && !BG_IMG[i] ? <i className="ab-sw" style={{ background: o.color }} /> : <span className="ab-mini"><BuiltAvatar code={preview} /></span>}
        <small>{o.name}</small>
        {locked && <em className="ab-price">🪙 {o.price >= 1000 ? `${o.price / 1000}K` : o.price}</em>}
      </button>
    );
  };
  return (
    <Modal title="DESIGN YOUR AVATAR" onClose={onClose} wide className="ab-modal">
      <div className="ab-wrap">
        <div className="ab-left">
          <span className="ab-big"><BuiltAvatar code={code} /></span>
          <button type="button" className="ab-shuffle" onClick={shuffle}>🎲 Surprise me</button>
          <span className="ab-coins">🪙 {p.coins.toLocaleString()}</span>
        </div>
        <div className="ab-right">
          <div className="ab-tabs" role="tablist">
            {SLOT_DEFS.map((s, i) => <button key={s.id} type="button" role="tab" aria-selected={i === tab} className={i === tab ? 'on' : ''} onClick={() => { sfx.click(); setTab(i); }}>{s.label}</button>)}
          </div>
          <div className="ab-grid">{slot.opts.map((_, i) => cell(i))}</div>
        </div>
      </div>
      <div className="ab-actions">
        <button type="button" className="pe-btn cancel" onClick={() => { sfx.click(); onClose(); }}>Cancel</button>
        <button type="button" className="pe-btn save" onClick={() => { sfx.click(); onDone(code); }}>Use this avatar</button>
      </div>
    </Modal>
  );
}
