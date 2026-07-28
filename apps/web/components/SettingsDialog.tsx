"use client";
import { useState, type ReactNode } from "react";
import TableThemeSelector from "@/components/game/TableThemeSelector";
import { HudButton } from "@/components/game/HudButton";
import InfoTooltip from "@/components/game/InfoTooltip";
import {
  AnteProgressionControls,
  buildAnteProgressionForm,
} from "@/components/game/AnteProgressionControls";

export type TableSettings = {
  numberBots: number;
  botMode: "deterministic" | "stochastic";
  botDifficulty: "easy" | "normal" | "hard";
  startingBankroll: number;
  ante: number;
  shistri: boolean;
  deckCount: 1 | 3 | 5 | 7 | 9;
  shufflePolicy: "RESET_EACH_ROUND" | "CONTINUOUS_SHOE";
  anteProgression?: import("@kouppi/game-core").AnteProgressionConfig;
};

const inputClass =
  "game-action-bet-input w-full text-gray-100 !bg-black/40 border-white/15 py-2";

function fieldLabel(title: string, help: ReactNode) {
  return (
    <>
      <span>{title}</span>
      <InfoTooltip label={`What ${title} means`}>{help}</InfoTooltip>
    </>
  );
}

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
    deckCount: initial?.deckCount ?? 1,
    shufflePolicy: initial?.shufflePolicy ?? "RESET_EACH_ROUND",
    anteProgression:
      initial?.anteProgression ?? buildAnteProgressionForm(initial?.ante ?? 10),
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
            <span className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
              {fieldLabel(
                "Bots",
                "Choose how many computer players will join your table. More bots means a busier game."
              )}
            </span>
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
            <span className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
              {fieldLabel(
                "Bot mode",
                <>
                  <p><strong>Deterministic:</strong> bots play in a more consistent way.</p>
                  <p><strong>Stochastic:</strong> bots mix things up more, so their choices can vary from game to game.</p>
                </>
              )}
            </span>
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
            <span className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
              {fieldLabel(
                "Difficulty",
                <>
                  <p><strong>Easy:</strong> safer, simpler bot play.</p>
                  <p><strong>Normal:</strong> balanced bot decisions.</p>
                  <p><strong>Hard:</strong> stronger, more confident bot play.</p>
                </>
              )}
            </span>
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
            <span className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
              {fieldLabel(
                "Bankroll",
                "This is how many chips each player starts with at the table."
              )}
            </span>
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
            <span className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
              {fieldLabel(
                "Ante",
                "The ante is the starting amount each player puts into the pot at the start of a round."
              )}
            </span>
            <input
              type="number"
              className={inputClass}
              min={1}
              value={settings.ante}
              onChange={(e) => {
                const ante = Math.max(1, Number(e.target.value || 1));
                setSettings((s) => ({
                  ...s,
                  ante,
                  anteProgression: {
                    ...(s.anteProgression ?? buildAnteProgressionForm(ante)),
                    startingAnte: ante,
                  },
                }));
              }}
            />
          </label>

          <div className="md:col-span-2">
            <span className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
              {fieldLabel(
                "Ante progression",
                "This controls whether the ante stays the same or increases as the game goes on."
              )}
            </span>
            <div className="mt-2">
              <AnteProgressionControls
                startingAnte={settings.ante}
                value={settings.anteProgression ?? buildAnteProgressionForm(settings.ante)}
                onChange={(anteProgression) => setSettings((s) => ({ ...s, anteProgression }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 mt-2 md:mt-6 text-sm text-gray-300">
            <input
              type="checkbox"
              className="accent-gold"
              checked={settings.shistri}
              onChange={(e) => setSettings((s) => ({ ...s, shistri: e.target.checked }))}
            />
            Enable SHISTRI
            <InfoTooltip label="What SHISTRI means">
              A special side bet that is only available in certain card situations.
            </InfoTooltip>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
              {fieldLabel(
                "Number of Decks",
                "Choose how many full decks are mixed together in the shoe. More decks means a larger card pool."
              )}
            </span>
            <select
              className={inputClass}
              value={settings.deckCount}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  deckCount: Number(e.target.value) as TableSettings["deckCount"],
                }))
              }
            >
              {[1, 3, 5, 7, 9].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">Choose how many full decks are combined into the shoe.</span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
              {fieldLabel(
                "Deck Handling",
                "Choose whether cards come back every round or stay out until the shoe is reshuffled."
              )}
            </span>
            <label className="flex items-start gap-2 text-sm text-gray-300">
              <input
                type="radio"
                name="sp-shuffle-policy"
                className="mt-1 accent-gold"
                checked={settings.shufflePolicy === "RESET_EACH_ROUND"}
                onChange={() => setSettings((s) => ({ ...s, shufflePolicy: "RESET_EACH_ROUND" }))}
              />
              <span>
                <span className="flex items-center gap-2">
                  <span className="block">Fresh Deck Every Round</span>
                  <InfoTooltip label="About Fresh Deck Every Round">
                    All cards return to the shoe and are shuffled before each new round.
                  </InfoTooltip>
                </span>
                <span className="text-xs text-gray-500">
                  All cards return to the shoe and are shuffled before each new round.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-300">
              <input
                type="radio"
                name="sp-shuffle-policy"
                className="mt-1 accent-gold"
                checked={settings.shufflePolicy === "CONTINUOUS_SHOE"}
                onChange={() => setSettings((s) => ({ ...s, shufflePolicy: "CONTINUOUS_SHOE" }))}
              />
              <span>
                <span className="flex items-center gap-2">
                  <span className="block">Continuous Shoe</span>
                  <InfoTooltip label="About Continuous Shoe">
                    Played cards stay out until the shoe needs reshuffling.
                  </InfoTooltip>
                </span>
                <span className="text-xs text-gray-500">
                  Played cards stay out until the shoe needs reshuffling.
                </span>
              </span>
            </label>
          </div>

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
