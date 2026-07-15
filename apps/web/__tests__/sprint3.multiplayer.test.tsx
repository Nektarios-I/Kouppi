import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "@/components/game/ConfirmDialog";

describe("Sprint 3 UI", () => {
  it("ConfirmDialog renders themed confirmation and fires callbacks", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        title="KOUPPI — All In"
        message="Bet the full pot?"
        confirmLabel="KOUPPI"
        confirmVariant="kouppi"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText("KOUPPI — All In")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /KOUPPI/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("how-to-play page links back to lobby", async () => {
    const HowToPlay = (await import("@/app/how-to-play/page")).default;
    render(<HowToPlay />);
    expect(screen.getByRole("link", { name: /Play Multiplayer/i })).toHaveAttribute("href", "/lobby");
  });
});
