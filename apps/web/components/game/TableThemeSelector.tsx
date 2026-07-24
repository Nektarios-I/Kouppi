"use client";

import { TABLE_THEMES, type TableThemeId } from "@/lib/tableThemes";
import { useTableTheme } from "@/hooks/useTableTheme";
import { useRewardStore } from "@/store/rewardStore";
import { useAuthStore } from "@/store/authStore";

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
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn());
  const catalog = useRewardStore((s) => s.state?.cosmeticsCatalog);
  const equipCosmetic = useRewardStore((s) => s.equipCosmetic);

  const ownedThemeIds = new Set(
    (catalog ?? [])
      .filter((c) => c.slot === "table_theme" && c.owned)
      .map((c) => c.tableThemeId ?? c.id)
  );

  // Guests keep full local picker; logged-in players need ownership
  const options = TABLE_THEMES.map((t) => ({
    ...t,
    locked: isLoggedIn && catalog != null && !ownedThemeIds.has(t.id) && t.id !== "classic-green",
  }));

  return (
    <label className={`flex flex-col gap-1 font-ui ${className}`} htmlFor={id}>
      <span className={`opacity-80 ${compact ? "text-xs" : "text-sm"}`}>Table style</span>
      <select
        id={id}
        className={`text-black rounded px-2 py-1 bg-white/90 border border-gold/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
          compact ? "text-xs py-0.5" : ""
        }`}
        value={themeId}
        onChange={(e) => {
          const next = e.target.value as TableThemeId;
          setTableThemeId(next);
          if (isLoggedIn) {
            void equipCosmetic("table_theme", next);
          }
        }}
        aria-label="Select table visual theme"
      >
        {options.map((t) => (
          <option key={t.id} value={t.id} disabled={t.locked}>
            {t.locked ? `${t.label} (locked)` : t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
