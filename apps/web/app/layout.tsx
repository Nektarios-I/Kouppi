import "./globals.css";
import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kouppi-web.vercel.app";

export const metadata: Metadata = {
  title: "KOUPPI",
  description: "Fast, casual Cypriot card game playable on web and mobile.",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "KOUPPI",
    description: "Fast, casual Cypriot card game playable on web and mobile.",
    url: siteUrl,
    siteName: "KOUPPI",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
