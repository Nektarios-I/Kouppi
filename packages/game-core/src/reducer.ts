import type {
  Card, Chips, GameState, Player, TableConfig, Upcards, Rank
} from "./types.js";
import { fullDeck, shuffle, draw } from "./deck.js";
import { makeRng } from "./rng.js";
import {
  betweenExclusive, effectiveMinBet, isConsecutive, isPair,
  canShistri, shistriBet
} from "./validators.js";

export type Action =
  | { type: "startRound" }
  | { type: "ante" }
  | { type: "determineStarter" }
  | { type: "startTurn" }
  | { type: "pass" }
  | { type: "bet"; amount: Chips }
  | { type: "kouppi" }
  | { type: "shistri" }
  | { type: "nextPlayer" }
  | { type: "nextRound" };

/** Create a new game with default config merged with overrides. */
export function initGame(params: {
  players: { id: string; name: string; isBot?: boolean }[];
  config?: Partial<TableConfig>;
  seed?: number;
}): GameState {
  const defaultConfig: TableConfig = {
    ante: 10,
    startingBankroll: 100,
    minBetPolicy: { type: "fixed", value: 10 },
    shistri: { enabled: true, percent: 5, minChip: 1 },
    maxPlayers: 20,
    deckPolicy: "single_no_reshuffle_until_empty",
    allowKouppi: true,
    spectatorsAllowed: false,
    language: "en"
  };
  const cfg: TableConfig = { ...defaultConfig, ...(params.config || {}) };
  const seed = params.seed ?? 123456;
  const rng = makeRng(seed);
  const deck = shuffle(fullDeck(), rng);
  const players: Player[] = params.players.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: !!p.isBot,
    bankroll: cfg.startingBankroll,
    active: true
  }));
  return {
    seed, rng, deck, discard: [], players,
    currentIndex: 0,
    round: { starterIndex: 0, pot: 0 },
    config: cfg,
    turn: null,
    history: ["Game initialized"],
    phase: "Lobby",
    lastResolution: null, // <--- add this
    awaitNext: false,
  };

}

/** Returns a fresh copy of the state with only the mutated pieces cloned. */
function cloneForMutation(s: GameState): GameState {
  return {
    ...s,
    // keep rng function reference, config as-is
    players: s.players.map(p => ({ ...p })),
    deck: s.deck.slice(),
    discard: s.discard.slice(),
    round: { ...s.round },
    history: s.history.slice(),
    turn: s.turn
      ? {
          ...s.turn,
          upcards: s.turn.upcards
            ? { a: { ...s.turn.upcards.a }, b: { ...s.turn.upcards.b } }
            : undefined,
          reveal: s.turn.reveal ? { ...s.turn.reveal } : undefined,
        }
      : null,
  };
}

/** Ensure we have at least `need` cards to draw; do an emergency reshuffle if needed. */
function ensureDraw(state: GameState, need: number) {
  if (need <= 0) return;
  if (state.deck.length >= need) return;

  // Emergency one-time reshuffle from discards to continue the current action/turn
  if (state.discard.length > 0) {
    state.deck = shuffle(state.discard, state.rng);
    state.discard = [];
  }
  // After reshuffle, if still not enough, we draw as many as we can.
}

