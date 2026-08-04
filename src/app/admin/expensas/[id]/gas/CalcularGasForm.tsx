"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { calcularGasAction } from "@/lib/actions";

type UnidadGas = {
  id: string;
  torre: "GRANDE" | "CHICA";
  piso: string;
  depto: string;
  titular: string;
  esEspacioComun: boolean;
  lecturaAnterior: number;
  lecturaAnteriorTieneHistorial: boolean;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

  const [facturaGrande, setFacturaGrande] = useState(
    facturaGasTorreGrandeInicial != null ? String(facturaGasTorreGrandeInicial) : ""
  );
  const [facturaChica, setFacturaChica] = useState(
    facturaGasTorreChicaInicial != null ? String(facturaGasTorreChicaInicial) : ""
  );

  const [lecturas, setLecturas] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      unidades.map((u) => [u.id, u.lecturaActualPrevia != null ? String(u.lecturaActualPrevia) : ""])
    )
  );
  // Solo se usa para unidades sin historial (primera vez que se les toma
  // lectura); para las que ya tienen historial, la lectura anterior real
  // viene de la base y no se toca desde acá.
  const [lecturasAnteriores, setLecturasAnteriores] = useState<Record<string, string>>({});

  const parseNum = (s: string) => {
    const limpio = s.replace(/[^\d.,-]/g, "");
    if (limpio.includes(",") && limpio.includes(".")) return parseFloat(limpio.replace(/\./g, "").replace(",", "."));
    if (limpio.includes(",")) return parseFloat(limpio.replace(",", "."));
    return parseFloat(limpio) || 0;
  };

  function etiquetaUnidad(u: UnidadGas) {
    if (u.esEspacioComun) return "Pileta (espacio común)";
    return `${u.torre === "GRANDE" ? "TG" : "TC"} ${u.piso}º${u.depto} — ${u.titular}`;
  }

  function exportarExcel() {
    const filasFacturas = [
      { Concepto: "Factura Torre Grande", Monto: facturaGrande ? parseNum(facturaGrande) : "" },
      { Concepto: "Factura Torre Chica", Monto: facturaChica ? parseNum(facturaChica) : "" },
    ];

    const filasLecturas = unidades.map((u) => ({
      UnidadId: u.id,
      Torre: u.esEspacioComun ? "-" : u.torre === "GRANDE" ? "Grande" : "Chica",
      Piso: u.esEspacioComun ? "-" : u.piso,
      Depto: u.esEspacioComun ? "-" : u.depto,
      Titular: u.esEspacioComun ? "Pileta (espacio común)" : u.titular,
      "Lectura anterior": u.lecturaAnteriorTieneHistorial
        ? u.lecturaAnterior
        : lecturasAnteriores[u.id]
          ? parseNum(lecturasAnteriores[u.id])
          : "",
      "Lectura actual": lecturas[u.id] ? parseNum(lecturas[u.id]) : "",
    }));

    const wb = XLSX.utils.book_new();

    const wsFacturas = XLSX.utils.json_to_sheet(filasFacturas);
    wsFacturas["!cols"] = [{ wch: 26 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsFacturas, "Facturas");

    const wsLecturas = XLSX.utils.json_to_sheet(filasLecturas);
    wsLecturas["!cols"] = [{ wch: 26 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 28 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsLecturas, "Lecturas");

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `gas_${fecha}.xlsx`);
  }

  async function importarExcel(file: File) {
    setError("");
    setAviso("");
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      const wsFacturas = wb.Sheets["Facturas"];
      if (wsFacturas) {
        const filas: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wsFacturas);
        const grande = filas.find((f) => String(f.Concepto).toLowerCase().includes("grande"));
        const chica = filas.find((f) => String(f.Concepto).toLowerCase().includes("chica"));
        if (grande && grande.Monto !== undefined && grande.Monto !== "") setFacturaGrande(String(grande.Monto));
        if (chica && chica.Monto !== undefined && chica.Monto !== "") setFacturaChica(String(chica.Monto));
      }

      const wsLecturas = wb.Sheets["Lecturas"];
      if (!wsLecturas) {
        setError(
          "El Excel no tiene una pestaña 'Lecturas'. Usá el archivo tal como lo exportaste, sin renombrar las pestañas."
        );
        return;
      }
      const filas: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wsLecturas);

      setLecturas((prev) => {
        const nuevo = { ...prev };
        for (const f of filas) {
          const id = String(f.UnidadId ?? "");
          if (!id) continue;
          const valor = f["Lectura actual"];
          if (valor !== undefined && valor !== "") nuevo[id] = String(valor);
        }
        return nuevo;
      });

      setLecturasAnteriores((prev) => {
        const nuevo = { ...prev };
        for (const f of filas) {
          const id = String(f.UnidadId ?? "");
          if (!id) continue;
          const unidad = unidades.find((u) => u.id === id);
          if (unidad?.lecturaAnteriorTieneHistorial) continue; // esa columna se ignora, ya hay historial
          const valor = f["Lectura anterior"];
          if (valor !== undefined && valor !== "") nuevo[id] = String(valor);
        }
        return nuevo;
      });

      setAviso("Datos del Excel cargados. Revisá los valores abajo antes de calcular.");
    } catch (e) {
      console.error("[importarExcel] Error leyendo el archivo:", e);
      setError("No se pudo leer ese archivo. Verificá que sea el .xlsx exportado desde esta misma pantalla.");
    }
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
              const valorActual = lecturas[u.id] ?? "";
              const valorAnterior = u.lecturaAnteriorTieneHistorial
                ? String(u.lecturaAnterior)
                : lecturasAnteriores[u.id] ?? "";
              const anteriorNum = valorAnterior !== "" && !isNaN(Number(valorAnterior)) ? Number(valorAnterior) : null;
              const consumo =
                valorActual !== "" && !isNaN(Number(valorActual)) && anteriorNum !== null
                  ? Number(valorActual) - anteriorNum
                  : null;
              return (
                <tr key={u.id}>
                  <td>{etiquetaUnidad(u)}</td>
                  <td>
                    <input type="hidden" name="lecturaUnidadId" value={u.id} />
                    {u.lecturaAnteriorTieneHistorial ? (
                      <>
                        <input type="hidden" name="lecturaAnteriorInicial" value="" />
                        <span className="text-gray-500">{u.lecturaAnterior.toLocaleString("es-AR")}</span>
                      </>
                    ) : (
                      <input
                        name="lecturaAnteriorInicial"
                        value={valorAnterior}
                        onChange={(e) => setLecturasAnteriores((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        inputMode="decimal"
                        placeholder="Primera lectura"
                        className="w-24"
                        title="Sin historial todavía: cargá acá la lectura del medidor al inicio del período."
                      />
                    )}
                  </td>
                  <td>
                    <input
                      name="lecturaActual"
                      value={valorActual}
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

      <div className="card flex flex-wrap items-center gap-3">
        <button type="button" onClick={exportarExcel} className="btn btn-secondary text-sm">
          Exportar a Excel
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-secondary text-sm">
          Importar desde Excel
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importarExcel(file);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-gray-500">
          Exportá, completá las lecturas en Excel, y volvé a importar el mismo archivo. Los valores se cargan abajo
          para que los revises antes de calcular — todavía no se guarda nada.
        </p>
      </div>

      {aviso && <p className="text-sm text-brand-700">{aviso}</p>}

      <div className="card grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">Factura de gas — Torre Grande</label>
          <input
            name="facturaGasTorreGrande"
            value={facturaGrande}
            onChange={(e) => setFacturaGrande(e.target.value)}
            placeholder="Monto de la factura"
            inputMode="decimal"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Factura de gas — Torre Chica</label>
          <input
            name="facturaGasTorreChica"
            value={facturaChica}
            onChange={(e) => setFacturaChica(e.target.value)}
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
