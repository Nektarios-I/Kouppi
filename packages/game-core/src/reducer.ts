import type {
  Card, Chips, GameState, Player, TableConfig, Upcards, DeckCount, DeckShufflePolicy
} from "./types.js";
import {
  SHISTRI_DEFAULT_MIN_CHIP,
  SHISTRI_DEFAULT_PERCENT,
  DEFAULT_DECK_COUNT,
  DEFAULT_DECK_SHUFFLE_POLICY,
  ALLOWED_DECK_COUNTS,
} from "./types.js";
import { buildShoe, fullDeck, shuffle, draw } from "./deck.js";
import { makeRng } from "./rng.js";
import {
  isConsecutive, isPair,
  canShistri, shistriBet
} from "./validators.js";
import { deriveAnte, normalizeAnteProgression } from "./anteProgression.js";

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

/** Thrown when a client gameplay intent is illegal (SOFT-REJECT-001). */
export class IllegalActionError extends Error {
  readonly code = "illegal_action" as const;
  constructor(message: string) {
    super(message);
    this.name = "IllegalActionError";
  }
}

/** Create a new game with default config merged with overrides. */
export function initGame(params: {
  players: { id: string; name: string; isBot?: boolean }[];
  config?: Partial<TableConfig>;
  seed?: number;
}): GameState {
  const normalizedDeckCount = normalizeDeckCount(params.config?.deckCount);
  const normalizedShufflePolicy = normalizeShufflePolicy(params.config);
  const defaultConfig: TableConfig = {
    ante: 10,
    startingBankroll: 100,
    minBetPolicy: { type: "fixed", value: 10 },
    shistri: { enabled: true, percent: SHISTRI_DEFAULT_PERCENT, minChip: SHISTRI_DEFAULT_MIN_CHIP },
    maxPlayers: 20,
    deckCount: normalizedDeckCount,
    shufflePolicy: normalizedShufflePolicy,
    deckPolicy: "single_no_reshuffle_until_empty",
    allowKouppi: true,
    spectatorsAllowed: false,
    language: "en"
  };
  const merged = {
    ...defaultConfig,
    ...(params.config || {}),
    deckCount: normalizedDeckCount,
    shufflePolicy: normalizedShufflePolicy,
  };
  const anteProgression = normalizeAnteProgression(
    params.config?.anteProgression ?? merged.anteProgression,
    merged.ante
  );
  const cfg: TableConfig = {
    ...merged,
    ante: anteProgression.startingAnte,
    anteProgression,
  };
  const seed = params.seed ?? 123456;
  const rng = makeRng(seed);
  const deck = shuffle(buildShoe(normalizedDeckCount, 1), rng);
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
    shoe: {
      deckCount: normalizedDeckCount,
      shufflePolicy: normalizedShufflePolicy,
      baseDeckSize: fullDeck().length,
      shoeSize: fullDeck().length * normalizedDeckCount,
      generation: 1,
      shuffleCount: 1,
      remaining: deck.length,
    },
    turn: null,
    history: ["Game initialized"],
    phase: "Lobby",
    lastResolution: null,
    awaitNext: false,
    completedRounds: 0,
  };

}

