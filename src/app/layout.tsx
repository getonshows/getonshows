import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SwRegister from "@/components/SwRegister";
import SourceCapture from "@/components/SourceCapture";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GetOnShows — Get booked. Find guests.",
  description:
    "GetOnShows matches podcast hosts with relevant guests: ranked fits, respectful pitches, booked off-platform.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GetOnShows",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f2740",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-paper text-slate-900`}>
        <SwRegister />
        <SourceCapture />
        {children}
      </body>
    </html>
  );
}
