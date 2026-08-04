"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { calcularGasAction } from "@/lib/actions";

type UnidadGas = {
  id: string;
  torre: "GRANDE" | "CHICA";
  piso: string;
  depto: string;
  titular: string;
  esEspacioComun: boolean;
  lecturaAnterior: number;
  lecturaActualPrevia: number | null;
};

export default function CalcularGasForm({
  periodoId,
  facturaGasTorreGrandeInicial,
  facturaGasTorreChicaInicial,
  unidades,
}: {
  periodoId: string;
  facturaGasTorreGrandeInicial?: number;
  facturaGasTorreChicaInicial?: number;
  unidades: UnidadGas[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [lecturas, setLecturas] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      unidades.map((u) => [u.id, u.lecturaActualPrevia != null ? String(u.lecturaActualPrevia) : ""])
    )
  );

  function etiquetaUnidad(u: UnidadGas) {
    if (u.esEspacioComun) return "Pileta (espacio común)";
    return `${u.torre === "GRANDE" ? "TG" : "TC"} ${u.piso}º${u.depto} — ${u.titular}`;
  }

  async function onSubmit(formData: FormData) {
    setError("");
    setCargando(true);
    const resultado = await calcularGasAction(formData);
    if (!resultado.ok) {
      setError(resultado.error);
      setCargando(false);
      return;
    }
    router.push(`/admin/expensas/${resultado.data.id}`);
  }

  const torreGrande = unidades.filter((u) => u.torre === "GRANDE");
  const torreChica = unidades.filter((u) => u.torre === "CHICA");

  function Tabla({ titulo, lista }: { titulo: string; lista: UnidadGas[] }) {
    return (
      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">{titulo}</h2>
        <table>
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Lectura anterior</th>
              <th>Lectura actual</th>
              <th>Consumo</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => {
              const valor = lecturas[u.id] ?? "";
              const consumo = valor !== "" && !isNaN(Number(valor)) ? Number(valor) - u.lecturaAnterior : null;
              return (
                <tr key={u.id}>
                  <td>{etiquetaUnidad(u)}</td>
                  <td className="text-gray-500">{u.lecturaAnterior.toLocaleString("es-AR")}</td>
                  <td>
                    <input type="hidden" name="lecturaUnidadId" value={u.id} />
                    <input
                      name="lecturaActual"
                      value={valor}
                      onChange={(e) => setLecturas((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-24"
                    />
                  </td>
                  <td className={consumo !== null && consumo < 0 ? "text-red-600" : "text-gray-500"}>
                    {consumo !== null ? consumo.toLocaleString("es-AR") : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <input type="hidden" name="periodoId" value={periodoId} />

      <div className="card grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">Factura de gas — Torre Grande</label>
          <input
            name="facturaGasTorreGrande"
            defaultValue={facturaGasTorreGrandeInicial ?? ""}
            placeholder="Monto de la factura"
            inputMode="decimal"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Factura de gas — Torre Chica</label>
          <input
            name="facturaGasTorreChica"
            defaultValue={facturaGasTorreChicaInicial ?? ""}
            placeholder="Monto de la factura"
            inputMode="decimal"
            required
          />
        </div>
      </div>

      <Tabla titulo={`Torre Grande (${torreGrande.length})`} lista={torreGrande} />
      <Tabla titulo={`Torre Chica (${torreChica.length})`} lista={torreChica} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={cargando} className="btn btn-primary">
          {cargando ? "Calculando..." : "Calcular gas y aplicar al período"}
        </button>
      </div>
    </form>
  );
}
