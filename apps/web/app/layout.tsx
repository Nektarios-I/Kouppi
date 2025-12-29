import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KOUPPI",
  description: "Fast, casual Cypriot card game playable on web and mobile.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
