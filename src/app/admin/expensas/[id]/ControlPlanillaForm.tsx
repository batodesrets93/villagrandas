"use client";

import { useState } from "react";
import { claveNombre, formatoPesos, leerPlanillaAdmin, type Planilla } from "@/lib/planillaAdmin";

/**
 * Controla los gastos cargados en el período contra la planilla de la
 * administradora: categoria por categoria y, donde no coinciden, renglon
 * por renglon (asi aparece directo el importe mal tipeado, como pasó en
 * Septiembre/2026 con OSSE y MGP). El archivo se lee en el navegador, no se
 * sube a ningun lado.
 */

type GastoSistema = { nombre: string; monto: number };

type Fila = {
  nombre: string;
  sistema: number;
  planilla: number;
  soloPlanilla: { detalle: string; monto: number }[];
  soloSistema: number[];
};

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

function comparar(gastos: GastoSistema[], planilla: Planilla): Fila[] {
  const sistemaPorCat = new Map<string, { nombre: string; montos: number[] }>();
  for (const g of gastos) {
    const k = claveNombre(g.nombre);
    if (!sistemaPorCat.has(k)) sistemaPorCat.set(k, { nombre: g.nombre, montos: [] });
    sistemaPorCat.get(k)!.montos.push(r2(g.monto));
  }
  const planillaPorCat = new Map(planilla.categorias.map((c) => [claveNombre(c.nombre), c]));

  const claves = [...new Set([...planillaPorCat.keys(), ...sistemaPorCat.keys()])];
  return claves.map((k) => {
    const s = sistemaPorCat.get(k);
    const p = planillaPorCat.get(k);
    const montosSistema = [...(s?.montos ?? [])];
    const soloPlanilla: { detalle: string; monto: number }[] = [];
    for (const it of p?.items ?? []) {
      if (it.monto === 0) continue;
      const i = montosSistema.findIndex((m) => Math.abs(m - it.monto) <= 0.005);
      if (i >= 0) montosSistema.splice(i, 1);
      else soloPlanilla.push(it);
    }
    return {
      nombre: p?.nombre ?? s!.nombre,
      sistema: r2((s?.montos ?? []).reduce((a, m) => a + m, 0)),
      planilla: r2(p?.total ?? 0),
      soloPlanilla,
      soloSistema: montosSistema,
    };
  });
}

export default function ControlPlanillaForm({ gastos }: { gastos: GastoSistema[] }) {
  const [planilla, setPlanilla] = useState<Planilla | null>(null);
  const [error, setError] = useState("");

  async function leer(archivo: File | undefined) {
    setError("");
    if (!archivo) return;
    try {
      setPlanilla(await leerPlanillaAdmin(await archivo.arrayBuffer()));
    } catch (e) {
      setPlanilla(null);
      setError(e instanceof Error ? e.message : "No se pudo leer la planilla.");
    }
  }

  const filas = planilla ? comparar(gastos, planilla) : [];
  const conDiferencia = filas.filter((f) => Math.abs(f.sistema - f.planilla) > 0.005 || f.soloPlanilla.length > 0);
  const totalSistema = r2(filas.reduce((a, f) => a + f.sistema, 0));
  const totalPlanilla = planilla?.totalPlanilla ?? r2(filas.reduce((a, f) => a + f.planilla, 0));

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Controlar contra la planilla de la administradora</h2>
      <p className="text-sm text-gray-500">
        Subí el Excel de gastos de la administradora y se compara con lo cargado acá, categoría por categoría. Hacelo
        antes de enviar las expensas por mail.
      </p>
      <input type="file" accept=".xlsx,.xls" onChange={(e) => leer(e.target.files?.[0])} />
      {error && <p className="text-sm text-red-600">{error}</p>}

      {planilla && (
        <div className="space-y-3 text-sm">
          <p>
            Total sistema: <b>{formatoPesos(totalSistema)}</b> · Total planilla: <b>{formatoPesos(totalPlanilla)}</b> ·
            Diferencia: <b>{formatoPesos(r2(totalSistema - totalPlanilla))}</b>{" "}
            {Math.abs(totalSistema - totalPlanilla) <= 0.005 && conDiferencia.length === 0 ? (
              <span className="text-green-700 font-medium">✓ Todo coincide</span>
            ) : (
              <span className="text-red-600 font-medium">✗ Hay diferencias</span>
            )}
          </p>

          {planilla.advertencias.map((a, i) => (
            <p key={i} className="text-amber-700">
              ⚠ {a}
            </p>
          ))}

          {conDiferencia.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th className="text-right">Sistema</th>
                  <th className="text-right">Planilla</th>
                  <th className="text-right">Diferencia</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {conDiferencia.map((f) => (
                  <tr key={f.nombre}>
                    <td className="font-medium">{f.nombre}</td>
                    <td className="text-right">{formatoPesos(f.sistema)}</td>
                    <td className="text-right">{formatoPesos(f.planilla)}</td>
                    <td className="text-right text-red-600">{formatoPesos(r2(f.sistema - f.planilla))}</td>
                    <td className="text-xs">
                      {f.soloPlanilla.map((it, i) => (
                        <div key={"p" + i}>
                          En la planilla: {it.detalle} {formatoPesos(it.monto)} — no está igual en el sistema
                        </div>
                      ))}
                      {f.soloSistema.map((m, i) => (
                        <div key={"s" + i}>En el sistema: {formatoPesos(m)} — no está igual en la planilla</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
