"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearReservaAdminAction } from "@/lib/actions";

export default function NuevaReservaAdminForm({
  quinchos,
  unidades,
}: {
  quinchos: { id: string; nombre: string }[];
  unidades: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onSubmit(formData: FormData) {
    setError("");
    setCargando(true);
    try {
      const resultado = await crearReservaAdminAction(formData);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      (document.getElementById("form-nueva-reserva-admin") as HTMLFormElement | null)?.reset();
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "No se pudo crear la reserva");
    } finally {
      setCargando(false);
    }
  }

  return (
    <form id="form-nueva-reserva-admin" action={onSubmit} className="card space-y-3">
      <h2 className="font-semibold">Cargar reserva</h2>
      <p className="text-sm text-gray-500">
        Para reservas coordinadas por fuera del sistema (telefono, en persona, etc.), imputándolas al
        departamento que corresponda. No aplica el mínimo de 24hs de anticipación.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">Departamento</label>
          <select name="unidadId" required>
            <option value="">Seleccionar...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
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
        {cargando ? "Guardando..." : "Cargar reserva"}
      </button>
    </form>
  );
}
