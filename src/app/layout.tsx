import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Project Phoenix — Become who you promised yourself you'd be",
    template: "%s · Project Phoenix",
  },
  description:
    "A guided journey toward the person you want to become — with a simulated future-self as your guide. Grounded, honest, never over-promising.",
  applicationName: "Project Phoenix",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Phoenix" },
};

export const viewport: Viewport = {
  themeColor: "#0d0b0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
