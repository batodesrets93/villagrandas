"use client";

import { useEffect } from "react";

export type CartelData = {
  tipo: "ok" | "aviso";
  titulo: string;
  mensaje: string;
  detalles?: { etiqueta: string; valor: string }[];
};

/**
 * Cartel centrado en pantalla que confirma que una acción (informar un pago,
 * reservar) quedó registrada. Se queda hasta que la persona toca "Entendido",
 * para que no quede duda de que no hace falta volver a enviarla.
 */
export default function CartelResultado({ cartel, onCerrar }: { cartel: CartelData | null; onCerrar: () => void }) {
  useEffect(() => {
    if (!cartel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartel, onCerrar]);

  if (!cartel) return null;
  const esOk = cartel.tipo === "ok";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCerrar}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cartel-titulo"
        aria-describedby="cartel-mensaje"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
      >
        <div
          className={
            "mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-3xl " +
            (esOk ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")
          }
          aria-hidden="true"
        >
          {esOk ? "✓" : "i"}
        </div>
        <h3 id="cartel-titulo" className="text-lg font-bold text-gray-900">
          {cartel.titulo}
        </h3>
        <p id="cartel-mensaje" className="mt-1 text-sm text-gray-600">
          {cartel.mensaje}
        </p>
        {cartel.detalles && cartel.detalles.length > 0 && (
          <dl className="mt-4 space-y-1 rounded-lg bg-gray-50 p-3 text-left text-sm">
            {cartel.detalles.map((d) => (
              <div key={d.etiqueta} className="flex justify-between gap-3">
                <dt className="text-gray-500">{d.etiqueta}</dt>
                <dd className="font-medium text-gray-900 text-right">{d.valor}</dd>
              </div>
            ))}
          </dl>
        )}
        <button type="button" autoFocus onClick={onCerrar} className="btn btn-primary mt-5 w-full">
          Entendido
        </button>
      </div>
    </div>
  );
}
