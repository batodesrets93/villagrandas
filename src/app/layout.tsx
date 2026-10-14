import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import BarraProgreso from "@/components/BarraProgreso";

export const metadata: Metadata = {
  title: "Torres Villa Grandas - Administración",
  description: "Sistema de administración de expensas, quinchos y reclamos",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#b4ada4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Suspense fallback={null}>
          <BarraProgreso />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
