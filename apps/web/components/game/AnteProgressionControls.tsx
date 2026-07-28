"use client";

import { useState } from "react";
import type { AnteProgressionConfig, AnteProgressionStrategy } from "@kouppi/game-core";
import { defaultAnteProgression, formatAnteProgressionSummary } from "@kouppi/game-core";

export type AnteProgressionFormState = AnteProgressionConfig;

const inputClass =
  "game-action-bet-input w-full text-gray-100 !bg-black/40 border-white/15 py-2";

export function buildAnteProgressionForm(
  startingAnte: number,
  partial?: Partial<AnteProgressionConfig>
): AnteProgressionFormState {
  return {
    ...defaultAnteProgression(startingAnte),
    ...partial,
    startingAnte: Math.max(1, Math.floor(partial?.startingAnte ?? startingAnte)),
  };
}

export function AnteProgressionControls({
  startingAnte,
  value,
  onChange,
  showAdvancedDefault = false,
}: {
  startingAnte: number;
  value: AnteProgressionFormState;
  onChange: (next: AnteProgressionFormState) => void;
  showAdvancedDefault?: boolean;
}) {
  const [advanced, setAdvanced] = useState(showAdvancedDefault);

  const applyPresetDouble5 = () => {
    onChange(buildAnteProgressionForm(startingAnte, { enabled: true }));
  };

  const applyFixed = () => {
    onChange(buildAnteProgressionForm(startingAnte, { enabled: false }));
  };

  return (
    <div className="space-y-3 font-ui">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            value.enabled &&
            value.strategy === "MULTIPLY" &&
            value.intervalRounds === 5 &&
            value.multiplier === 2
              ? "border-gold/50 bg-gold/10 text-gold-light"
              : "border-white/10 text-gray-400"
          }`}
          onClick={applyPresetDouble5}
        >
          Double every 5 rounds
        </button>
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            !value.enabled ? "border-gold/50 bg-gold/10 text-gold-light" : "border-white/10 text-gray-400"
          }`}
          onClick={applyFixed}
        >
          Fixed ante
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400"
          onClick={() => setAdvanced((v) => !v)}
        >
          {advanced ? "Hide advanced" : "Advanced"}
        </button>
      </div>
      <p className="text-xs text-gray-500">{formatAnteProgressionSummary({ ...value, startingAnte })}</p>

      {advanced && (
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              className="accent-gold"
              checked={value.enabled}
              onChange={(e) => onChange({ ...value, enabled: e.target.checked, startingAnte })}
            />
            Enable progression
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
            Interval (rounds)
            <input
              type="number"
              min={1}
              className={inputClass}
              value={value.intervalRounds}
              onChange={(e) =>
                onChange({
                  ...value,
                  intervalRounds: Math.max(1, Number(e.target.value || 1)),
                  startingAnte,
                })
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
            Strategy
            <select
              className={inputClass}
              value={value.strategy}
              onChange={(e) =>
                onChange({
                  ...value,
                  strategy: e.target.value as AnteProgressionStrategy,
                  startingAnte,
                })
              }
            >
              <option value="MULTIPLY">Multiply</option>
              <option value="ADD">Add</option>
            </select>
          </label>
          {value.strategy === "MULTIPLY" ? (
            <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
              Multiplier
              <input
                type="number"
                min={1}
                className={inputClass}
                value={value.multiplier}
                onChange={(e) =>
                  onChange({
                    ...value,
                    multiplier: Math.max(1, Number(e.target.value || 1)),
                    startingAnte,
                  })
                }
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
              Increment
              <input
                type="number"
                min={0}
                className={inputClass}
                value={value.incrementAmount ?? 0}
                onChange={(e) =>
                  onChange({
                    ...value,
                    incrementAmount: Math.max(0, Number(e.target.value || 0)),
                    startingAnte,
                  })
                }
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
            Max ante (optional)
            <input
              type="number"
              min={0}
              className={inputClass}
              value={value.maxAnte ?? ""}
              placeholder="None"
              onChange={(e) => {
                const raw = e.target.value;
                onChange({
                  ...value,
                  maxAnte: raw === "" ? null : Math.max(1, Number(raw)),
                  startingAnte,
                });
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
