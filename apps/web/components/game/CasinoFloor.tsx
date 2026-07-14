"use client";

import type { TableTheme } from "@/lib/tableThemes";
import { useTextureImage } from "@/hooks/useTextureImage";

interface CasinoFloorProps {
  theme: TableTheme;
}

export default function CasinoFloor({ theme }: CasinoFloorProps) {
  const floorState = useTextureImage(theme.floorTextureUrl);
  const floorReady = floorState === "loaded";

  const tileSize = theme.floorType === "wood" ? "200px 66px" : "180px 180px";
  const floorPlaneStyle: React.CSSProperties = floorReady
    ? {
        backgroundImage: `url(${theme.floorTextureUrl})`,
        backgroundSize: tileSize,
        backgroundRepeat: "repeat",
      }
    : { background: theme.floorFallback };

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      {/* Wall zone with wainscoting */}
      <div
        className="absolute inset-x-0 top-0 h-[42%]"
        style={{
          background: `linear-gradient(180deg, ${theme.wallColor} 0%, ${theme.wallColorMid} 55%, transparent 100%)`,
        }}
      />
      <div
        className="absolute inset-x-0 top-[28%] h-[14%] casino-wainscoting opacity-40"
        style={{ borderColor: `${theme.railColor}40` }}
      />
      <div className="absolute inset-x-0 top-0 h-[38%] casino-wall-panels opacity-25" />

      {/* Crown molding */}
      <div className="absolute inset-x-0 top-0 h-1.5 casino-crown-molding" />

      {/* Chair rail */}
      <div
        className="absolute inset-x-0 top-[30%] h-1 opacity-30"
        style={{ background: `linear-gradient(90deg, transparent, ${theme.railColor}, transparent)` }}
      />

      {/* Horizon haze */}
      <div
        className="absolute inset-x-0 top-[34%] h-[10%]"
        style={{
          background: `linear-gradient(180deg, ${theme.wallColorMid}ee 0%, transparent 100%)`,
        }}
      />

      {/* Perspective floor */}
      <div className="casino-floor-perspective absolute inset-x-0 bottom-0 h-[64%]">
        <div className="casino-floor-plane" style={floorPlaneStyle}>
          <div className="absolute inset-0 casino-floor-wear" />
          <div
            className="absolute left-1/2 top-[6%] -translate-x-1/2 w-[75%] h-[48%] rounded-[50%]"
            style={{
              background: `radial-gradient(ellipse at center, ${theme.floorSpotColor} 0%, transparent 72%)`,
            }}
          />
          <div
            className="absolute left-1/2 top-[12%] -translate-x-1/2 w-[95%] h-[58%] rounded-[50%]"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 68%)",
            }}
          />
          {/* Floor reflection streaks (wood) */}
          {theme.floorType === "wood" && (
            <div className="absolute inset-0 casino-floor-reflection opacity-30" />
          )}
        </div>

        {/* Baseboard */}
        <div
          className="absolute inset-x-0 top-0 h-4 z-10"
          style={{
            background: `linear-gradient(180deg, ${theme.railColorDark} 0%, ${theme.railColor} 45%, ${theme.railColorDark} 100%)`,
            boxShadow: "0 3px 12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        />

        <div className="absolute inset-x-0 bottom-0 h-20 casino-floor-edge-shadow" />
      </div>

      <div className="absolute inset-0 casino-room-vignette" />
      <div className="absolute inset-0 casino-room-spotlight" />
      <div className="absolute inset-0 casino-room-bokeh">
        <span className="casino-bokeh casino-bokeh-1" />
        <span className="casino-bokeh casino-bokeh-2" />
        <span className="casino-bokeh casino-bokeh-3" />
      </div>
      <div className="absolute inset-0 casino-room-grain opacity-[0.035]" />
    </div>
  );
}
