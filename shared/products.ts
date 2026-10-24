// Everything a player can buy. Prices are in US cents. Shared by the store screen and the payment server.
export type ProductKind = 'coins' | 'chat' | 'vip';
export interface Product {
  id: string;
  kind: ProductKind;
  name: string;
  priceCents: number;
  coins?: number;      // coin packs
  chatDays?: number;   // chat passes (0 = lifetime)
  vipDays?: number;    // VIP Club membership
  tag?: string;
}

export const PRODUCTS: Product[] = [
  { id: 'coins_25k', kind: 'coins', name: '25,000 coins', priceCents: 99, coins: 25_000 },
  { id: 'coins_150k', kind: 'coins', name: '150,000 coins', priceCents: 499, coins: 150_000, tag: 'Popular' },
  { id: 'coins_400k', kind: 'coins', name: '400,000 coins', priceCents: 999, coins: 400_000 },
  { id: 'coins_1m', kind: 'coins', name: '1,000,000 coins', priceCents: 1999, coins: 1_000_000, tag: 'Best value' },
  { id: 'coins_3m', kind: 'coins', name: '3,000,000 coins', priceCents: 4999, coins: 3_000_000 },
  { id: 'coins_8m', kind: 'coins', name: '8,000,000 coins', priceCents: 9999, coins: 8_000_000 },
  { id: 'chat_1d', kind: 'chat', name: 'Chat Pass — 1 day', priceCents: 99, chatDays: 1 },
  { id: 'chat_30d', kind: 'chat', name: 'Chat Pass — 30 days', priceCents: 299, chatDays: 30, tag: 'Popular' },
  { id: 'chat_life', kind: 'chat', name: 'Chat Pass — lifetime', priceCents: 999, chatDays: 0, tag: 'Best value' },
  { id: 'vip_30d', kind: 'vip', name: 'VIP Club — 30 days', priceCents: 199, vipDays: 30 },
  { id: 'vip_90d', kind: 'vip', name: 'VIP Club — 90 days', priceCents: 399, vipDays: 90, tag: 'Popular' },
  { id: 'vip_180d', kind: 'vip', name: 'VIP Club — 180 days', priceCents: 699, vipDays: 180 },
];

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
export const priceLabel = (cents: number) => `$${(cents / 100).toFixed(2)}`;
