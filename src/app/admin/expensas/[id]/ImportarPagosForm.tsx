"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { registrarPagosMasivoAction } from "@/lib/actions";

type CargoPago = {
  id: string;
  torre: "GRANDE" | "CHICA";
  piso: string;
  depto: string;
  titular: string;
  saldoActual: number;
};

function parseNum(s: string) {
  const limpio = s.replace(/[^\d.,-]/g, "");
  if (limpio.includes(",") && limpio.includes(".")) return parseFloat(limpio.replace(/\./g, "").replace(",", "."));
  if (limpio.includes(",")) return parseFloat(limpio.replace(",", "."));
  return parseFloat(limpio) || 0;
}

export default function ImportarPagosForm({ cargos }: { cargos: CargoPago[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  function etiquetaUnidad(c: CargoPago) {
    return `${c.torre === "GRANDE" ? "TG" : "TC"} ${c.piso}º${c.depto}`;
  }

  function exportarExcel() {
    const filas = cargos.map((c) => ({
      CargoId: c.id,
      Unidad: etiquetaUnidad(c),
      Titular: c.titular,
      "Saldo actual": c.saldoActual,
      Monto: "",
      Fecha: "",
      Medio: "",
      Nota: "",
    }));

    const ws = XLSX.utils.json_to_sheet(filas);
    ws["!cols"] = [
      { wch: 26 },
      { wch: 10 },
      { wch: 28 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 24 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `pagos_${fecha}.xlsx`);
  }

  async function importarExcel(file: File) {
    setError("");
    setAviso("");
    setCargando(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets["Pagos"];
      if (!ws) {
        setError(
          "El Excel no tiene una pestaña 'Pagos'. Usá el archivo tal como lo exportaste, sin renombrar las pestañas."
        );
        setCargando(false);
        return;
      }

      const filas: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
      const cargoIdsValidos = new Set(cargos.map((c) => c.id));

      const pagos: { cargoId: string; monto: number; fecha?: string; medio?: string; nota?: string }[] = [];
      let filasConMontoIgnoradas = 0;

      for (const f of filas) {
        const cargoId = String(f.CargoId ?? "").trim();
        if (!cargoId || !cargoIdsValidos.has(cargoId)) continue;

        const montoRaw = f.Monto;
        if (montoRaw === undefined || montoRaw === "" || montoRaw === null) continue;
        const monto = typeof montoRaw === "number" ? montoRaw : parseNum(String(montoRaw));
        if (!monto || monto <= 0) {
          filasConMontoIgnoradas++;
          continue;
        }

        const fechaRaw = f.Fecha;
        let fechaIso: string | undefined;
        if (fechaRaw instanceof Date) {
          fechaIso = fechaRaw.toISOString();
        } else if (typeof fechaRaw === "number") {
          // Excel guarda las fechas como número de serie de días.
          const fechaExcel = XLSX.SSF.parse_date_code(fechaRaw);
          if (fechaExcel) {
            fechaIso = new Date(fechaExcel.y, fechaExcel.m - 1, fechaExcel.d).toISOString();
          }
        } else if (typeof fechaRaw === "string" && fechaRaw.trim() !== "") {
          const partes = fechaRaw.trim().split(/[/-]/);
          if (partes.length === 3) {
            // Se acepta dd/mm/aaaa (formato argentino) o aaaa-mm-dd.
            const [a, b, c] = partes;
            const d = a.length === 4 ? new Date(Number(a), Number(b) - 1, Number(c)) : new Date(Number(c), Number(b) - 1, Number(a));
            if (!isNaN(d.getTime())) fechaIso = d.toISOString();
          }
        }

        pagos.push({
          cargoId,
          monto,
          fecha: fechaIso,
          medio: f.Medio ? String(f.Medio) : undefined,
          nota: f.Nota ? String(f.Nota) : undefined,
        });
      }

      if (pagos.length === 0) {
        setError(
          filasConMontoIgnoradas > 0
            ? "Ninguna fila tiene un monto válido (mayor a 0) para registrar."
            : "No se encontró ninguna fila con la columna Monto completa. Completá el Excel exportado y volvé a importarlo."
        );
        setCargando(false);
        return;
      }

      const resultado = await registrarPagosMasivoAction(pagos);
      if (!resultado.ok) {
        setError(resultado.error);
        setCargando(false);
        return;
      }

      let mensaje = `Se registraron ${resultado.data.cantidad} pago${resultado.data.cantidad === 1 ? "" : "s"}.`;
      if (resultado.data.omitidos > 0) {
        mensaje += ` Se omitieron ${resultado.data.omitidos} fila${resultado.data.omitidos === 1 ? "" : "s"} (sin monto, o con error).`;
      }
      setAviso(mensaje);
      setCargando(false);
      router.refresh();
    } catch (e) {
      console.error("[importarExcel pagos] Error leyendo el archivo:", e);
      setError("No se pudo leer ese archivo. Verificá que sea el .xlsx exportado desde esta misma pantalla.");
      setCargando(false);
    }
  }

  return (
    <div className="card flex flex-wrap items-center gap-3">
      <button type="button" onClick={exportarExcel} className="btn btn-secondary text-sm">
        Exportar pagos a Excel
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={cargando}
        className="btn btn-secondary text-sm"
      >
        {cargando ? "Importando..." : "Importar pagos desde Excel"}
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
      <p className="text-xs text-gray-500 basis-full sm:basis-auto">
        Exportá, completá la columna Monto (y opcionalmente Fecha, Medio y Nota) para cada unidad que pagó, y volvé
        a importar el mismo archivo. Las filas sin Monto se ignoran, así que no hace falta borrar las que no
        aplican.
      </p>
      {aviso && <p className="text-sm text-brand-700 basis-full">{aviso}</p>}
      {error && <p className="text-sm text-red-600 basis-full">{error}</p>}
    </div>
  );
}
