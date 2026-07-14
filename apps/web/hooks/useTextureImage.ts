"use client";

import { useEffect, useState } from "react";

export type TextureImageState = "loading" | "loaded" | "error";

/**
 * Preloads a texture URL. Returns "error" on 404 so callers can use CSS fallbacks.
 */
export function useTextureImage(url: string | undefined): TextureImageState {
  const [state, setState] = useState<TextureImageState>("loading");

  useEffect(() => {
    if (!url) {
      setState("error");
      return;
    }

    let cancelled = false;
    setState("loading");

    const img = new Image();
    img.onload = () => {
      if (!cancelled) setState("loaded");
    };
    img.onerror = () => {
      if (!cancelled) setState("error");
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
