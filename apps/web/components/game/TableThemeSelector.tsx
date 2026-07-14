"use client";

import { TABLE_THEMES, type TableThemeId } from "@/lib/tableThemes";
import { useTableTheme } from "@/hooks/useTableTheme";

interface TableThemeSelectorProps {
  className?: string;
  compact?: boolean;
  id?: string;
}

export default function TableThemeSelector({
  className = "",
  compact = false,
  id = "table-theme-select",
}: TableThemeSelectorProps) {
  const { themeId, setTableThemeId } = useTableTheme();

  return (
    <label className={`flex flex-col gap-1 font-ui ${className}`} htmlFor={id}>
      <span className={`opacity-80 ${compact ? "text-xs" : "text-sm"}`}>Table style</span>
      <select
        id={id}
        className={`text-black rounded px-2 py-1 bg-white/90 border border-gold/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
          compact ? "text-xs py-0.5" : ""
        }`}
        value={themeId}
        onChange={(e) => setTableThemeId(e.target.value as TableThemeId)}
        aria-label="Select table visual theme"
      >
        {TABLE_THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
