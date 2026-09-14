"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SignOutButton from "./SignOutButton";

export default function NavLimpieza({ initialCount }: { initialCount: number }) {
  const [nuevas, setNuevas] = useState(initialCount);

  useEffect(() => {
    let cancelado = false;

    async function chequear() {
      try {
        const res = await fetch("/api/limpieza/notificaciones", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado && typeof data.nuevas === "number") setNuevas(data.nuevas);
      } catch {
        // silencioso: si falla, se reintenta en el proximo intervalo
      }
    }

    const id = setInterval(chequear, 30000);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, []);

  return (
    <nav className="bg-brand-700 text-white">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="font-bold text-sm sm:text-base">Villa Grandas · Limpieza</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
          <Link href="/limpieza" className="relative hover:underline flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            Reservas de quincho
            {nuevas > 0 && (
              <span className="absolute -top-2 -right-3 bg-red-600 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {nuevas > 9 ? "9+" : nuevas}
              </span>
            )}
          </Link>
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
