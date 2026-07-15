"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { HudButton } from "./HudButton";

const CONDUCT_KEY = "kouppi_conduct_accepted_v1";

export function hasAcceptedConduct(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(CONDUCT_KEY) === "1";
}

export function acceptConduct(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CONDUCT_KEY, "1");
}

export default function ConductGate({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAccepted(hasAcceptedConduct());
  }, []);

  if (!mounted || accepted) return <>{children}</>;

  return (
    <>
      {children}
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
        <div
          className="max-w-lg w-full rounded-2xl border border-gold/30 bg-bg-casino-mid p-6 shadow-2xl"
          role="dialog"
          aria-labelledby="conduct-title"
        >
          <h2 id="conduct-title" className="font-display text-xl text-gold-light mb-3">
            Community Guidelines
          </h2>
          <p className="text-sm text-gray-300 font-ui mb-4">
            KOUPPI is for friendly play. By continuing you agree to:
          </p>
          <ul className="text-sm text-gray-400 font-ui space-y-2 mb-5 list-disc pl-5">
            <li>Be respectful in chat and player names</li>
            <li>No harassment, hate speech, spam, or phishing links</li>
            <li>Report disruptive players instead of escalating</li>
            <li>Follow our full rules in the Terms of Service</li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-3">
            <HudButton
              variant="success"
              fullWidth
              onClick={() => {
                acceptConduct();
                setAccepted(true);
              }}
            >
              I Agree — Let&apos;s Play
            </HudButton>
            <Link href="/terms" className="text-center text-sm text-gold-light hover:underline font-ui py-2">
              Read full Terms
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
