"use client";
import { useState } from "react";
import TableThemeSelector from "@/components/game/TableThemeSelector";
import { HudButton } from "@/components/game/HudButton";

export type TableSettings = {
  numberBots: number;
  botMode: "deterministic" | "stochastic";
  botDifficulty: "easy" | "normal" | "hard";
  startingBankroll: number;
  ante: number;
  shistri: boolean;
};

const inputClass =
  "game-action-bet-input w-full text-gray-100 !bg-black/40 border-white/15 py-2";

export default function SettingsDialog({
  open,
  initial,
  onStart,
}: {
  open: boolean;
  initial?: Partial<TableSettings>;
  onStart: (s: TableSettings) => void;
}) {
  const [settings, setSettings] = useState<TableSettings>({
    numberBots: initial?.numberBots ?? 1,
    botMode: initial?.botMode ?? "deterministic",
    botDifficulty: initial?.botDifficulty ?? "normal",
    startingBankroll: initial?.startingBankroll ?? 100,
    ante: initial?.ante ?? 10,
    shistri: initial?.shistri ?? true,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm grid place-items-center z-50 p-4">
      <div className="game-modal-panel w-full max-w-xl" role="dialog" aria-modal="true">
        <div className="game-modal-header !mb-4 !pb-3">
          <h2 className="font-display text-2xl font-bold text-gold-light tracking-wide">
            Table Settings
          </h2>
          <p className="text-gray-400 text-sm font-ui mt-1">Configure your single-player game</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 font-ui">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Bots</span>
            <input
              type="number"
              className={inputClass}
              min={0}
              max={7}
              value={settings.numberBots}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  numberBots: Math.max(0, Math.min(7, Number(e.target.value || 0))),
                }))
              }
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Bot mode</span>
            <select
              className={inputClass}
              value={settings.botMode}
              onChange={(e) =>
                setSettings((s) => ({ ...s, botMode: e.target.value as TableSettings["botMode"] }))
              }
            >
              <option value="deterministic">Deterministic</option>
              <option value="stochastic">Stochastic</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Difficulty</span>
            <select
              className={inputClass}
              value={settings.botDifficulty}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  botDifficulty: e.target.value as TableSettings["botDifficulty"],
                }))
              }
            >
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Bankroll</span>
            <input
              type="number"
              className={inputClass}
              min={1}
              value={settings.startingBankroll}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  startingBankroll: Math.max(1, Number(e.target.value || 1)),
                }))
              }
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Ante</span>
            <input
              type="number"
              className={inputClass}
              min={1}
              value={settings.ante}
              onChange={(e) =>
                setSettings((s) => ({ ...s, ante: Math.max(1, Number(e.target.value || 1)) }))
              }
            />
          </label>

          <label className="flex items-center gap-2 mt-2 md:mt-6 text-sm text-gray-300">
            <input
              type="checkbox"
              className="accent-gold"
              checked={settings.shistri}
              onChange={(e) => setSettings((s) => ({ ...s, shistri: e.target.checked }))}
            />
            Enable SHISTRI
          </label>

          <TableThemeSelector id="settings-table-theme" />
        </div>

        <div className="mt-6 flex justify-end">
          <HudButton variant="primary" size="lg" onClick={() => onStart(settings)}>
            Start Game
          </HudButton>
        </div>
      </div>
    </div>
  );
}
