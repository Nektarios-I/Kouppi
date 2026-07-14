"use client";

import { useMemo } from "react";
import { getTableThemeById } from "@/lib/tableThemes";
import { useUiThemeStore } from "@/store/uiThemeStore";

export function useTableTheme() {
  const selectedTableThemeId = useUiThemeStore((s) => s.selectedTableThemeId);
  const setTableThemeId = useUiThemeStore((s) => s.setTableThemeId);

  const theme = useMemo(
    () => getTableThemeById(selectedTableThemeId),
    [selectedTableThemeId]
  );

  return { theme, themeId: selectedTableThemeId, setTableThemeId };
}
