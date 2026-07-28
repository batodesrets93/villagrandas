"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarPeriodoAction } from "@/lib/actions";

type Categoria = { nombre: string; monto: string; fondo: boolean };

export default function EditarPeriodoForm({
  periodoId,
  etiqueta,
  fechaInicio,
  fechaFin,
  vencimiento,
  categoriasIniciales,
}: {
  periodoId: string;
  etiqueta: string;
  fechaInicio: string;
  fechaFin: string;
  vencimiento: string;
  categoriasIniciales: Categoria[];
}) {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>(
    categoriasIniciales.length > 0 ? categoriasIniciales : [{ nombre: "", monto: "", fondo: false }]
  );
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function actualizar(i: number, campo: "nombre" | "monto" | "fondo", valor: string | boolean) {
    setCategorias((prev) => prev.map((c, idx) => (idx === i ? { ...c, [campo]: valor } : c)));
  }

  function agregarFila() {
    setCategorias((prev) => [...prev, { nombre: "", monto: "", fondo: false }]);
  }

  function quitarFila(i: number) {
    setCategorias((prev) => prev.filter((_, idx) => idx !== i));
  }

  const parseNum = (s: string) => {
    const limpio = s.replace(/[^\d.,-]/g, "");
    if (limpio.includes(",") && limpio.includes(".")) return parseFloat(limpio.replace(/\./g, "").replace(",", "."));
    if (limpio.includes(",")) return parseFloat(limpio.replace(",", "."));
    return parseFloat(limpio) || 0;
  };
  const total = categorias.reduce((acc, c) => acc + (parseNum(c.monto) || 0), 0);

  async function onSubmit(formData: FormData) {
    setError("");
    setCargando(true);
    formData.set("periodoId", periodoId);
    const resultado = await actualizarPeriodoAction(formData);
    if (!resultado.ok) {
      setError(resultado.error);
      setCargando(false);
      return;
    }
    router.push(`/admin/expensas/${resultado.data.id}`);
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <div className="card grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="sm:col-span-1">
          <label className="text-sm font-medium block mb-1">Etiqueta</label>
          <input name="etiqueta" defaultValue={etiqueta} required />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Inicio</label>
          <input name="fechaInicio" type="date" defaultValue={fechaInicio} required />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Fin</label>
          <input name="fechaFin" type="date" defaultValue={fechaFin} required />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Vencimiento</label>
          <input name="vencimiento" type="date" defaultValue={vencimiento} required />
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Detalle de gastos del período</h2>
          <button type="button" onClick={agregarFila} className="btn btn-secondary text-xs">
            + Agregar categoría
          </button>
        </div>

        <div className="space-y-2">
          {categorias.map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                name="catNombre"
                value={c.nombre}
                onChange={(e) => actualizar(i, "nombre", e.target.value)}
                placeholder="Categoría"
                className="flex-1"
              />
              <input
                name="catMonto"
                value={c.monto}
                onChange={(e) => actualizar(i, "monto", e.target.value)}
                placeholder="Monto"
                inputMode="decimal"
                className="w-40"
              />
              <label className="flex items-center gap-1 text-xs text-gray-500 w-28">
                <input
                  type="checkbox"
                  name="catFondo"
                  value={i}
                  checked={c.fondo}
                  onChange={(e) => actualizar(i, "fondo", e.target.checked)}
                />
                Fondo reserva
              </label>
              <button
                type="button"
                onClick={() => quitarFila(i)}
                className="text-red-500 text-xs px-2"
                title="Quitar categoría"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 text-right font-semibold">
          Total gastos: $ {total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={cargando} className="btn btn-primary">
          {cargando ? "Guardando..." : "Guardar cambios y recalcular"}
        </button>
      </div>
    </form>
  );
}