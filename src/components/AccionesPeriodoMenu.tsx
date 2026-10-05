"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Menú desplegable "Acciones" para la lista de períodos. El panel usa
 * position: fixed para que no lo recorte el overflow-x-auto de la tabla.
 * Queda abierto tras una acción (así se ven los mensajes de resultado);
 * se cierra con clic afuera, Escape, scroll o resize.
 */
export default function AccionesPeriodoMenu({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!abierto && botonRef.current) {
      const r = botonRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }
    setAbierto((a) => !a);
  }

  useEffect(() => {
    if (!abierto) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || botonRef.current?.contains(t)) return;
      setAbierto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    function cerrar() {
      setAbierto(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [abierto]);

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={`btn btn-outline btn-sm ${abierto ? "bg-brand-50" : ""}`}
      >
        Acciones
        <svg className={`ml-1 h-3.5 w-3.5 transition-transform ${abierto ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {abierto && (
        <div
          ref={panelRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </>
  );
}
