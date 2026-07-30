"use client";

import { useMemo, useState } from "react";
import AsignarSelect from "./AsignarSelect";

export type EspacioRow = {
  id: string;
  planta: string;
  numero: string;
  m2: number;
  caracteristica?: string | null;
  unidadId: string | null;
  unidadLabel: string | null;
};

type UnidadOpcion = { id: string; label: string };

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function m2Texto(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + " m²";
}

function Tabla({
  tipo,
  titulo,
  espacios,
  unidades,
}: {
  tipo: "cochera" | "baulera";
  titulo: string;
  espacios: EspacioRow[];
  unidades: UnidadOpcion[];
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return espacios;
    return espacios.filter((e) => {
      const haystack = normalizar([e.planta, e.numero, e.unidadLabel ?? ""].join(" "));
      return haystack.includes(q);
    });
  }, [busqueda, espacios]);

  const sinAsignar = espacios.filter((e) => !e.unidadId).length;

  return (
    <div className="card overflow-x-auto space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <h2 className="font-semibold">
          {titulo} ({espacios.length}) —{" "}
          <span className={sinAsignar > 0 ? "text-amber-600" : "text-gray-500"}>{sinAsignar} sin asignar</span>
        </h2>
        <input
          type="text"
          placeholder="Buscar por planta, número o propietario..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Planta</th>
            <th>N°</th>
            {tipo === "cochera" && <th>Tipo</th>}
            <th>m²</th>
            <th>Asignada a</th>
          </tr>
        </thead>
        <tbody>
          {filtradas.map((e) => (
            <tr key={e.id}>
              <td>{e.planta}</td>
              <td>{e.numero}</td>
              {tipo === "cochera" && <td>{e.caracteristica}</td>}
              <td>{m2Texto(e.m2)}</td>
              <td>
                <AsignarSelect tipo={tipo} espacioId={e.id} unidadIdActual={e.unidadId} unidades={unidades} />
              </td>
            </tr>
          ))}
          {filtradas.length === 0 && (
            <tr>
              <td colSpan={tipo === "cochera" ? 5 : 4} className="text-center text-gray-500 py-4">
                No se encontraron resultados para &quot;{busqueda}&quot;.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CocherasBaulerasTables({
  cocheras,
  bauleras,
  unidades,
}: {
  cocheras: EspacioRow[];
  bauleras: EspacioRow[];
  unidades: UnidadOpcion[];
}) {
  return (
    <div className="space-y-6">
      <Tabla tipo="cochera" titulo="Cocheras" espacios={cocheras} unidades={unidades} />
      <Tabla tipo="baulera" titulo="Bauleras" espacios={bauleras} unidades={unidades} />
    </div>
  );
}
