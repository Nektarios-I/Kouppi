import type { Card, Suit, Rank } from "./types.js";
import { makeRng } from "./rng.js";

export function fullDeck(): Card[] {
  const suits: Suit[] = ["S","H","D","C"];
  const cards: Card[] = [];
  for (const s of suits) {
    for (let r=1 as Rank; r<=13; r++) {
      cards.push({rank: r as Rank, suit: s});
    }
  }
  return cards;
}

export function shuffle(cards: Card[], rand: () => number): Card[] {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function draw(deck: Card[], n: number): { drawn: Card[]; deck: Card[] } {
  if (n < 0) throw new Error("draw: n must be >= 0");
  return { drawn: deck.slice(0, n), deck: deck.slice(n) };
}
