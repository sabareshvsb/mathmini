import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Bengaluru · Smart Traffic Management",
    template: "%s · Bengaluru",
  },
  description:
    "Smart City Intelligent Traffic Management System using Graph Theory for Bengaluru — interactive simulation, Dijkstra/A* routing, adaptive signals and analytics.",
  keywords: [
    "Bengaluru",
    "Bangalore",
    "smart city",
    "traffic management",
    "graph theory",
    "Dijkstra",
    "A*",
    "minimum spanning tree",
    "traffic simulation",
  ],
  applicationName: "Bengaluru Traffic Control",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#f8fafc",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
