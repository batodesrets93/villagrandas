"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearReservaAction } from "@/lib/actions";

export default function NuevaReservaForm({ quinchos }: { quinchos: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    setError("");
    setConfirmado(false);
    setCargando(true);
    try {
      const resultado = await crearReservaAction(formData);
      if (resultado.ok) {
        setConfirmado(true);
        formRef.current?.reset();
        router.refresh();
        setTimeout(() => setConfirmado(false), 5000);
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
    <form ref={formRef} action={onSubmit} className="card space-y-3">
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
      {confirmado && (
        <p className="text-sm font-semibold text-green-700">✓ Reserva confirmada</p>
      )}
      <button type="submit" disabled={cargando} className="btn btn-primary">
        {cargando ? "Reservando..." : "Reservar ($ 50.000)"}
      </button>
    </form>
  );
}
