// Crows Haven card faces: our own deck design (four colour emblems + the Crow). Not the Spades cards.
import React from 'react';
import { Card, Colour, COLOUR_NAME, cardPoints, isCrow } from '../../shared/crows/engine';

/** Emblem for each colour: Sky = cloud, Ember = flame, Moss = leaf, Plum = berry. */
export function Emblem({ s, size = 24, className }: { s: Colour; size?: number; className?: string }) {
  const paths: Record<Colour, React.ReactNode> = {
    sky: <path d="M7 18h10.5a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.6 8.2 5 5 0 0 0 7 18z" />,
    ember: <path d="M12 2c.6 3.4 4.8 5.6 4.8 10.6A4.8 4.8 0 0 1 12 22a4.8 4.8 0 0 1-4.8-4.8c0-2.2 1.2-3.6 2.4-4.6-.1 1.6.6 2.8 1.8 3.2C10.6 12.2 11.4 6.6 12 2z" />,
    moss: <path d="M20 4C9 4 4 10 4 18c0 .7.1 1.4.2 2C6 13 11 9.6 15 8.2 11 10.6 7.6 14.4 5.8 20.6 13.6 20 20 15 20 4z" />,
    plum: <><circle cx="12" cy="14" r="7.5" /><path d="M12 6.5c.4-2.2 1.8-3.8 4.2-4.3-.3 2.4-1.8 3.9-4.2 4.3z" /></>,
  };
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{paths[s]}</svg>;
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

export function CrowCard({ card, back, className, style, onClick, dataCard }: {
  card?: Card; back?: boolean; className?: string; style?: React.CSSProperties; onClick?: () => void; dataCard?: string;
}) {
  if (back || !card) return <div className={`ccard back ${className ?? ''}`} style={style} aria-hidden="true"><span className="cc-back-mark"><CrowArt size={54} /></span></div>;
  const Tag = onClick ? 'button' : 'div';
  const pts = cardPoints(card);
  if (isCrow(card)) {
    return (
      <Tag className={`ccard crow ${className ?? ''}`} style={style} data-card={dataCard} onClick={onClick} aria-label="The Crow, 20 points, highest trump">
        <span className="cc-corner"><b>C</b></span>
        <span className="cc-crow"><CrowArt /></span>
        <span className="cc-name">CROW</span>
        <span className="cc-pts">20</span>
      </Tag>
    );
  }
  const s = card.s as Colour;
  return (
    <Tag className={`ccard c-${s} ${className ?? ''}`} style={style} data-card={dataCard} onClick={onClick}
      aria-label={`${card.r} ${COLOUR_NAME[s]}${pts ? `, ${pts} points` : ''}`}>
      <span className="cc-corner"><b>{card.r}</b><Emblem s={s} size={20} /></span>
      <span className="cc-big">{card.r}</span>
      <span className="cc-emblem"><Emblem s={s} size={40} /></span>
      {pts > 0 && <span className="cc-pts">{pts}</span>}
    </Tag>
  );
}
