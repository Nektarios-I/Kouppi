import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Oswald, Inter } from "next/font/google";
import Providers from "@/components/Providers";

const fontDisplay = Oswald({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const fontUi = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kouppi-web.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060612",
};

export const metadata: Metadata = {
  title: "KOUPPI",
  description: "Fast, casual Cypriot card game playable on web and mobile.",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    title: "KOUPPI",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
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
    <html lang="en" className={`${fontDisplay.variable} ${fontUi.variable}`}>
      <body className="font-ui antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
