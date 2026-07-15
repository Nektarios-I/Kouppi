import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("Sprint 4 legal pages", () => {
  it("privacy page renders policy summary", async () => {
    const Privacy = (await import("@/app/privacy/page")).default;
    render(<Privacy />);
    expect(screen.getByText(/Privacy Policy/i)).toBeInTheDocument();
    expect(screen.getByText(/do not sell personal data/i)).toBeInTheDocument();
  });

  it("terms page renders acceptable use rules", async () => {
    const Terms = (await import("@/app/terms/page")).default;
    render(<Terms />);
    expect(screen.getByText(/Terms of Service/i)).toBeInTheDocument();
    expect(screen.getByText(/harassment/i)).toBeInTheDocument();
  });
});
