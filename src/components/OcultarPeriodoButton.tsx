"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ocultarPeriodoAction } from "@/lib/actions";

/** Oculta el período a los propietarios hasta que se vuelva a enviar por email. */
export default function OcultarPeriodoButton({ periodoId, etiqueta }: { periodoId: string; etiqueta: string }) {
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

  return (
    <div>
      <button onClick={onClick} disabled={cargando} className="btn btn-secondary text-xs">
        {cargando ? "..." : "Ocultar a propietarios"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1 max-w-xs">{error}</p>}
    </div>
  );
}
