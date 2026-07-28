"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearPeriodoAction } from "@/lib/actions";

const CATEGORIAS_SUGERIDAS = [
  "Energía",
  "Honorarios administración",
  "Agua",
  "Gas",
  "Mantenimiento general",
  "Mantenimiento ascensores",
  "Seguro",
  "Seguridad",
  "Limpieza",
  "MGP",
  "ARBA",
  "Varios",
];

export default function NuevoPeriodoPage() {
  const router = useRouter();
  const [categorias, setCategorias] = useState(CATEGORIAS_SUGERIDAS.map((n) => ({ nombre: n, monto: "", fondo: false })));
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function actualizar(i: number, campo: "nombre" | "monto" | "fondo", valor: string | boolean) {
    setCategorias((prev) => prev.map((c, idx) => (idx === i ? { ...c, [campo]: valor } : c)));
  }

  function agregarFila() {
    setCategorias((prev) => [...prev, { nombre: "", monto: "", fondo: false }]);
  }

  const total = categorias.reduce((acc, c) => acc + (parseFloat(c.monto) || 0), 0);

  async function onSubmit(formData: FormData) {
    setError("");
    setCargando(true);
    try {
      const id = await crearPeriodoAction(formData);
      router.push(`/admin/expensas/${id}`);
    } catch (e: any) {
      setError(e.message ?? "Error al crear el período");
      setCargando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-700">Nuevo período de expensas</h1>

      <form action={onSubmit} className="space-y-6">
        <div className="card grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-1">
            <label className="text-sm font-medium block mb-1">Etiqueta</label>
            <input name="etiqueta" placeholder="Julio 2026" required />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Inicio</label>
            <input name="fechaInicio" type="date" required />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Fin</label>
            <input name="fechaFin" type="date" required />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Vencimiento</label>
            <input name="vencimiento" type="date" required />
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
              </div>
            ))}
          </div>

          <div className="mt-4 text-right font-semibold">
            Total gastos: $ {total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <p className="text-sm text-gray-500">
          El sistema va a prorratear este total entre las 79 unidades según su coeficiente de participación, y va a
          sumar automáticamente cochera, baulera y el cargo de quincho (reservas confirmadas pendientes de facturar).
          La calefacción/agua caliente se completa a mano por unidad después, porque depende del consumo.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={cargando} className="btn btn-primary">
          {cargando ? "Calculando..." : "Liquidar período"}
        </button>
      </form>
    </div>
  );
}
