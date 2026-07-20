"use client";

import type { TableTheme } from "@/lib/tableThemes";
import { PROP_ASSETS } from "@/lib/tableThemes";
import { useTextureImage } from "@/hooks/useTextureImage";

type Depth = "far" | "mid" | "near";

interface PropImageProps {
  src: string;
  alt: string;
  depth?: Depth;
  className?: string;
  style?: React.CSSProperties;
}

const DEPTH_STYLES: Record<Depth, string> = {
  far: "opacity-[0.15] blur-[3px] saturate-50",
  mid: "opacity-[0.28] blur-[1.5px] saturate-75",
  near: "opacity-70 drop-shadow-xl",
};

function PropImage({ src, alt, depth = "mid", className = "", style }: PropImageProps) {
  const state = useTextureImage(src);
  if (state !== "loaded") return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`absolute pointer-events-none select-none ${DEPTH_STYLES[depth]} ${className}`}
      style={style}
      draggable={false}
    />
  );
}

interface BackgroundPropsProps {
  theme: TableTheme;
}

/**
 * Layered ambient casino props — depth, blur, and theme toggles.
 */
export default function BackgroundProps({ theme }: BackgroundPropsProps) {
  const { props } = theme;

  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden" aria-hidden="true">
      {/* ── Ceiling / far background ── */}
      {props.chandelier && (
        <PropImage
          src={PROP_ASSETS.chandelier}
          alt=""
          depth="mid"
          className="left-1/2 -translate-x-1/2 top-[1%] w-[min(40vw,280px)]"
        />
      )}

      {props.wallSconces && (
        <>
          <PropImage
            src={PROP_ASSETS.wallSconce}
            alt=""
            depth="mid"
            className="left-[3%] top-[22%] w-[min(8vw,50px)]"
          />
          <PropImage
            src={PROP_ASSETS.wallSconce}
            alt=""
            depth="mid"
            className="right-[3%] top-[22%] w-[min(8vw,50px)] scale-x-[-1]"
          />
          <PropImage
            src={PROP_ASSETS.wallSconce}
            alt=""
            depth="far"
            className="left-[12%] top-[28%] w-[min(5vw,36px)] opacity-[0.12]"
          />
          <PropImage
            src={PROP_ASSETS.wallSconce}
            alt=""
            depth="far"
            className="right-[12%] top-[28%] w-[min(5vw,36px)] scale-x-[-1] opacity-[0.12]"
          />
        </>
      )}

      {/* Neon / signage */}
      {theme.id === "royal-blue" && (
        <PropImage
          src={PROP_ASSETS.neonSign}
          alt=""
          depth="mid"
          className="left-1/2 -translate-x-1/2 top-[8%] w-[min(32vw,180px)] opacity-50"
        />
      )}

      {/* ── Mid-distance activity ── */}
      {props.distantPeople && (
        <>
          <PropImage
            src={PROP_ASSETS.people}
            alt=""
            depth="far"
            className="left-[5%] top-[20%] w-[min(30vw,220px)]"
          />
          <PropImage
            src={PROP_ASSETS.peopleRight}
            alt=""
            depth="far"
            className="right-[4%] top-[18%] w-[min(26vw,200px)]"
          />
        </>
      )}

      {props.extraTables && (
        <>
          <PropImage
            src={PROP_ASSETS.distantTableLeft}
            alt=""
            depth="far"
            className="left-[2%] top-[24%] w-[min(24vw,180px)]"
          />
          <PropImage
            src={PROP_ASSETS.distantTableRight}
            alt=""
            depth="far"
            className="right-[3%] top-[22%] w-[min(22vw,160px)]"
          />
          <PropImage
            src={PROP_ASSETS.distantTableLeft}
            alt=""
            depth="far"
            className="left-[18%] top-[16%] w-[min(14vw,100px)] opacity-[0.1] blur-[4px]"
          />
        </>
      )}

      {props.slotMachines && (
        <>
          <PropImage
            src={PROP_ASSETS.slotMachine}
            alt=""
            depth="mid"
            className="left-[6%] bottom-[28%] w-[min(12vw,80px)]"
          />
          <PropImage
            src={PROP_ASSETS.slotMachine}
            alt=""
            depth="far"
            className="right-[8%] bottom-[32%] w-[min(10vw,70px)] opacity-20 blur-[2px]"
          />
        </>
      )}

      {props.barSilhouette && (
        <PropImage
          src={PROP_ASSETS.bar}
          alt=""
          depth="mid"
          className="right-[2%] bottom-[18%] w-[min(38vw,300px)]"
        />
      )}

      {/* ── Foreground floor-edge props (UI-PLANT-001: shipped themes keep plants === false) ── */}
      {props.plants === true && (
        <>
          <PropImage
            src={PROP_ASSETS.plantLeft}
            alt=""
            depth="near"
            className="left-[1%] bottom-[4%] w-[min(20vw,130px)]"
          />
          <PropImage
            src={PROP_ASSETS.plantRight}
            alt=""
            depth="near"
            className="right-[2%] bottom-[5%] w-[min(18vw,115px)]"
          />
        </>
      )}

      {/* Atmospheric haze between props and table */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 55%, transparent 25%, rgba(0,0,0,0.25) 100%)",
        }}
      />
    </div>
  );
}
