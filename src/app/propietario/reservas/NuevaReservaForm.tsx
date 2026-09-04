"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearReservaAction } from "@/lib/actions";

export default function NuevaReservaForm({ quinchos }: { quinchos: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onSubmit(formData: FormData) {
    setError("");
    setCargando(true);
    try {
      const resultado = await crearReservaAction(formData);
      if (resultado.ok) {
        router.refresh();
      } else {
        setError(resultado.error);
      }
    } catch (e: any) {
      setError(e.message ?? "No se pudo crear la reserva");
    } finally {
      setCargando(false);
    }
  }

  return (
    <form action={onSubmit} className="card space-y-3">
      <h2 className="font-semibold">Nueva reserva</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">Quincho</label>
          <select name="quinchoId" required>
            {quinchos.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Fecha</label>
          <input name="fecha" type="date" required />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Turno</label>
          <select name="turno" required>
            <option value="MEDIODIA">Mediodía (9:00 a 15:30)</option>
            <option value="NOCHE">Noche (18:30 a 0:30 / 2:00)</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={cargando} className="btn btn-primary">
        {cargando ? "Reservando..." : "Reservar ($ 50.000)"}
      </button>
    </form>
  );
}
