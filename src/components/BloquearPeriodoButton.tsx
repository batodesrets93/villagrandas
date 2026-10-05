"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bloquearPeriodoAction } from "@/lib/actions";

/**
 * Bloquea / desbloquea un período de expensas. Bloqueado, no se puede
 * modificar nada que cambie sus números (ver src/lib/bloqueo.ts).
 * Desbloquear pide doble confirmación.
 */
export default function BloquearPeriodoButton({
  periodoId,
  etiqueta,
  cerrado,
}: {
  periodoId: string;
  etiqueta: string;
  cerrado: boolean;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    if (!cerrado) {
      const ok = window.confirm(
        `¿Bloquear "${etiqueta}"?\n\nUna vez bloqueado no se van a poder editar gastos, gas, calefacción, ajustes, pagos ni comprobantes de este período, ni eliminarlo.\n\nLos pagos que los propietarios informen sobre este mes se van a imputar en la liquidación abierta más nueva de cada unidad.`
      );
      if (!ok) return;
    } else {
      const ok1 = window.confirm(
        `¿Desbloquear "${etiqueta}"?\n\nOJO: si modificás este período, los cambios NO se trasladan solos al saldo anterior del período siguiente.`
      );
      if (!ok1) return;
      const ok2 = window.confirm(`Confirmá de nuevo: ¿desbloquear "${etiqueta}"?`);
      if (!ok2) return;
    }

    setError("");
    setCargando(true);
    const formData = new FormData();
    formData.set("periodoId", periodoId);
    formData.set("bloquear", cerrado ? "0" : "1");
    const resultado = await bloquearPeriodoAction(formData);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button onClick={onClick} disabled={cargando} className="btn btn-secondary text-xs">
        {cargando ? "..." : cerrado ? "🔓 Desbloquear" : "🔒 Bloquear"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1 max-w-xs">{error}</p>}
    </div>
  );
}
