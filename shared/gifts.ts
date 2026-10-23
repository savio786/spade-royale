// Gifts a player can buy at the table, for one player or for everybody ("a round").
// To add a gift, add a line here: id (never change it once released), the picture (an emoji), the name and the price in coins.
// The shop lists them cheapest first, in the order below.
export interface Gift { id: string; e: string; name: string; cost: number }

export const GIFTS: Gift[] = [
  // 25
  { id: 'cola', e: '🥤', name: 'Cola', cost: 25 },
  { id: 'strawberry', e: '🍓', name: 'Strawberry', cost: 25 },
  { id: 'coffee', e: '☕', name: 'Coffee', cost: 25 },
  { id: 'donut', e: '🍩', name: 'Donut', cost: 25 },
  { id: 'cookie', e: '🍪', name: 'Cookie', cost: 25 },
  // 50
  { id: 'lollipop', e: '🍭', name: 'Lollipop', cost: 50 },
  { id: 'beer', e: '🍺', name: 'Beer', cost: 50 },
  { id: 'hotdog', e: '🌭', name: 'Hot Dog', cost: 50 },
  { id: 'icecream', e: '🍦', name: 'Ice Cream', cost: 50 },
  { id: 'pizza', e: '🍕', name: 'Pizza', cost: 50 },
  // 100
  { id: 'cocktail', e: '🍹', name: 'Cocktail', cost: 100 },
  { id: 'whiskey', e: '🥃', name: 'Whiskey', cost: 100 },
  { id: 'burger', e: '🍔', name: 'Burger', cost: 100 },
  { id: 'cake', e: '🍰', name: 'Cake', cost: 100 },
  // 250
  { id: 'popcorn', e: '🍿', name: 'Popcorn', cost: 250 },
  { id: 'champagne', e: '🍾', name: 'Champagne', cost: 250 },
  { id: 'steak', e: '🥩', name: 'Steak', cost: 250 },
  { id: 'rose', e: '🌹', name: 'Rose', cost: 250 },
  // premium
  { id: 'trophy', e: '🏆', name: 'Trophy', cost: 1000 },
  { id: 'crown', e: '👑', name: 'Crown', cost: 2500 },
  { id: 'diamond', e: '💎', name: 'Diamond', cost: 5000 },
];

export const GIFT_BY_ID: Record<string, Gift> = Object.fromEntries(GIFTS.map((g) => [g.id, g]));
/** The most gifts kept on one player in one game (the oldest drop off). */
export const MAX_GIFTS_PER_SEAT = 24;
