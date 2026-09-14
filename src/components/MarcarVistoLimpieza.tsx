"use client";

import { useEffect } from "react";
import { marcarVistaReservasLimpiezaAction } from "@/lib/actions";

// Componente invisible: al montarse (cada vez que se abre /limpieza) marca
// las reservas actuales como vistas, para que el badge de notificaciones
// del nav se limpie. No renderiza nada.
export default function MarcarVistoLimpieza() {
  useEffect(() => {
    marcarVistaReservasLimpiezaAction().catch(() => {
      // silencioso: si falla, el badge se vuelve a intentar limpiar en la
      // proxima visita
    });
  }, []);

  return null;
}
