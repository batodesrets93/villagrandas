"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { subirComprobanteAction, eliminarComprobanteAction } from "@/lib/actions";

export type ComprobanteInfo = {
  id: string;
  nombreArchivo: string;
  tipoArchivo: string;
  tamanio: number;
};

function tamanioTexto(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Panel de comprobantes de una categoría de gasto, para el admin: permite
 * subir nuevos comprobantes (PDF/imagen) y eliminar los existentes.
 */
export default function ComprobantesGasto({
  gastoId,
  comprobantes,
}: {
  gastoId: string;
  comprobantes: ComprobanteInfo[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function onSubirArchivo() {
    const archivo = inputRef.current?.files?.[0];
    if (!archivo) return;

    setError("");
    setSubiendo(true);
    const formData = new FormData();
    formData.set("gastoId", gastoId);
    formData.set("archivo", archivo);

    const resultado = await subirComprobanteAction(formData);
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  async function onEliminar(comprobanteId: string) {
    const confirmado = window.confirm("¿Eliminar este comprobante? Esta acción no se puede deshacer.");
    if (!confirmado) return;

    setError("");
    setEliminandoId(comprobanteId);
    const formData = new FormData();
    formData.set("comprobanteId", comprobanteId);
    const resultado = await eliminarComprobanteAction(formData);
    setEliminandoId(null);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-1 space-y-1">
      {comprobantes.length > 0 && (
        <ul className="space-y-0.5">
          {comprobantes.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-xs">
              <a
                href={`/api/comprobantes/${c.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 underline truncate max-w-[140px]"
                title={c.nombreArchivo}
              >
                {c.nombreArchivo}
              </a>
              <span className="text-gray-400">({tamanioTexto(c.tamanio)})</span>
              <button
                onClick={() => onEliminar(c.id)}
                disabled={eliminandoId === c.id}
                className="text-red-500 hover:underline"
              >
                {eliminandoId === c.id ? "..." : "Eliminar"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={onSubirArchivo}
          disabled={subiendo}
          className="text-xs"
        />
        {subiendo && <span className="text-xs text-gray-400">Subiendo...</span>}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
