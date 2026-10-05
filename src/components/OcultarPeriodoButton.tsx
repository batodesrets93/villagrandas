"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ocultarPeriodoAction } from "@/lib/actions";

/** Oculta el período a los propietarios hasta que se vuelva a enviar por email. */
export default function OcultarPeriodoButton({
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
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    const ok = window.confirm(
      `¿Ocultar "${etiqueta}" a los propietarios?\n\nDejan de verla en la web hasta que la vuelvas a enviar por email.`
    );
    if (!ok) return;
    setError("");
    setCargando(true);
    const formData = new FormData();
    formData.set("periodoId", periodoId);
    const resultado = await ocultarPeriodoAction(formData);
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
        <button role="menuitem" onClick={onClick} disabled={cargando} className="menu-item">
          <span aria-hidden>🙈</span>
          {cargando ? "Ocultando..." : "Ocultar a propietarios"}
        </button>
        {error && <p className="px-3.5 pb-2 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <button onClick={onClick} disabled={cargando} className="btn btn-secondary text-xs">
        {cargando ? "..." : "Ocultar a propietarios"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1 max-w-xs">{error}</p>}
    </div>
  );
}
