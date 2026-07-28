import type { Card, Suit, Rank, DeckCount } from "./types.js";

export function fullDeck(): Card[] {
  const suits: Suit[] = ["S","H","D","C"];
  const cards: Card[] = [];
  let index = 0;
  for (const s of suits) {
    for (let r=1 as Rank; r<=13; r++) {
      cards.push({ id: `base:${index++}`, rank: r as Rank, suit: s });
    }
  }
  return cards;
}

export function buildShoe(deckCount: DeckCount, generation: number): Card[] {
  const base = fullDeck();
  const shoe: Card[] = [];
  for (let copy = 0; copy < deckCount; copy++) {
    for (const card of base) {
      shoe.push({
        ...card,
        id: `g${generation}:d${copy}:${card.id}`,
      });
    }
  }
  return shoe;
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
  if (deck.length < n) throw new Error(`draw: insufficient cards (${deck.length} < ${n})`);
  return { drawn: deck.slice(0, n), deck: deck.slice(n) };
}
