"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eliminarPagoAction } from "@/lib/actions";

export default function EliminarPagoButton({ pagoId, etiqueta }: { pagoId: string; etiqueta: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onClick() {
    const confirmado = window.confirm(
      `¿Seguro que querés eliminar el pago ${etiqueta}? El saldo de la unidad se recalcula al instante. Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setError("");
    setCargando(true);
    const formData = new FormData();
    formData.set("pagoId", pagoId);
    const resultado = await eliminarPagoAction(formData);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <span>
      <button onClick={onClick} disabled={cargando} className="text-red-600 underline text-xs disabled:opacity-50">
        {cargando ? "Eliminando..." : "Eliminar"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </span>
  );
}
