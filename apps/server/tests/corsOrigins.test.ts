import { describe, expect, it } from "vitest";
import { createCorsOriginOption, parseCorsOrigins } from "../src/config/corsOrigins.js";

describe("parseCorsOrigins", () => {
  it("returns wildcard in development when unset", () => {
    expect(parseCorsOrigins(undefined, "development")).toBe("*");
  });

  it("returns empty list in production when unset", () => {
    expect(parseCorsOrigins(undefined, "production")).toEqual([]);
  });

  it("parses a single origin as a one-element allow-list", () => {
    expect(parseCorsOrigins("https://kouppi-web-nektarios-is-projects.vercel.app", "production")).toEqual([
      "https://kouppi-web-nektarios-is-projects.vercel.app",
    ]);
  });

  it("parses comma-separated origins", () => {
    expect(
      parseCorsOrigins(
        "https://kouppi-web-nektarios-is-projects.vercel.app,http://localhost:3000",
        "production"
      )
    ).toEqual(["https://kouppi-web-nektarios-is-projects.vercel.app", "http://localhost:3000"]);
  });

  it("trims whitespace and trailing slashes around origins", () => {
    expect(parseCorsOrigins("https://a.example.com/ , http://localhost:3000/", "production")).toEqual([
      "https://a.example.com",
      "http://localhost:3000",
    ]);
  });
});

describe("createCorsOriginOption", () => {
  it("allows only listed origins", () => {
    const option = createCorsOriginOption([
      "https://kouppi-web-nektarios-is-projects.vercel.app",
    ]);
    expect(typeof option).toBe("function");
    if (typeof option !== "function") return;
    let allowed: boolean | undefined;
    option("https://kouppi-web-nektarios-is-projects.vercel.app", (_err, ok) => {
      allowed = ok;
    });
    expect(allowed).toBe(true);
    option("https://kouppi-web.vercel.app", (_err, ok) => {
      allowed = ok;
    });
    expect(allowed).toBe(false);
  });
});
