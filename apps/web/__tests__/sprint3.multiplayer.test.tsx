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

    const dialog = screen.getByRole("dialog", { name: "KOUPPI — All In" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /KOUPPI/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("ConfirmDialog cancels on Escape", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        title="Leave game?"
        message="Your round will be abandoned."
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("ConfirmDialog traps Tab, stays stable across rerenders, and restores prior focus", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<button type="button">Open dialog</button>);
    const opener = screen.getByRole("button", { name: "Open dialog" });
    opener.focus();

    rerender(
      <>
        <button type="button">Open dialog</button>
        <ConfirmDialog
          title="Leave game?"
          message="Your round will be abandoned."
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </>
    );

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(cancel).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(confirm).toHaveFocus();

    rerender(
      <>
        <button type="button">Open dialog</button>
        <ConfirmDialog
          title="Leave game?"
          message="Your round will be abandoned."
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </>
    );
    expect(confirm).toHaveFocus();

    rerender(<button type="button">Open dialog</button>);
    expect(screen.getByRole("button", { name: "Open dialog" })).toHaveFocus();
  });

  it("how-to-play page links back to lobby", async () => {
    const HowToPlay = (await import("@/app/how-to-play/page")).default;
    render(<HowToPlay />);
    expect(screen.getByRole("link", { name: /Play Multiplayer/i })).toHaveAttribute("href", "/lobby");
  });
});
