/**
 * SHI-UI-001 / UI-PLANT-001 / AUTH-UX-001 focused checks.
 */
import { describe, expect, it } from "vitest";
import { canShistri, SHISTRI_DEFAULT_PERCENT } from "@kouppi/game-core";
import { TABLE_THEMES } from "@/lib/tableThemes";
import { ROOM_PRESETS } from "@/lib/roomPresets";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthModal from "@/components/AuthModal";

describe("SHI-UI-001 eligibility uses canShistri (abs diff === 2)", () => {
  it("accepts A+3 and rejects abs>=6 pairs that the old MP UI wrongly allowed", () => {
    expect(canShistri({ a: { rank: 1, suit: "S" }, b: { rank: 3, suit: "H" } })).toBe(true);
    expect(canShistri({ a: { rank: 2, suit: "S" }, b: { rank: 8, suit: "H" } })).toBe(false);
    expect(Math.abs(2 - 8)).toBeGreaterThanOrEqual(6);
  });
});

describe("SHI-PCT-001 default percent constant is 7", () => {
  it("room presets use SHISTRI_DEFAULT_PERCENT", () => {
    expect(SHISTRI_DEFAULT_PERCENT).toBe(7);
    for (const preset of ROOM_PRESETS) {
      expect(preset.config.shistri?.percent).toBe(7);
    }
  });
});

describe("UI-PLANT-001 plants disabled on all themes", () => {
  it("no theme enables plants", () => {
    for (const theme of TABLE_THEMES) {
      expect(theme.props.plants).toBe(false);
    }
  });
});

describe("AUTH-UX-001 password show/hide", () => {
  it("toggles password visibility without clearing the value", async () => {
    const user = userEvent.setup();
    render(<AuthModal isOpen onClose={() => {}} initialMode="login" />);

    const password = screen.getByPlaceholderText("Enter password") as HTMLInputElement;
    await user.type(password, "secret123");
    expect(password).toHaveAttribute("type", "password");
    expect(password.value).toBe("secret123");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password.value).toBe("secret123");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
    expect(password.value).toBe("secret123");
  });
});
