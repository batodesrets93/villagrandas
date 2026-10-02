"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearPeriodoAction } from "@/lib/actions";
import { leerPlanillaAdmin, formatoPesos, type Planilla } from "@/lib/planillaAdmin";

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

type Item = { monto: string; fondo: boolean; excluyeDesarrollador: boolean };
type Grupo = { nombre: string; items: Item[] };

export default function NuevoPeriodoPage() {
  const router = useRouter();
  const [grupos, setGrupos] = useState<Grupo[]>(
    CATEGORIAS_SUGERIDAS.map((n) => ({
      nombre: n,
      // "Honorarios administración" viene destildado por defecto para que
      // Costa Tranvial (unidades sin vender) no pague ese rubro, igual que
      // hace el administrador externo en su planilla.
      items: [{ monto: "", fondo: false, excluyeDesarrollador: n === "Honorarios administración" }],
    }))
  );
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  // Planilla de la administradora importada (si se importó): de acá salen
  // las categorias, las facturas de gas por torre (se guardan en el período
  // para que "Calcular gas" ya las tenga) y el total para controlar.
  const [planilla, setPlanilla] = useState<Planilla | null>(null);
  const [errorPlanilla, setErrorPlanilla] = useState("");

  async function importarPlanilla(archivo: File | undefined) {
    setErrorPlanilla("");
    if (!archivo) return;
    try {
      const p = await leerPlanillaAdmin(await archivo.arrayBuffer());
      const nuevos: Grupo[] = p.categorias
        .map((c) => ({
          nombre: c.nombre,
          items: c.items
            .filter((it) => it.monto > 0)
            .map((it) => ({
              monto: it.monto.toFixed(2),
              fondo: false,
              excluyeDesarrollador: c.nombre === "Honorarios administración",
            })),
        }))
        .filter((g) => g.items.length > 0);
      setGrupos(nuevos);
      setPlanilla(p);
    } catch (e) {
      setPlanilla(null);
      setErrorPlanilla(e instanceof Error ? e.message : "No se pudo leer la planilla.");
    }
  }

  function actualizarNombreGrupo(gi: number, nombre: string) {
    setGrupos((prev) => prev.map((g, idx) => (idx === gi ? { ...g, nombre } : g)));
  }

  function actualizarItem(
    gi: number,
    ii: number,
    campo: "monto" | "fondo" | "excluyeDesarrollador",
    valor: string | boolean
  ) {
    setGrupos((prev) =>
      prev.map((g, idx) =>
        idx === gi
          ? { ...g, items: g.items.map((it, iidx) => (iidx === ii ? { ...it, [campo]: valor } : it)) }
          : g
      )
    );
  }

  function agregarGrupo() {
    setGrupos((prev) => [...prev, { nombre: "", items: [{ monto: "", fondo: false, excluyeDesarrollador: false }] }]);
  }

  function quitarGrupo(gi: number) {
    setGrupos((prev) => prev.filter((_, idx) => idx !== gi));
  }

  function agregarItem(gi: number) {
    setGrupos((prev) =>
      prev.map((g, idx) =>
        idx === gi
          ? { ...g, items: [...g.items, { monto: "", fondo: false, excluyeDesarrollador: false }] }
          : g
      )
    );
  }

  function quitarItem(gi: number, ii: number) {
    setGrupos((prev) =>
      prev.map((g, idx) => (idx === gi ? { ...g, items: g.items.filter((_, iidx) => iidx !== ii) } : g))
    );
  }

  const total = grupos.reduce(
    (acc, g) => acc + g.items.reduce((a, it) => a + (parseFloat(it.monto) || 0), 0),
    0
  );

  async function onSubmit(formData: FormData) {
    setError("");
    setCargando(true);
    const resultado = await crearPeriodoAction(formData);
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

        <div className="card space-y-2">
          <h2 className="font-semibold">Importar planilla de la administradora</h2>
          <p className="text-sm text-gray-500">
            Subí el Excel de gastos que manda la administradora (el de &quot;DETALLE DE GASTOS&quot;) y se cargan solas
            todas las categorías y montos, incluidas las dos facturas de gas. Revisá que el total coincida antes de
            liquidar.
          </p>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => importarPlanilla(e.target.files?.[0])} />
          {errorPlanilla && <p className="text-sm text-red-600">{errorPlanilla}</p>}
          {planilla && (
            <div className="text-sm space-y-1">
              <p>
                Planilla: <b>{planilla.titulo || "sin título"}</b> · Total planilla:{" "}
                <b>{planilla.totalPlanilla != null ? formatoPesos(planilla.totalPlanilla) : "no encontrado"}</b> · Total
                cargado: <b>{formatoPesos(total)}</b>{" "}
                {planilla.totalPlanilla != null &&
                  (Math.abs(planilla.totalPlanilla - total) <= 0.01 ? (
                    <span className="text-green-700">✓ coinciden</span>
                  ) : (
                    <span className="text-red-600">✗ no coinciden</span>
                  ))}
              </p>
              {(planilla.facturaGasTorreGrande != null || planilla.facturaGasTorreChica != null) && (
                <p className="text-gray-600">
                  Facturas de gas: Torre Grande{" "}
                  {planilla.facturaGasTorreGrande != null ? formatoPesos(planilla.facturaGasTorreGrande) : "-"} · Torre
                  Chica {planilla.facturaGasTorreChica != null ? formatoPesos(planilla.facturaGasTorreChica) : "-"} (ya
                  quedan cargadas en Calcular gas)
                </p>
              )}
              {planilla.advertencias.map((a, i) => (
                <p key={i} className="text-amber-700">
                  ⚠ {a}
                </p>
              ))}
            </div>
          )}
          {planilla?.facturaGasTorreGrande != null && (
            <input type="hidden" name="facturaGasTorreGrande" value={planilla.facturaGasTorreGrande} />
          )}
          {planilla?.facturaGasTorreChica != null && (
            <input type="hidden" name="facturaGasTorreChica" value={planilla.facturaGasTorreChica} />
          )}
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
              const subtotal = g.items.reduce((a, it) => a + (parseFloat(it.monto) || 0), 0);
              return (
                <div key={gi} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex gap-2 items-center mb-2">
                    <input
                      value={g.nombre}
                      onChange={(e) => actualizarNombreGrupo(gi, e.target.value)}
                      placeholder="Categoría"
                      className="flex-1 font-medium"
                    />
                    {grupos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => quitarGrupo(gi)}
                        className="text-red-500 text-xs px-2"
                        title="Quitar categoría"
                      >
                        ✕
                      </button>
                    )}
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
                          <label
                            className="flex items-center gap-1 text-xs text-gray-500 w-44"
                            title="Las unidades sin vender (Costa Tranvial) no pagan este rubro"
                          >
                            <input
                              type="checkbox"
                              name="catExcluyeDesarrollador"
                              value={idx}
                              checked={it.excluyeDesarrollador}
                              onChange={(e) => actualizarItem(gi, ii, "excluyeDesarrollador", e.target.checked)}
                            />
                            No aplica a Costa Tranvial
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
                      Subtotal: $ {subtotal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-right font-semibold">
            Total gastos: $ {total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
