"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { crearAccesoPropietarioAction } from "@/lib/actions";
import DesarrolladorToggle from "./DesarrolladorToggle";

type UnidadRow = {
  id: string;
  torre: "GRANDE" | "CHICA";
  piso: string;
  depto: string;
  titular: string;
  m2: number;
  cocheraM2: number;
  bauleraM2: number;
  esDesarrollador: boolean;
  email: string | null;
};

function m2Texto(n: number) {
  // Se muestra redondeado (sin decimales); el valor real (con decimales) es
  // el que se sigue usando para el cálculo de incidencias y prorrateo.
  return n ? Math.round(n).toLocaleString("es-AR") + " m²" : "-";
}

function porcentajeTexto(n: number) {
  return (n * 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + " %";
}

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function UnidadesTable({ unidades }: { unidades: UnidadRow[] }) {
  const [busqueda, setBusqueda] = useState("");

  // m2 total del edificio (deptos + cocheras + bauleras de TODAS las
  // unidades, sin importar el filtro de búsqueda) para calcular el % de
  // incidencia total de cada unidad: (m2 + cocheraM2 + bauleraM2) / total.
  const totalM2Edificio = useMemo(
    () => unidades.reduce((acc, u) => acc + u.m2 + u.cocheraM2 + u.bauleraM2, 0),
    [unidades]
  );

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return unidades;
    return unidades.filter((u) => {
      const torreTexto = u.torre === "GRANDE" ? "grande" : "chica";
      const haystack = normalizar(
        [torreTexto, u.piso, u.depto, u.titular, u.email ?? ""].join(" ")
      );
      return haystack.includes(q);
    });
  }, [busqueda, unidades]);

  function exportarExcel() {
    const datos = filtradas.map((u) => ({
      Torre: u.torre === "GRANDE" ? "Grande" : "Chica",
      Piso: u.piso,
      Depto: u.depto,
      Titular: u.titular,
      "m²": u.m2,
      "Cochera (m²)": u.cocheraM2,
      "Baulera (m²)": u.bauleraM2,
      "% Incidencia total": totalM2Edificio > 0 ? (u.m2 + u.cocheraM2 + u.bauleraM2) / totalM2Edificio : 0,
      Edificio: u.esDesarrollador ? "Sí" : "No",
      Email: u.email ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    ws["!cols"] = [
      { wch: 10 },
      { wch: 8 },
      { wch: 8 },
      { wch: 28 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 28 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Unidades");

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `unidades_${fecha}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <input
          type="text"
          placeholder="Buscar por torre, piso, depto, titular o email..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {filtradas.length} de {unidades.length} unidades
          </span>
          <button type="button" onClick={exportarExcel} className="btn btn-secondary whitespace-nowrap">
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Torre</th>
              <th>Piso</th>
              <th>Depto</th>
              <th>Titular</th>
              <th>m²</th>
              <th title="m² asignado; el monto se calcula por período">Cochera</th>
              <th title="m² asignado; el monto se calcula por período">Baulera</th>
              <th title="(m² unidad + cochera + baulera) / m² total del edificio">% Incidencia total</th>
              <th title="No aparece en el ranking de deudores del dashboard">Edificio</th>
              <th>Acceso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((u) => (
              <tr key={u.id}>
                <td>{u.torre === "GRANDE" ? "Grande" : "Chica"}</td>
                <td>{u.piso}</td>
                <td>{u.depto}</td>
                <td>{u.titular}</td>
                <td>{u.m2}</td>
                <td>{m2Texto(u.cocheraM2)}</td>
                <td>{m2Texto(u.bauleraM2)}</td>
                <td>
                  {totalM2Edificio > 0
                    ? porcentajeTexto((u.m2 + u.cocheraM2 + u.bauleraM2) / totalM2Edificio)
                    : "-"}
                </td>
                <td>
                  <DesarrolladorToggle unidadId={u.id} checked={u.esDesarrollador} />
                </td>
                <td>
                  {u.email ? (
                    <span className="text-brand-600 font-medium">{u.email}</span>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-sm text-brand-600 underline">Crear acceso</summary>
                      <form action={crearAccesoPropietarioAction} className="mt-2 space-y-2 w-56">
                        <input type="hidden" name="unidadId" value={u.id} />
                        <input name="nombre" placeholder="Nombre" defaultValue={u.titular} required />
                        <input name="email" type="email" placeholder="Email" required />
                        <input name="password" type="password" placeholder="Contraseña (mín. 6)" required />
                        <button type="submit" className="btn btn-primary w-full">
                          Guardar
                        </button>
                      </form>
                    </details>
                  )}
                </td>
                <td>
                  <Link href={`/admin/unidades/${u.id}`} className="text-brand-600 underline text-sm whitespace-nowrap">
                    Ver historial
                  </Link>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center text-gray-500 py-6">
                  No se encontraron unidades para &quot;{busqueda}&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
