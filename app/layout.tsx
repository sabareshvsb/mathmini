import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell";

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
  themeColor: "#f6f9ff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
