// Tiny helper so translated sentences can keep bold words: "Make **Nil** (0)" → Make <b>Nil</b> (0).
import { Fragment, ReactNode } from 'react';

export function rich(s: string): ReactNode {
  const parts = s.split('**');
  if (parts.length === 1) return s;
  return parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <Fragment key={i}>{p}</Fragment>));
}
