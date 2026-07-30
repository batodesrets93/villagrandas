"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { asignarCocheraAction, asignarBauleraAction } from "@/lib/actions";

type UnidadOpcion = {
  id: string;
  label: string;
};

export default function AsignarSelect({
  tipo,
  espacioId,
  unidadIdActual,
  unidades,
}: {
  tipo: "cochera" | "baulera";
  espacioId: string;
  unidadIdActual: string | null;
  unidades: UnidadOpcion[];
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function onChange(unidadId: string) {
    setError("");
    setGuardando(true);

    const formData = new FormData();
    formData.set(tipo === "cochera" ? "cocheraId" : "bauleraId", espacioId);
    formData.set("unidadId", unidadId);

    const accion = tipo === "cochera" ? asignarCocheraAction : asignarBauleraAction;
    const resultado = await accion(formData);

    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <select
        defaultValue={unidadIdActual ?? ""}
        disabled={guardando}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs"
      >
        <option value="">— Sin asignar (Costa Tranvial) —</option>
        {unidades.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
