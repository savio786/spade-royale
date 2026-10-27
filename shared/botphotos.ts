// Computer players who have a real picture instead of a drawn portrait.
// To add one: put a square picture (about 360×360, .webp or .jpg) in public/brand/bots/ and add a line below.
// The id must be "b" plus a number and the file name must match (b3 → public/brand/bots/b3.webp).
export interface BotPhoto { id: string; name: string; file: string }
export const BOT_PHOTOS: BotPhoto[] = [
  { id: 'b1', name: 'Jasmine Carter', file: '/brand/bots/b1.webp' },
  { id: 'b2', name: 'Brooke Harlan', file: '/brand/bots/b2.webp' },
];
export const BOT_PHOTO_BY_ID: Record<string, BotPhoto> = Object.fromEntries(BOT_PHOTOS.map((b) => [b.id, b]));
