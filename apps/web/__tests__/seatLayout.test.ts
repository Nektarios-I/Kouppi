import { describe, it, expect } from "vitest";
import {
  betAnchor,
  formatSeatAmount,
  getSeatLayoutBreakpoint,
  getSeatLayoutConfig,
  seatInitials,
  truncateSeatName,
  SEAT_SAFE_ZONE,
} from "@/components/game/seatLayout";

describe("seatLayout", () => {
  describe("getSeatLayoutBreakpoint", () => {
    it("maps widths to mobile / tablet / desktop", () => {
      expect(getSeatLayoutBreakpoint(320)).toBe("mobile");
      expect(getSeatLayoutBreakpoint(639)).toBe("mobile");
      expect(getSeatLayoutBreakpoint(640)).toBe("tablet");
      expect(getSeatLayoutBreakpoint(1023)).toBe("tablet");
      expect(getSeatLayoutBreakpoint(1024)).toBe("desktop");
      expect(getSeatLayoutBreakpoint(1440)).toBe("desktop");
    });
  });

  describe("getSeatLayoutConfig", () => {
    it("places local player at bottom-center for all supported counts", () => {
      for (const n of [2, 3, 4, 5, 6, 7, 8]) {
        for (const viewerIndex of [0, Math.min(1, n - 1)]) {
          const layout = getSeatLayoutConfig({
            playerCount: n,
            viewerIndex,
            breakpoint: "desktop",
          });
          const localSlot = layout.slots[viewerIndex];
          expect(localSlot.edge).toBe("bottom");
          expect(localSlot.seat.x).toBe(50);
          expect(localSlot.seat.y).toBeGreaterThanOrEqual(90);
        }
      }
    });

    it("gives unique seat anchors and unique bet anchors per player", () => {
      for (const n of [2, 4, 6, 8]) {
        const layout = getSeatLayoutConfig({
          playerCount: n,
          viewerIndex: 0,
          breakpoint: "desktop",
        });
        const seatKeys = layout.slots.map((s) => `${s.seat.x},${s.seat.y}`);
        const betKeys = layout.slots.map((s) => `${s.bet.x},${s.bet.y}`);
        expect(new Set(seatKeys).size).toBe(n);
        expect(new Set(betKeys).size).toBe(n);
      }
    });

    it("never places bet anchor on the same point as seat anchor", () => {
      for (const n of [2, 3, 4, 5, 6, 7, 8]) {
        const layout = getSeatLayoutConfig({
          playerCount: n,
          viewerIndex: 0,
          breakpoint: "mobile",
        });
        for (const slot of layout.slots) {
          expect(slot.bet.x === slot.seat.x && slot.bet.y === slot.seat.y).toBe(
            false
          );
        }
      }
    });

    it("keeps seat centers outside the central safe-zone ellipse (approximate)", () => {
      const { cx, cy, rx, ry } = SEAT_SAFE_ZONE;
      for (const n of [2, 4, 8]) {
        const layout = getSeatLayoutConfig({
          playerCount: n,
          viewerIndex: 0,
          breakpoint: "desktop",
        });
        for (const slot of layout.slots) {
          const dx = (slot.seat.x - cx) / rx;
          const dy = (slot.seat.y - cy) / ry;
          const inside = dx * dx + dy * dy < 1;
          expect(inside).toBe(false);
        }
      }
    });

    it("maps 2-player opponent to top edge", () => {
      const layout = getSeatLayoutConfig({
        playerCount: 2,
        viewerIndex: 0,
        breakpoint: "desktop",
      });
      expect(layout.slots[0].edge).toBe("bottom");
      expect(layout.slots[1].edge).toBe("top");
      expect(layout.slots[1].seat.y).toBeLessThan(10);
    });

    it("uses different coordinates for mobile vs desktop", () => {
      const desktop = getSeatLayoutConfig({
        playerCount: 2,
        viewerIndex: 0,
        breakpoint: "desktop",
      });
      const mobile = getSeatLayoutConfig({
        playerCount: 2,
        viewerIndex: 0,
        breakpoint: "mobile",
      });
      expect(mobile.slots[0].seat.y).not.toBe(desktop.slots[0].seat.y);
    });
  });

  describe("betAnchor", () => {
    it("moves toward table center", () => {
      const seat = { x: 50, y: 92 };
      const bet = betAnchor(seat);
      expect(bet.y).toBeLessThan(seat.y);
      expect(bet.y).toBeGreaterThan(42);
    });
  });

  describe("formatSeatAmount", () => {
    it("formats compactly", () => {
      expect(formatSeatAmount(0)).toBe("0");
      expect(formatSeatAmount(999)).toBe("999");
      expect(formatSeatAmount(1000)).toBe("1K");
      expect(formatSeatAmount(2480)).toBe("2.5K");
      expect(formatSeatAmount(12500)).toBe("12.5K");
      expect(formatSeatAmount(1_200_000)).toBe("1.2M");
    });
  });

  describe("truncateSeatName / seatInitials", () => {
    it("truncates long names", () => {
      expect(truncateSeatName("Nektarios", 7)).toBe("Nektar…");
      expect(truncateSeatName("Bot 1", 7)).toBe("Bot 1");
    });

    it("builds initials", () => {
      expect(seatInitials("Alice")).toBe("AL");
      expect(seatInitials("Bob Smith")).toBe("BS");
      expect(seatInitials("")).toBe("?");
    });
  });
});
