/**
 * UI-PLANT-001 — green plant decorations must not render for any shipped theme.
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { TABLE_THEMES, getTableThemeById, type TableTheme } from "@/lib/tableThemes";
import BackgroundProps from "@/components/game/BackgroundProps";

vi.mock("@/hooks/useTextureImage", () => ({
  useTextureImage: () => "loaded" as const,
}));

function plantImgs(container: HTMLElement) {
  return container.querySelectorAll('img[src*="plant-left"], img[src*="plant-right"]');
}

describe("UI-PLANT-001 plants disabled globally", () => {
  it("every shipped theme sets plants: false", () => {
    expect(TABLE_THEMES.length).toBeGreaterThan(0);
    for (const theme of TABLE_THEMES) {
      expect(theme.props.plants).toBe(false);
    }
  });

  it("BackgroundProps renders no plant assets for every shipped theme", () => {
    for (const theme of TABLE_THEMES) {
      const { container, unmount } = render(<BackgroundProps theme={theme} />);
      expect(plantImgs(container)).toHaveLength(0);
      unmount();
    }
  });

  it("default theme (classic-green) has no plants in DOM", () => {
    const theme = getTableThemeById("classic-green");
    const { container } = render(<BackgroundProps theme={theme} />);
    expect(plantImgs(container)).toHaveLength(0);
  });

  it("gate still works if a theme explicitly enables plants (regression harness)", () => {
    const base = getTableThemeById("classic-green");
    const withPlants: TableTheme = {
      ...base,
      props: { ...base.props, plants: true },
    };
    const { container } = render(<BackgroundProps theme={withPlants} />);
    expect(plantImgs(container)).toHaveLength(2);
  });

  it("unrelated background props still render when enabled (classic-green chandelier)", () => {
    const theme = getTableThemeById("classic-green");
    const { container } = render(<BackgroundProps theme={theme} />);
    expect(container.querySelector('img[src*="chandelier"]')).not.toBeNull();
    expect(plantImgs(container)).toHaveLength(0);
  });
});
