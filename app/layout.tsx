import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell";

export const metadata: Metadata = {
  title: {
    default: "Nova City · Smart Traffic Management",
    template: "%s · Nova City",
  },
  description:
    "Smart City Intelligent Traffic Management System using Graph Theory — interactive simulation, Dijkstra/A* routing, adaptive signals and analytics.",
  keywords: [
    "smart city",
    "traffic management",
    "graph theory",
    "Dijkstra",
    "A*",
    "minimum spanning tree",
    "traffic simulation",
  ],
  applicationName: "Nova City Traffic Control",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#050b16",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
