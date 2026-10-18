// Profile photos: cropped to a square, shrunk to 160px JPEG in the browser, then stored on the game server.
import { serverOrigin } from './config';
import { profile } from './profile';

export const photoUrl = (k: string) => `${serverOrigin() ?? ''}/api/photo/${k.slice(2)}`;

async function toJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('That file isn’t a picture we can read.')); i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    // Centre crop, nudged up a little so faces in portrait photos stay in frame.
    const sx = (img.naturalWidth - side) / 2, sy = Math.max(0, (img.naturalHeight - side) / 2 - (img.naturalHeight - side) * 0.2);
    g.drawImage(img, sx, sy, side, side, 0, 0, 160, 160);
    for (const q of [0.85, 0.75, 0.6]) { const d = c.toDataURL('image/jpeg', q); if (d.length < 30_000) return d; }
    return c.toDataURL('image/jpeg', 0.5);
  } finally { URL.revokeObjectURL(url); }
}

/** Returns the avatar key (u:<id>) for an uploaded photo. */
export async function uploadPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a picture file.');
  const data = await toJpeg(file);
  const o = serverOrigin();
  if (!o) throw new Error('Photos need the online server.');
  const r = await fetch(`${o}/api/photo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data, owner: profile.get().id }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error(j.error || 'Upload failed — please try again.');
  return `u:${j.id}`;
}
