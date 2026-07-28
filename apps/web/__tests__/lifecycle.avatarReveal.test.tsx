import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AvatarPicker from "@/components/AvatarPicker";
import { getCenterCardsPresentation } from "@/components/game/useCenterCardsPresentation";

describe("getCenterCardsPresentation keepResultVisible", () => {
  it("shows reveal during RoundEnd reveal delay", () => {
    const view = getCenterCardsPresentation({
      awaitingNext: false,
      keepResultVisible: true,
      lastResolution: {
        kind: "kouppi",
        upcards: { a: { rank: 2, suit: "H" }, b: { rank: 10, suit: "S" } },
        reveal: { rank: 5, suit: "D" },
      },
    });
    expect(view.mode).toBe("cards");
    if (view.mode === "cards") {
      expect(view.items.some((i) => i.type === "flip")).toBe(true);
    }
  });
});

describe("AvatarPicker portal", () => {
  it("opens a dialog outside clipped parents and closes on Escape", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <div style={{ overflow: "hidden", height: 40 }}>
        <AvatarPicker currentAvatar={{ id: "portrait-01" }} onSelect={onSelect} />
      </div>
    );

    await user.click(screen.getByTitle("Change avatar"));
    expect(screen.getByRole("dialog", { name: /your avatar choice/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /your avatar choice/i })).not.toBeInTheDocument();
  });
});