/** Returns a fresh copy of the state with only the mutated pieces cloned. */
function cloneForMutation(s: GameState): GameState {
  return {
    ...s,
    // keep rng function reference
    config: {
      ...s.config,
      anteProgression: s.config.anteProgression
        ? { ...s.config.anteProgression }
        : undefined,
      minBetPolicy: { ...s.config.minBetPolicy } as typeof s.config.minBetPolicy,
      shistri: { ...s.config.shistri },
    },
    players: s.players.map(p => ({ ...p })),
    deck: s.deck.slice(),
    discard: s.discard.slice(),
    round: { ...s.round },
    history: s.history.slice(),
    shoe: { ...s.shoe },
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

function normalizeDeckCount(deckCount: number | undefined): DeckCount {
  if (deckCount && ALLOWED_DECK_COUNTS.includes(deckCount as DeckCount)) {
    return deckCount as DeckCount;
  }
  return DEFAULT_DECK_COUNT;
}

function normalizeShufflePolicy(config?: Partial<TableConfig>): DeckShufflePolicy {
  if (config?.shufflePolicy === "RESET_EACH_ROUND" || config?.shufflePolicy === "CONTINUOUS_SHOE") {
    return config.shufflePolicy;
  }
  return DEFAULT_DECK_SHUFFLE_POLICY;
}

function rebuildShoe(state: GameState) {
  state.shoe.generation += 1;
  state.shoe.shuffleCount += 1;
  state.deck = shuffle(buildShoe(state.shoe.deckCount, state.shoe.generation), state.rng);
  state.discard = [];
  state.shoe.shoeSize = state.shoe.baseDeckSize * state.shoe.deckCount;
  state.shoe.remaining = state.deck.length;
}

function refreshRemaining(state: GameState) {
  state.shoe.remaining = state.deck.length;
}

function minimumRoundStartCards(state: GameState): number {
  const activePlayers = Math.max(1, state.players.length);
  return activePlayers * 2 + 1;
}

function prepareRoundShoe(state: GameState) {
  if (state.shoe.shufflePolicy === "RESET_EACH_ROUND") {
    rebuildShoe(state);
    return;
  }
  if (state.deck.length < minimumRoundStartCards(state)) {
    rebuildShoe(state);
  }
}

/** Ensure we have at least `need` cards to draw; no mid-round reshuffle. */
function ensureDraw(state: GameState, need: number) {
  if (need <= 0) return;
  if (state.deck.length >= need) return;
  throw new IllegalActionError(`Shoe exhausted: need ${need}, have ${state.deck.length}`);
}

export function applyAction(s: GameState, action: Action): GameState {
  const state = cloneForMutation(s);
  const log = (msg: string) => state.history.push(msg);

  switch (action.type) {
    case "startRound": {
      prepareRoundShoe(state);
      state.phase = "Round";
      state.round.pot = 0;
      state.turn = null;
      state.lastResolution = null;
      state.awaitNext = false;
      refreshRemaining(state);
      log("Round started");
      return state;
    }

    case "ante": {
      const progression = normalizeAnteProgression(
        state.config.anteProgression,
        state.config.anteProgression?.startingAnte ?? state.config.ante
      );
      state.config.anteProgression = progression;
      const ante = deriveAnte(progression, state.completedRounds ?? 0);
      state.config.ante = ante;
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
          refreshRemaining(state);
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
      refreshRemaining(state);
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
    if (!state.turn) throw new IllegalActionError("No active turn");
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
  if (!state.turn) throw new IllegalActionError("No active turn");
  const p = state.players[state.currentIndex];
  const up = state.turn.upcards!;
  const potBefore = state.round.pot;

  // Determine action kind and amount
  let amount: Chips;
  let kind: "bet" | "kouppi" | "shistri" = action.type;

  if (action.type === "kouppi") {
    if (p.bankroll < potBefore || potBefore <= 0) {
      throw new IllegalActionError("KOUPPI not allowed");
    }
    amount = potBefore; // KOUPPI bets the whole pot
  } else if (action.type === "shistri") {
    if (!state.config.shistri.enabled || !canShistri(up)) {
      throw new IllegalActionError("SHISTRI not allowed");
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
      throw new IllegalActionError(`Illegal bet ${amount}; allowed [${effMin}, ${maxBet}]`);
    }
  } else {
    if (!(amount >= 1 && amount <= maxBet)) {
      throw new IllegalActionError(`Illegal SHISTRI ${amount}; allowed [1, ${maxBet}]`);
    }
  }

  // Draw third card
  ensureDraw(state, 1);
  const d = draw(state.deck, 1);
  state.deck = d.deck;
  refreshRemaining(state);
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
    state.completedRounds = (state.completedRounds ?? 0) + 1;
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
      prepareRoundShoe(state);
      state.phase = "Round";
      state.turn = null;
      state.lastResolution = null;
      state.awaitNext = false;

      state.round.pot = 0;
      state.round.starterIndex = (state.round.starterIndex + 1) % state.players.length;
      state.currentIndex = state.round.starterIndex;
      refreshRemaining(state);
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
