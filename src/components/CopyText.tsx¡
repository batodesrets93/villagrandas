"use client";

import { useState } from "react";

// Fila con un dato (alias, CVU, titular, etc.) y un boton para copiarlo al
// portapapeles de un toque, para que transferir desde el home banking sea
// mas rapido y sin errores de tipeo.
export default function CopyText({ label, value }: { label: string; value: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      alert(`No se pudo copiar automaticamente. ${label}: ${value}`);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-left hover:bg-gray-50"
    >
      <span>
        <span className="block text-xs text-gray-400">{label}</span>
        <span className="font-medium text-gray-800 break-all">{value}</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-brand-600">
        {copiado ? "¡Copiado!" : "Copiar"}
      </span>
    </button>
  );
}
