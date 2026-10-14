"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Barra de progreso arriba de todo + cursor "cargando" al tocar un link interno,
// hasta que la pagina nueva termina de cargar. Sin esto, en una pagina lenta
// no hay ninguna señal de que el toque se registro.
export default function BarraProgreso() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [cargando, setCargando] = useState(false);

  // Cuando cambia la ruta, la navegacion termino.
  useEffect(() => {
    setCargando(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith("/api/")) return; // descargas (PDF, adjuntos)
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setCargando(true);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Red de seguridad: si algo falla y la ruta no cambia, no dejar la barra colgada.
  useEffect(() => {
    if (!cargando) return;
    const t = setTimeout(() => setCargando(false), 15000);
    return () => clearTimeout(t);
  }, [cargando]);

  useEffect(() => {
    document.body.classList.toggle("navegando", cargando);
    return () => document.body.classList.remove("navegando");
  }, [cargando]);

  if (!cargando) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 overflow-hidden bg-brand-100" role="progressbar" aria-label="Cargando">
      <div className="barra-progreso h-full w-1/3 bg-brand-500" />
    </div>
  );
}
