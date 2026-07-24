"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FeedbackDedupeSet,
  advanceRibbon,
  createRibbonQueue,
  enqueueRibbon,
  historyLimitForViewport,
  normalizeResolutionEvent,
  normalizeStakePulse,
  pushHistory,
  type LastResolutionLike,
  type PlayerNameLookup,
  type TableFeedbackEvent,
  type TableEffectsLevel,
} from "@/lib/tableEventFeedback";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  effectiveEffectsLevel,
  useTableEffectsStore,
} from "@/store/tableEffectsStore";
import { GameSounds } from "@/lib/sounds";
import TablePhysicalFeedbackLayer from "./TablePhysicalFeedbackLayer";
import TableResultRibbon from "./TableResultRibbon";
import TableEventLog from "./TableEventLog";

type FeedbackContextValue = {
  publishStake: (input: {
    playerId: string;
    playerName: string;
    amount: number;
    kind: "bet" | "kouppi" | "shistri";
  }) => void;
  activeRibbon: TableFeedbackEvent | null;
  logEntries: TableFeedbackEvent[];
  physicalEvents: TableFeedbackEvent[];
  visualLevel: TableEffectsLevel;
  onPhysicalComplete: (eventId: string) => void;
  viewportWidth: number;
};

const TableFeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useTableFeedback(): FeedbackContextValue {
  const ctx = useContext(TableFeedbackContext);
  if (!ctx) {
    throw new Error("useTableFeedback must be used within TableFeedbackProvider");
  }
  return ctx;
}

export function useTableFeedbackOptional(): FeedbackContextValue | null {
  return useContext(TableFeedbackContext);
}

export type TableFeedbackProviderProps = {
  children: React.ReactNode;
  lastResolution: LastResolutionLike | null | undefined;
  players: PlayerNameLookup[];
  localPlayerId: string | null | undefined;
  sequenceSalt?: string | number;
};

function playCue(cue: TableFeedbackEvent["soundCue"], soundOn: boolean): void {
  if (!soundOn || !cue || cue === "none") return;
  if (typeof window === "undefined") return;
  try {
    if (cue === "chip_place") GameSounds.bet();
    else if (cue === "chip_collect") GameSounds.chips();
    else if (cue === "shistri") GameSounds.chips();
    else if (cue === "round_complete") GameSounds.notify();
  } catch {
    // Missing/blocked audio must never throw
  }
}

export function TableFeedbackProvider({
  children,
  lastResolution,
  players,
  localPlayerId,
  sequenceSalt,
}: TableFeedbackProviderProps) {
  const prefersReduced = usePrefersReducedMotion();
  const effects = useTableEffectsStore((s) => s.effects);
  const soundPref = useTableEffectsStore((s) => s.sound);
  const visualLevel = effectiveEffectsLevel(effects, prefersReduced);
  const soundOn = soundPref === "on";

  const dedupeRef = useRef(new FeedbackDedupeSet(64));
  const [ribbonState, setRibbonState] = useState(() => createRibbonQueue());
  const [logEntries, setLogEntries] = useState<TableFeedbackEvent[]>([]);
  const [physicalEvents, setPhysicalEvents] = useState<TableFeedbackEvent[]>([]);
  const [viewportW, setViewportW] = useState(1024);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResKey = useRef<string | null>(null);

  useEffect(() => {
    const update = () => setViewportW(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const maxHistory = historyLimitForViewport(viewportW);

  const ingest = useCallback(
    (event: TableFeedbackEvent) => {
      if (event.channel !== "table") return;
      if (!dedupeRef.current.tryAdd(event.id)) return;

      setLogEntries((prev) => pushHistory(prev, event, maxHistory));
      setRibbonState((prev) => enqueueRibbon(prev, event));

      if (visualLevel !== "off" && event.physical.length > 0) {
        setPhysicalEvents((prev) => [...prev, event].slice(-4));
      }

      playCue(event.soundCue, soundOn && effects !== "off");
    },
    [maxHistory, soundOn, visualLevel, effects]
  );

  useEffect(() => {
    if (!lastResolution) return;
    const event = normalizeResolutionEvent({
      resolution: lastResolution,
      players,
      localPlayerId,
      sequenceSalt,
    });
    if (!event) return;
    // Track by id; dedupe set handles Strict Mode double invoke
    if (lastResKey.current === event.id) return;
    lastResKey.current = event.id;
    ingest(event);
  }, [lastResolution, players, localPlayerId, sequenceSalt, ingest]);

  useEffect(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    const current = ribbonState.current;
    if (!current) return;
    const id = current.id;
    const durationMs = current.durationMs;
    dismissTimer.current = setTimeout(() => {
      setRibbonState((prev) => {
        if (prev.current?.id !== id) return prev;
        return advanceRibbon(prev);
      });
    }, durationMs);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [ribbonState]);

  const publishStake = useCallback(
    (input: {
      playerId: string;
      playerName: string;
      amount: number;
      kind: "bet" | "kouppi" | "shistri";
    }) => {
      const event = normalizeStakePulse({
        ...input,
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      ingest(event);
    },
    [ingest]
  );

  const onPhysicalComplete = useCallback((eventId: string) => {
    setPhysicalEvents((prev) => prev.filter((e) => e.id !== eventId));
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      publishStake,
      activeRibbon: ribbonState.current,
      logEntries,
      physicalEvents,
      visualLevel,
      onPhysicalComplete,
      viewportWidth: viewportW,
    }),
    [publishStake, ribbonState, logEntries, physicalEvents, visualLevel, onPhysicalComplete, viewportW]
  );

  return (
    <TableFeedbackContext.Provider value={value}>{children}</TableFeedbackContext.Provider>
  );
}

/** Mount inside `.game-stage-table-region` (position:relative). */
export function TableFeedbackOverlays({
  tableSurfaceRef,
}: {
  tableSurfaceRef: React.RefObject<HTMLElement | null>;
}) {
  const ctx = useTableFeedbackOptional();
  if (!ctx) return null;
  return (
    <>
      <TablePhysicalFeedbackLayer
        events={ctx.physicalEvents}
        tableSurfaceRef={tableSurfaceRef}
        visualLevel={ctx.visualLevel}
        onEventComplete={ctx.onPhysicalComplete}
      />
      <TableResultRibbon event={ctx.activeRibbon} />
    </>
  );
}

/** Mount in secondary chrome or as mobile FAB sibling of stage. */
export function TableFeedbackLogSlot() {
  const ctx = useTableFeedbackOptional();
  if (!ctx) return null;
  return <TableEventLog entries={ctx.logEntries} viewportWidth={ctx.viewportWidth} />;
}

/** @deprecated alias */
export default TableFeedbackProvider;