export function applyAction(s: GameState, action: Action): GameState {
  const state = cloneForMutation(s);
  const log = (msg: string) => state.history.push(msg);

  switch (action.type) {
    case "startRound": {
      state.phase = "Round";
      state.round.pot = 0;
      state.turn = null;
      state.lastResolution = null;
      state.awaitNext = false;
      log("Round started");
      return state;
    }

    case "ante": {
      const ante = state.config.ante;
      state.players.forEach(p => {
        const pay = Math.min(p.bankroll, ante);
        p.bankroll -= pay;
        state.round.pot += pay;
        // Player may hit zero, but stays in rotation; no inactive flag
      });
      log(`Ante collected: +${ante} per player (zero bankroll stays)`);
      return state;
    }

    case "determineStarter": {
      // After first round, starter rotates
      const alreadyDecided = state.history.some(h => h.startsWith("Starter decided"));
      if (alreadyDecided) {
        state.round.starterIndex = (state.round.starterIndex + 1) % state.players.length;
        state.currentIndex = state.round.starterIndex;
        log(`Starter rotated to ${state.players[state.currentIndex].name}`);
        return state;
      }

      // First round: highest card decides; ties -> redeal
      // We may need multiple draws to break ties
      while (true) {
        ensureDraw(state, state.players.length);
        const hands = state.players.map(() => {
          const d = draw(state.deck, 1);
          state.deck = d.deck;
          return d.drawn[0];
        });
        const ranks = hands.map(c => c.rank);
        const max = Math.max(...ranks);
        const winners = ranks
          .map((r, i) => (r === max ? i : -1))
          .filter(i => i >= 0);

        // discard all these reveal cards
        state.discard.push(...hands);

        if (winners.length === 1) {
          const w = winners[0]!;
          state.round.starterIndex = w;
          state.currentIndex = w;
          log(`Starter decided: ${state.players[w].name}`);
          return state;
        }
        // else continue loop to redraw a single deciding card to each player
      }
    }

    case "startTurn": {
      const p = state.players[state.currentIndex];

      // Deal two upcards (even if bankrupt)
      ensureDraw(state, 2);
      const d = draw(state.deck, 2);
      state.deck = d.deck;
      const up: Upcards = { a: d.drawn[0], b: d.drawn[1] };
      state.turn = { playerId: p.id, upcards: up };
      log(`Turn: ${p.name} upcards ${cardStr(up.a)} ${cardStr(up.b)}`);

      // Note: Pair or consecutive cards are bad hands with no winning range,
      // but we let the player decide to pass or bet anyway (they'll likely lose)
      if (isPair(up) || isConsecutive(up)) {
        log(`Bad hand (pair or consecutive) - player can still act`);
      }

      // If bankrupt, auto-pass immediately (cards dealt but not actionable)
      if (p.bankroll <= 0) {
        log(`${p.name} has zero bankroll; auto-pass`);
        return applyAction(state, { type: "pass" });
      }

      return state;
    }

  case "pass": {
    if (!state.turn) return state;
    const up = state.turn.upcards!;
    const p = state.players[state.currentIndex];
    // discard upcards
    state.discard.push(up.a, up.b);
    // log + snapshot (no reveal)
    log(`Pass`);
    state.lastResolution = {
      kind: "pass",
      playerId: p.id,
      upcards: up,
      reveal: undefined,
      amount: 0,
      win: false,
    };
    state.turn = null;
    state.awaitNext = true; // wait for UI "Next Turn"
    return state;
  }


    case "bet":
    case "kouppi":
case "shistri": {
  if (!state.turn) return state;
  const p = state.players[state.currentIndex];
  const up = state.turn.upcards!;
  const potBefore = state.round.pot;

  // Determine action kind and amount
  let amount: Chips;
  let kind: "bet" | "kouppi" | "shistri" = action.type;

  if (action.type === "kouppi") {
    if (p.bankroll < potBefore || potBefore <= 0) {
      log("KOUPPI not allowed");
      return state;
    }
    amount = potBefore; // KOUPPI bets the whole pot
  } else if (action.type === "shistri") {
    if (!state.config.shistri.enabled || !canShistri(up)) {
      log("SHISTRI not allowed");
      return state;
    }
    // SHISTRI small bet; ignore table min. Cap by bankroll and pot.
    amount = Math.min(
      p.bankroll,
      Math.min(potBefore, shistriBet(potBefore, state.config.shistri.percent, state.config.shistri.minChip))
    );
  } else {
    amount = action.amount;
  }

  // Legality
  const configMin =
    state.config.minBetPolicy.type === "fixed"
      ? state.config.minBetPolicy.value
      : 1;
  const effMin = Math.min(configMin, potBefore);
  const maxBet = Math.min(p.bankroll, potBefore);

  const isAllIn = amount === p.bankroll;

  if (kind !== "shistri") {
    const legalRegular =
      (amount >= effMin && amount <= maxBet) || (isAllIn && amount <= maxBet);
    if (!legalRegular) {
      log(`Illegal bet ${amount}; allowed [${effMin}, ${maxBet}]`);
      return state;
    }
  } else {
    if (!(amount >= 1 && amount <= maxBet)) {
      log(`Illegal SHISTRI ${amount}; allowed [1, ${maxBet}]`);
      return state;
    }
  }

  // Draw third card
  ensureDraw(state, 1);
  const d = draw(state.deck, 1);
  state.deck = d.deck;
  const reveal = d.drawn[0];
  state.turn.reveal = reveal;
  state.turn.betAmount = amount;

  const low = Math.min(up.a.rank, up.b.rank);
  const high = Math.max(up.a.rank, up.b.rank);
  const win = reveal.rank > low && reveal.rank < high;

  let displayAmount = amount; // amount to show in UI for WIN/LOSS

  if (win) {
    if (kind === "shistri") {
      // SHISTRI WIN: take the ENTIRE POT
      displayAmount = state.round.pot;
      p.bankroll += state.round.pot;
      state.round.pot = 0;
      log(`${p.name} WIN ${displayAmount} (SHISTRI) (reveal ${cardStr(reveal)}) pot=${state.round.pot}`);
    } else {
      // Regular / KOUPPI win: take bet amount from pot
      state.round.pot -= amount;
      p.bankroll += amount;
      log(`${p.name} WIN ${amount} (${kind.toUpperCase()}) (reveal ${cardStr(reveal)}) pot=${state.round.pot}`);
    }
  } else {
    // Loss: add bet to pot
    state.round.pot += amount;
    p.bankroll -= amount;
    // If bankroll hits zero, player remains in rotation and will auto-pass next turn
    log(`${p.name} LOSS ${amount} (${kind.toUpperCase()}) (reveal ${cardStr(reveal)}) pot=${state.round.pot}`);
  }

  // Snapshot for UI
  state.lastResolution = {
    kind,
    playerId: p.id,
    upcards: up,
    reveal,
    amount: displayAmount,
    win,
  };

  // discard 3 cards
  state.discard.push(up.a, up.b, reveal);
  state.turn = null;

  // Round ends only when pot == 0
  if (state.round.pot <= 0) {
    state.phase = "RoundEnd";
    state.awaitNext = false;
    log("Round ended (pot=0)");
    return state;
  }

  // Pause and wait for UI "Next Turn" button
  state.awaitNext = true;
  return state;
}

    case "nextPlayer": {
      state.awaitNext = false;
      state.currentIndex = (state.currentIndex + 1) % state.players.length;
      return state;
    }

    case "nextRound": {
      // Re-ante and rotate starter
      state.phase = "Round";
      state.turn = null;
      state.lastResolution = null;
      state.awaitNext = false;

      state.round.pot = 0;
      state.round.starterIndex = (state.round.starterIndex + 1) % state.players.length;
      state.currentIndex = state.round.starterIndex;
      state.history.push("New round");
      return state;
    }

    default:
      return state;
  }
}

// Helpers
function cardStr(c: Card): string {
  const rankMap: Record<number,string> = {1:"A",11:"J",12:"Q",13:"K"};
  return (rankMap[c.rank] || String(c.rank)) + c.suit;
}
