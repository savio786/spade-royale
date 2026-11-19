// Crows Haven cards in the style of the classic bidding card game (owner decision 2026-11-19): four coloured suits
// (Red, Yellow, Green, Black), each card showing its number in its colour — no ♠ ♥ ♣ ♦. Our own drawing, not a copy of
// any published deck: no logo or bird art from it; the Crow card is our own crow. Sizes come from Spade Haven's pcard class.
import React from 'react';
import { Card, Colour, COLOUR_NAME, cardPoints, isCrow } from '../../shared/crows/engine';

/** A suit's colour chip (used for trump, the trump picker and the announcement). */
export function Emblem({ s, size = 24, className }: { s: Colour; size?: number; className?: string }) {
  return <span className={`rc-chip rc-${s} ${className ?? ''}`} style={{ width: size, height: size }} aria-hidden="true" />;
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

export function CrowCard({ card, back, className, style, onClick, dataCard, trump }: {
  card?: Card; back?: boolean; className?: string; style?: React.CSSProperties; onClick?: () => void; dataCard?: string;
  /** mark this card as trump (glow + TRUMP tag) */
  trump?: boolean;
}) {
  if (back || !card) return <div className={`pcard back crows-back ${className ?? ''}`} style={style} aria-hidden="true"><span className="pc-back-mark"><CrowArt size={60} /></span></div>;
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
  const num = <b className="rc-num">{card.r}</b>;
  return (
    <Tag className={`pcard crows-rc rc-${s} ${trump ? 'is-trump' : ''} ${className ?? ''}`} style={style} data-card={dataCard} onClick={onClick}
      aria-label={`${card.r} ${COLOUR_NAME[s]}${trump ? ', trump' : ''}${pts ? `, ${pts} points` : ''}`}>
      <span className="rc-frame" aria-hidden="true" />
      {trump && <span className="cc-trump">TRUMP</span>}
      <span className="rc-corner">{num}{pts > 0 && <i className="cc-cpts">{pts}</i>}</span>
      <span className="rc-mid" aria-hidden="true"><span className="rc-disc"><b>{card.r}</b></span><span className="rc-name">{COLOUR_NAME[s].toUpperCase()}</span></span>
      <span className="rc-corner br">{num}</span>
      {pts > 0 && <span className="cc-pts">{pts}</span>}
    </Tag>
  );
}
