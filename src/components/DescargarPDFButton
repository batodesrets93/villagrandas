"use client";

import { useState } from "react";

export default function DescargarPdfButton({
  cargoId,
  nombreArchivo,
}: {
  cargoId: string;
  nombreArchivo: string;
}) {
  const [descargando, setDescargando] = useState(false);

  async function handleDescargar() {
    setDescargando(true);
    try {
      const res = await fetch(`/api/pdf/${cargoId}`);
      if (!res.ok) throw new Error("No se pudo generar el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("No se pudo descargar el PDF. Probá de nuevo.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDescargar}
      disabled={descargando}
      className="font-medium text-brand-600 underline disabled:opacity-50"
    >
      {descargando ? "Generando..." : "Descargar PDF"}
    </button>
  );
}
