"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eliminarPeriodoAction } from "@/lib/actions";

export default function EliminarPeriodoButton({ periodoId, etiqueta }: { periodoId: string; etiqueta: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onClick() {
    const confirmado = window.confirm(
      `¿Seguro que querés eliminar la liquidación "${etiqueta}"? Se borran todos los montos y pagos registrados en este período. Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setError("");
    setCargando(true);
    const formData = new FormData();
    formData.set("periodoId", periodoId);
    const resultado = await eliminarPeriodoAction(formData);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button onClick={onClick} disabled={cargando} className="btn btn-danger text-xs">
        {cargando ? "Eliminando..." : "Eliminar"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
