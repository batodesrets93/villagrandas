"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarPeriodoAction } from "@/lib/actions";

type Categoria = { nombre: string; monto: string; fondo: boolean };
type Item = { monto: string; fondo: boolean };
type Grupo = { nombre: string; items: Item[] };

// Agrupa la lista plana que viene de la base (un registro GastoCategoria por
// gasto) en grupos por nombre de categoría, para poder mostrar "Energía" con
// sus 2 cuentas, "Mantenimiento" con sus varias, etc. Si dos gastos no
// consecutivos comparten el mismo nombre, también se agrupan juntos.
function agruparCategorias(categorias: Categoria[]): Grupo[] {
  const grupos: Grupo[] = [];
  const indicePorNombre = new Map<string, number>();

  for (const c of categorias) {
    const existente = indicePorNombre.get(c.nombre);
    if (existente !== undefined) {
      grupos[existente].items.push({ monto: c.monto, fondo: c.fondo });
    } else {
      indicePorNombre.set(c.nombre, grupos.length);
      grupos.push({ nombre: c.nombre, items: [{ monto: c.monto, fondo: c.fondo }] });
    }
  }

  return grupos.length > 0 ? grupos : [{ nombre: "", items: [{ monto: "", fondo: false }] }];
}

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
  const [grupos, setGrupos] = useState<Grupo[]>(() => agruparCategorias(categoriasIniciales));
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function actualizarNombreGrupo(gi: number, nombre: string) {
    setGrupos((prev) => prev.map((g, idx) => (idx === gi ? { ...g, nombre } : g)));
  }

  function actualizarItem(gi: number, ii: number, campo: "monto" | "fondo", valor: string | boolean) {
    setGrupos((prev) =>
      prev.map((g, idx) =>
        idx === gi
          ? { ...g, items: g.items.map((it, iidx) => (iidx === ii ? { ...it, [campo]: valor } : it)) }
          : g
      )
    );
  }

  function agregarGrupo() {
    setGrupos((prev) => [...prev, { nombre: "", items: [{ monto: "", fondo: false }] }]);
  }

  function quitarGrupo(gi: number) {
    setGrupos((prev) => prev.filter((_, idx) => idx !== gi));
  }

  function agregarItem(gi: number) {
    setGrupos((prev) =>
      prev.map((g, idx) => (idx === gi ? { ...g, items: [...g.items, { monto: "", fondo: false }] } : g))
    );
  }

  function quitarItem(gi: number, ii: number) {
    setGrupos((prev) =>
      prev.map((g, idx) => (idx === gi ? { ...g, items: g.items.filter((_, iidx) => iidx !== ii) } : g))
    );
  }

  const parseNum = (s: string) => {
    const limpio = s.replace(/[^\d.,-]/g, "");
    if (limpio.includes(",") && limpio.includes(".")) return parseFloat(limpio.replace(/\./g, "").replace(",", "."));
    if (limpio.includes(",")) return parseFloat(limpio.replace(",", "."));
    return parseFloat(limpio) || 0;
  };

  const total = grupos.reduce(
    (acc, g) => acc + g.items.reduce((a, it) => a + (parseNum(it.monto) || 0), 0),
    0
  );

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

  // Índice plano: el backend empareja catNombre[i] / catMonto[i] / catFondo
  // (que solo llega si el checkbox está tildado) por posición de aparición
  // en el FormData, sin importar cómo se agrupen visualmente en la pantalla.
  let flatIndex = -1;

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
          <button type="button" onClick={agregarGrupo} className="btn btn-secondary text-xs">
            + Agregar categoría
          </button>
        </div>

        <div className="space-y-4">
          {grupos.map((g, gi) => {
            const subtotal = g.items.reduce((a, it) => a + (parseNum(it.monto) || 0), 0);
            return (
              <div key={gi} className="rounded-lg border border-gray-200 p-3">
                <div className="flex gap-2 items-center mb-2">
                  <input
                    value={g.nombre}
                    onChange={(e) => actualizarNombreGrupo(gi, e.target.value)}
                    placeholder="Categoría"
                    className="flex-1 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => quitarGrupo(gi)}
                    className="text-red-500 text-xs px-2"
                    title="Quitar categoría"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1.5 ml-1">
                  {g.items.map((it, ii) => {
                    flatIndex += 1;
                    const idx = flatIndex;
                    return (
                      <div key={ii} className="flex gap-2 items-center">
                        {/* El nombre real que viaja al servidor: uno por gasto, oculto,
                            siempre igual al nombre de la categoría del grupo. */}
                        <input type="hidden" name="catNombre" value={g.nombre} />
                        {g.items.length > 1 && (
                          <span className="text-xs text-gray-400 w-16 shrink-0">Cuenta {ii + 1}</span>
                        )}
                        <input
                          name="catMonto"
                          value={it.monto}
                          onChange={(e) => actualizarItem(gi, ii, "monto", e.target.value)}
                          placeholder="Monto"
                          inputMode="decimal"
                          className="w-40"
                        />
                        <label className="flex items-center gap-1 text-xs text-gray-500 w-28">
                          <input
                            type="checkbox"
                            name="catFondo"
                            value={idx}
                            checked={it.fondo}
                            onChange={(e) => actualizarItem(gi, ii, "fondo", e.target.checked)}
                          />
                          Fondo reserva
                        </label>
                        {g.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => quitarItem(gi, ii)}
                            className="text-red-400 text-xs px-1"
                            title="Quitar este gasto"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => agregarItem(gi)} className="text-xs text-brand-600 underline">
                    + Agregar gasto a esta categoría
                  </button>
                </div>

                {g.items.length > 1 && (
                  <div className="text-right text-xs text-gray-500 mt-1">
                    Subtotal: $ {subtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            );
          })}
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
