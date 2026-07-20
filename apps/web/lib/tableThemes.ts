export type TableThemeId = "classic-green" | "midnight-blue" | "royal-blue" | "woodland";

export type FloorType = "carpet" | "wood";

export interface TableThemeProps {
  /** Decorative corner plants — must stay false for all shipped themes (UI-PLANT-001). */
  plants: boolean;
  distantPeople?: boolean;
  extraTables?: boolean;
  barSilhouette?: boolean;
  chandelier?: boolean;
  wallSconces?: boolean;
  slotMachines?: boolean;
}

export interface TableTheme {
  id: TableThemeId;
  label: string;
  tableTextureUrl: string;
  railTextureUrl?: string;
  floorTextureUrl: string;
  floorType: FloorType;
  feltColor: string;
  feltColorDark: string;
  feltColorLight: string;
  railColor: string;
  railColorDark: string;
  glowColor?: string;
  wallColor: string;
  wallColorMid: string;
  floorSpotColor: string;
  floorFallback: string;
  props: TableThemeProps;
}

export const PROP_ASSETS = {
  plantLeft: "/assets/props/plant-left.svg",
  plantRight: "/assets/props/plant-right.svg",
  people: "/assets/props/people-silhouette.svg",
  peopleRight: "/assets/props/people-silhouette-right.svg",
  distantTableLeft: "/assets/props/distant-table-left.svg",
  distantTableRight: "/assets/props/distant-table-right.svg",
  bar: "/assets/props/bar-silhouette.svg",
  chandelier: "/assets/props/chandelier.svg",
  wallSconce: "/assets/props/wall-sconce.svg",
  slotMachine: "/assets/props/slot-machine.svg",
  neonSign: "/assets/props/neon-sign.svg",
} as const;

export const TABLE_THEMES: TableTheme[] = [
  {
    id: "classic-green",
    label: "Classic Green",
    tableTextureUrl: "/assets/tables/classic-green.svg",
    railTextureUrl: "/assets/tables/rail-brown.svg",
    floorTextureUrl: "/assets/floors/casino-carpet-warm.svg",
    floorType: "carpet",
    feltColor: "#145a28",
    feltColorDark: "#0a3d18",
    feltColorLight: "#1e7a38",
    railColor: "#6b4528",
    railColorDark: "#2a180c",
    glowColor: "rgba(212, 175, 55, 0.28)",
    wallColor: "#1a1228",
    wallColorMid: "#120c1a",
    floorSpotColor: "rgba(212, 175, 55, 0.14)",
    floorFallback:
      "linear-gradient(180deg, #1a1228 0%, #120c1a 35%, #2a1838 60%, #1a1028 100%)",
    props: {
      plants: false,
      distantPeople: true,
      extraTables: false,
      barSilhouette: true,
      chandelier: true,
      wallSconces: true,
      slotMachines: false,
    },
  },
  {
    id: "midnight-blue",
    label: "Midnight Blue",
    tableTextureUrl: "/assets/tables/midnight-blue.svg",
    railTextureUrl: "/assets/tables/rail-black.svg",
    floorTextureUrl: "/assets/floors/casino-carpet-dark.svg",
    floorType: "carpet",
    feltColor: "#0d2847",
    feltColorDark: "#061830",
    feltColorLight: "#1a4070",
    railColor: "#1a1a1a",
    railColorDark: "#0a0a0a",
    glowColor: "rgba(80, 140, 220, 0.22)",
    wallColor: "#0a0c18",
    wallColorMid: "#060810",
    floorSpotColor: "rgba(80, 120, 200, 0.12)",
    floorFallback:
      "linear-gradient(180deg, #0a0c18 0%, #060810 35%, #12101a 60%, #0a0810 100%)",
    props: {
      plants: false,
      distantPeople: true,
      extraTables: true,
      barSilhouette: true,
      chandelier: true,
      wallSconces: true,
      slotMachines: true,
    },
  },
  {
    id: "royal-blue",
    label: "Royal Blue",
    tableTextureUrl: "/assets/tables/royal-blue.svg",
    railTextureUrl: "/assets/tables/rail-black.svg",
    floorTextureUrl: "/assets/floors/casino-carpet-pattern.svg",
    floorType: "carpet",
    feltColor: "#1a4a8a",
    feltColorDark: "#0d3060",
    feltColorLight: "#2a6ab8",
    railColor: "#222222",
    railColorDark: "#111111",
    glowColor: "rgba(100, 160, 255, 0.25)",
    wallColor: "#0e1428",
    wallColorMid: "#0a0e1a",
    floorSpotColor: "rgba(100, 160, 255, 0.12)",
    floorFallback:
      "linear-gradient(180deg, #0e1428 0%, #0a0e1a 35%, #141828 60%, #0a0c14 100%)",
    props: {
      plants: false,
      distantPeople: false,
      extraTables: true,
      barSilhouette: false,
      chandelier: true,
      wallSconces: true,
      slotMachines: false,
    },
  },
  {
    id: "woodland",
    label: "Woodland",
    tableTextureUrl: "/assets/tables/woodland-green.svg",
    railTextureUrl: "/assets/tables/rail-dark-wood.svg",
    floorTextureUrl: "/assets/floors/wood-floor.svg",
    floorType: "wood",
    feltColor: "#1a5a30",
    feltColorDark: "#0d3a1c",
    feltColorLight: "#2a7a42",
    railColor: "#3d2814",
    railColorDark: "#1a0f08",
    glowColor: "rgba(180, 140, 80, 0.22)",
    wallColor: "#1a140e",
    wallColorMid: "#120e0a",
    floorSpotColor: "rgba(180, 140, 80, 0.12)",
    floorFallback:
      "linear-gradient(180deg, #1a140e 0%, #120e0a 35%, #2a1f14 60%, #1a120a 100%)",
    props: {
      plants: false,
      distantPeople: false,
      extraTables: false,
      barSilhouette: false,
      chandelier: false,
      wallSconces: true,
      slotMachines: false,
    },
  },
];

export const DEFAULT_TABLE_THEME_ID: TableThemeId = "classic-green";

export function getTableThemeById(id: TableThemeId): TableTheme {
  return TABLE_THEMES.find((t) => t.id === id) ?? TABLE_THEMES[0];
}
