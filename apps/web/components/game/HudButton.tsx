"use client";

import React from "react";

type HudButtonVariant = "pass" | "bet" | "kouppi" | "shistri" | "primary" | "success" | "danger" | "ghost";

const VARIANT_CLASS: Record<HudButtonVariant, string> = {
  pass: "hud-btn hud-btn-pass",
  bet: "hud-btn hud-btn-bet",
  kouppi: "hud-btn hud-btn-kouppi",
  shistri: "hud-btn hud-btn-shistri",
  primary: "hud-btn hud-btn-primary",
  success: "hud-btn hud-btn-success",
  danger: "hud-btn hud-btn-danger",
  ghost: "hud-btn hud-btn-ghost",
};

export interface HudButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: HudButtonVariant;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function HudButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  ...props
}: HudButtonProps) {
  const sizeClass = size === "sm" ? "hud-btn-sm" : size === "lg" ? "hud-btn-lg" : "";
  return (
    <button
      type="button"
      className={`${VARIANT_CLASS[variant]} ${sizeClass} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function HudIconButton({
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`hud-icon-btn ${className}`} {...props}>
      {children}
    </button>
  );
}
