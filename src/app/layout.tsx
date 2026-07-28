import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Torres Villa Grandas - Administración",
  description: "Sistema de administración de expensas, quinchos y reclamos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
