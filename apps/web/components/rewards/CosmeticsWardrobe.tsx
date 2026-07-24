"use client";

import { LobbyCard } from "@/components/game/LobbyUI";
import { HudButton } from "@/components/game/HudButton";
import type { RewardPublicState } from "@/store/rewardStore";
import { getBadgeLabel, getTitleLabel } from "@/lib/cosmetics";

const SLOT_LABELS: Record<string, string> = {
  title: "Title",
  badge: "Badge",
  frame: "Avatar frame",
  card_back: "Card back",
  table_theme: "Table theme",
  seat_ring: "Seat ring",
  chip_skin: "Chip skin",
  emote: "Emotes",
};

export function CosmeticsWardrobe({
  state,
  isActing,
  onEquip,
}: {
  state: RewardPublicState;
  isActing: boolean;
  onEquip: (slot: string, cosmeticId: string | null) => void;
}) {
  const slots = ["title", "badge", "frame", "card_back", "table_theme", "seat_ring", "chip_skin"] as const;
  const equippedMap: Record<string, string | null> = {
    title: state.equipped.titleId,
    badge: state.equipped.badgeId,
    frame: state.equipped.frameId,
    card_back: state.equipped.cardBackId,
    table_theme: state.equipped.tableThemeId,
    seat_ring: state.equipped.seatRingId,
    chip_skin: state.equipped.chipSkinId,
  };

  return (
    <LobbyCard title="Wardrobe" icon="◇">
      <p className="text-xs text-gray-500 font-ui mb-3">
        Equip unlocked cosmetics. Table themes and card backs apply immediately in play.
      </p>
      <div className="mb-4 rounded-md border border-white/10 bg-black/20 px-3 py-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 font-ui uppercase tracking-wide">Preview</span>
        {state.equipped.titleId && (
          <span className="text-xs font-ui text-gold-light">{getTitleLabel(state.equipped.titleId)}</span>
        )}
        {state.equipped.badgeId && (
          <span className="text-[10px] font-ui uppercase tracking-wide px-1.5 py-0.5 rounded border border-gold/40 text-gold">
            {getBadgeLabel(state.equipped.badgeId)}
          </span>
        )}
        {!state.equipped.titleId && !state.equipped.badgeId && (
          <span className="text-xs text-gray-500 font-ui">No title / badge equipped</span>
        )}
      </div>
      <div className="space-y-4">
        {slots.map((slot) => {
          const items = state.cosmeticsCatalog.filter((c) => c.slot === slot);
          const equippedId = equippedMap[slot];
          return (
            <div key={slot}>
              <div className="text-xs uppercase tracking-wide text-gray-500 font-ui mb-2">
                {SLOT_LABELS[slot] ?? slot}
              </div>
              <div className="flex flex-wrap gap-2">
                {(slot === "title" || slot === "badge") && (
                  <HudButton
                    variant="ghost"
                    size="sm"
                    disabled={isActing || !equippedId}
                    onClick={() => onEquip(slot, null)}
                  >
                    None
                  </HudButton>
                )}
                {items.map((item) => {
                  const active = equippedId === item.id;
                  return (
                    <HudButton
                      key={item.id}
                      variant={active ? "kouppi" : "ghost"}
                      size="sm"
                      disabled={isActing || !item.owned}
                      onClick={() => onEquip(slot, item.id)}
                      title={item.owned ? item.label : `${item.label} (locked)`}
                    >
                      {item.owned ? item.label : `🔒 ${item.label}`}
                    </HudButton>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 font-ui mb-2">Emotes</div>
          <div className="flex flex-wrap gap-2 text-lg">
            {state.cosmeticsCatalog
              .filter((c) => c.slot === "emote")
              .map((e) => (
                <span
                  key={e.id}
                  className={`px-2 py-1 rounded border text-sm font-ui ${
                    e.owned ? "border-gold/40 bg-gold/10" : "border-white/10 text-gray-600 opacity-50"
                  }`}
                  title={e.label}
                >
                  {e.emoteGlyph ?? "?"} {e.owned ? "" : "🔒"}
                </span>
              ))}
          </div>
        </div>
      </div>
    </LobbyCard>
  );
}
