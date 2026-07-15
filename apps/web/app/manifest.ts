import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KOUPPI",
    short_name: "KOUPPI",
    description: "Fast, casual Cypriot card game — play with friends online.",
    start_url: "/lobby",
    display: "standalone",
    background_color: "#060612",
    theme_color: "#060612",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/kouppi-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/kouppi-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
