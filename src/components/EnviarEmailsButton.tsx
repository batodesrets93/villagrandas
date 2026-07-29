"use client";

import { useState } from "react";
import { enviarLiquidacionesPorEmailAction } from "@/lib/actions";

export default function EnviarEmailsButton({
  periodoId,
  etiqueta,
  cargoId,
}: {
  periodoId: string;
  etiqueta: string;
  /** Si se pasa, envía solo el email de esa unidad. Si no, envía a todas las unidades del período. */
  cargoId?: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function onClick() {
    const confirmado = window.confirm(
      cargoId
        ? `¿Enviar por email la liquidación de "${etiqueta}" a esta unidad?`
        : `¿Enviar por email la liquidación de "${etiqueta}" a todas las unidades que tienen acceso registrado?`
    );
    if (!confirmado) return;

    setError("");
    setMensaje("");
    setEnviando(true);

    const formData = new FormData();
    formData.set("periodoId", periodoId);
    if (cargoId) formData.set("cargoId", cargoId);

    const resultado = await enviarLiquidacionesPorEmailAction(formData);
    setEnviando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    const { enviados, sinEmail } = resultado.data;
    let texto = `Enviado a ${enviados} unidad${enviados === 1 ? "" : "es"}.`;
    if (sinEmail.length > 0) {
      texto += ` Sin acceso/email registrado: ${sinEmail.join(", ")}.`;
    }
    setMensaje(texto);
  }

  return (
    <div>
      <button onClick={onClick} disabled={enviando} className="btn btn-secondary text-xs">
        {enviando ? "Enviando..." : cargoId ? "Enviar email" : "Enviar por email a todos"}
      </button>
      {mensaje && <p className="text-xs text-green-700 mt-1 max-w-xs">{mensaje}</p>}
      {error && <p className="text-xs text-red-600 mt-1 max-w-xs">{error}</p>}
    </div>
  );
}
