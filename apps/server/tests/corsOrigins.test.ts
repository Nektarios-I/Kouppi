import { describe, expect, it } from "vitest";
import { parseCorsOrigins } from "../src/config/corsOrigins.js";

describe("parseCorsOrigins", () => {
  it("returns wildcard in development when unset", () => {
    expect(parseCorsOrigins(undefined, "development")).toBe("*");
  });

  it("returns empty list in production when unset", () => {
    expect(parseCorsOrigins(undefined, "production")).toEqual([]);
  });

  it("parses a single origin", () => {
    expect(parseCorsOrigins("https://kouppi-web-nektarios-is-projects.vercel.app", "production")).toBe(
      "https://kouppi-web-nektarios-is-projects.vercel.app"
    );
  });

  it("parses comma-separated origins", () => {
    expect(
      parseCorsOrigins(
        "https://kouppi-web-nektarios-is-projects.vercel.app,http://localhost:3000",
        "production"
      )
    ).toEqual(["https://kouppi-web-nektarios-is-projects.vercel.app", "http://localhost:3000"]);
  });

  it("trims whitespace around comma-separated origins", () => {
    expect(parseCorsOrigins("https://a.example.com , http://localhost:3000", "production")).toEqual([
      "https://a.example.com",
      "http://localhost:3000",
    ]);
  });
});
