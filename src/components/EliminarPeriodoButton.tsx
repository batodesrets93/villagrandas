"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eliminarPeriodoAction } from "@/lib/actions";

export default function EliminarPeriodoButton({
  periodoId,
  etiqueta,
  enMenu = false,
}: {
  periodoId: string;
  etiqueta: string;
  /** Se muestra como ítem del menú "Acciones" de la lista. */
  enMenu?: boolean;
}) {
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

  if (enMenu) {
    return (
      <div>
        <button role="menuitem" onClick={onClick} disabled={cargando} className="menu-item menu-item-danger">
          <span aria-hidden>🗑️</span>
          {cargando ? "Eliminando..." : "Eliminar período"}
        </button>
        {error && <p className="px-3.5 pb-2 text-xs text-red-600">{error}</p>}
      </div>
    );
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
