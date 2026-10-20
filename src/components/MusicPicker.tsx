import { useEffect } from 'react';
import { profile, useProfile } from '../lib/profile';
import { music, SONGS } from '../lib/sound';

/** Background tracks. At a table the pick switches straight away; in Settings it plays a short preview. */
export function MusicPicker({ compact = false }: { compact?: boolean }) {
  const p = useProfile();
  const cur = p.settings.track ?? SONGS[0].id;
  const off = p.settings.music === false;
  useEffect(() => () => { if (!music.atTable) music.stop(); }, []);
  const pick = (id: string) => {
    profile.set((x) => ({ settings: { ...x.settings, track: id, music: true } }));
    music.preview(id);
  };
  return (
    <div className={'music-pick' + (compact ? ' compact' : '') + (off ? ' off' : '')} role="radiogroup" aria-label="Background music">
      {SONGS.map((s, i) => (
        <button key={s.id} role="radio" aria-checked={cur === s.id} className={'mp-item' + (cur === s.id ? ' on' : '')} onClick={() => pick(s.id)}>
          <span className="mp-num">{cur === s.id && !off ? <span className="mp-eq" aria-hidden="true"><i /><i /><i /></span> : i + 1}</span>
          <span className="mp-text"><b>{s.name}</b><small>{s.mood}</small></span>
        </button>
      ))}
    </div>
  );
}
