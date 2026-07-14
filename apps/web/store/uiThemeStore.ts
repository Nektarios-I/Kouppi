"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TableThemeId } from "@/lib/tableThemes";
import { DEFAULT_TABLE_THEME_ID } from "@/lib/tableThemes";

interface UiThemeStore {
  selectedTableThemeId: TableThemeId;
  setTableThemeId: (id: TableThemeId) => void;
}

export const useUiThemeStore = create<UiThemeStore>()(
  persist(
    (set) => ({
      selectedTableThemeId: DEFAULT_TABLE_THEME_ID,
      setTableThemeId: (id) => set({ selectedTableThemeId: id }),
    }),
    { name: "kouppi-ui-theme" }
  )
);
