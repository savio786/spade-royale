// Crows Haven cards in Spade Haven's card style (owner decision 2026-11-16): the same white faces, corners and pips
// (classes pcard / pc-*, from styles.css), suits ♠ ♥ ♣ ♦, numbers 1 and 5–14, plus our Crow card and point badges.
import React from 'react';
import { Card, Colour, COLOUR_NAME, cardPoints, isCrow } from '../../shared/crows/engine';
import { SuitIcon } from '../components/ui';

/** A suit symbol (♠ ♥ ♣ ♦) drawn the same way as on Spade Haven's cards. */
export function Emblem({ s, size = 24, className }: { s: Colour; size?: number; className?: string }) {
  return <SuitIcon s={s} className={`crows-suit s-${s} ${className ?? ''}`} style={{ width: size, height: size }} />;
}

/** The Crow: our own crow silhouette perched on a branch. */
export function CrowArt({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#f6efe0" stroke="#c9a54a" strokeWidth="3" />
      <path d="M14 78 Q50 70 88 80" stroke="#6b4a24" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path fill="#14121c" d="M70 30c-4-6-12-8-18-4-5 3-7 8-7 13-8 1-17 7-21 16l-7 2 8 3c1 5 6 9 13 10l-4 9h4l5-8h7l-2 8h4l3-9c9-2 15-9 15-18 0-5-2-9-5-12l10-3-10-1c0-2 1-4 0-6z" />
      <circle cx="61" cy="31" r="2.6" fill="#ffd36a" />
    </svg>
  );
}

// Pip positions (x%, y%), the same as Spade Haven's number cards.
const PIPS: Record<number, [number, number][]> = {
  5: [[30, 18], [70, 18], [50, 50], [30, 82], [70, 82]],
  6: [[30, 18], [70, 18], [30, 50], [70, 50], [30, 82], [70, 82]],
  7: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [30, 82], [70, 82]],
  8: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [50, 66], [30, 82], [70, 82]],
  9: [[30, 16], [70, 16], [30, 39], [70, 39], [50, 50], [30, 61], [70, 61], [30, 84], [70, 84]],
  10: [[30, 16], [70, 16], [50, 28], [30, 39], [70, 39], [30, 61], [70, 61], [50, 72], [30, 84], [70, 84]],
};

export function CrowCard({ card, back, className, style, onClick, dataCard, trump }: {
  card?: Card; back?: boolean; className?: string; style?: React.CSSProperties; onClick?: () => void; dataCard?: string;
  /** mark this card as trump (glow + TRUMP tag) */
  trump?: boolean;
}) {
  if (back || !card) return <div className={`pcard back ${className ?? ''}`} style={style} aria-hidden="true"><span className="pc-back-mark"><SuitIcon s="S" /></span></div>;
  const Tag = onClick ? 'button' : 'div';
  const pts = cardPoints(card);
  if (isCrow(card)) {
    return (
      <Tag className={`pcard crows-crow ${trump ? 'is-trump' : ''} ${className ?? ''}`} style={style} data-card={dataCard} onClick={onClick} aria-label="The Crow, 20 points, highest trump">
        {trump && <span className="cc-trump">TRUMP</span>}
        <span className="pc-corner"><b>C</b><i className="cc-cpts">20</i></span>
        <span className="cc-crow"><CrowArt /></span>
        <span className="cc-name">CROW</span>
        <span className="pc-corner br"><b>C</b></span>
      </Tag>
    );
  }
  const s = card.s as Colour;
  const red = s === 'H' || s === 'D';
  const corner = <><b>{card.r}</b><SuitIcon s={s} className="pc-corner-suit" /></>;
  let body: React.ReactNode;
  if (card.r === 1) body = <span className={`pc-ace ${s === 'S' ? 'ornate' : ''}`}><SuitIcon s={s} /></span>;
  else if (card.r >= 11) body = (
    <span className="pc-face crows-high">
      <span className="crows-high-num">{card.r}</span>
      <SuitIcon s={s} className="pc-face-suit" />
    </span>
  );
  else body = (
    <span className="pc-pips">
      {PIPS[card.r].map(([x, y], i) => <SuitIcon key={i} s={s} className={`pc-pip ${y > 55 ? 'flip' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} />)}
    </span>
  );
  return (
    <Tag className={`pcard ${red ? 'red' : 'black'} s-${s} ${trump ? 'is-trump' : ''} ${className ?? ''}`} style={style} data-card={dataCard} onClick={onClick}
      aria-label={`${card.r} of ${COLOUR_NAME[s]}${trump ? ', trump' : ''}${pts ? `, ${pts} points` : ''}`}>
      {trump && <span className="cc-trump">TRUMP</span>}
      <span className="pc-corner">{corner}{pts > 0 && <i className="cc-cpts">{pts}</i>}</span>
      {body}
      <span className="pc-corner br">{corner}</span>
      {pts > 0 && <span className="cc-pts">{pts}</span>}
    </Tag>
  );
}
