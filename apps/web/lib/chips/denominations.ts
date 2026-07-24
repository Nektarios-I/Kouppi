/**
 * Official KOUPPI visual chip denomination standard.
 * Numeric values are game chip units (integer `Chips` from game-core), not real-money currency.
 * Single source of truth for value, color tokens, labels, and aria names.
 */

export const KOUPPI_CHIP_DENOMINATION_KEYS = [
  "maroon",
  "purple",
  "black",
  "green",
  "blue",
  "red",
  "ivory",
] as const;

export type ChipDenominationKey = (typeof KOUPPI_CHIP_DENOMINATION_KEYS)[number];

export type ChipDenomination = {
  value: number;
  key: ChipDenominationKey;
  label: string;
  ariaLabel: string;
  fill: string;
  edge: string;
  stripe: string;
  text: string;
};

/** Highest → lowest. Harmonized with KOUPPI blue/black casino table aesthetic. */
export const KOUPPI_CHIP_DENOMINATIONS: readonly ChipDenomination[] = [
  {
    value: 1000,
    key: "maroon",
    label: "1K",
    ariaLabel: "one thousand chip",
    fill: "#6E1E2B",
    edge: "#3D1017",
    stripe: "#E8C6CC",
    text: "#FFF7F2",
  },
  {
    value: 500,
    key: "purple",
    label: "500",
    ariaLabel: "five hundred chip",
    fill: "#5B2A86",
    edge: "#32164D",
    stripe: "#DEC7F5",
    text: "#FFF9FF",
  },
  {
    value: 100,
    key: "black",
    label: "100",
    ariaLabel: "one hundred chip",
    fill: "#20242B",
    edge: "#090B0E",
    stripe: "#D3DAE3",
    text: "#FFFFFF",
  },
  {
    value: 25,
    key: "green",
    label: "25",
    ariaLabel: "twenty-five chip",
    fill: "#14734A",
    edge: "#093D29",
    stripe: "#BDE7CC",
    text: "#F5FFF8",
  },
  {
    value: 10,
    key: "blue",
    label: "10",
    ariaLabel: "ten chip",
    fill: "#1C5FA8",
    edge: "#0B315D",
    stripe: "#BEDCFF",
    text: "#F4FAFF",
  },
  {
    value: 5,
    key: "red",
    label: "5",
    ariaLabel: "five chip",
    fill: "#B92D3A",
    edge: "#67121A",
    stripe: "#FFD0D5",
    text: "#FFF7F8",
  },
  {
    value: 1,
    key: "ivory",
    label: "1",
    ariaLabel: "one chip",
    fill: "#E8DDC6",
    edge: "#A99B80",
    stripe: "#5D5342",
    text: "#201C17",
  },
] as const;

export function getChipDenominationByKey(
  key: ChipDenominationKey
): ChipDenomination | undefined {
  return KOUPPI_CHIP_DENOMINATIONS.find((d) => d.key === key);
}

export function getChipDenominationByValue(
  value: number
): ChipDenomination | undefined {
  return KOUPPI_CHIP_DENOMINATIONS.find((d) => d.value === value);
}
