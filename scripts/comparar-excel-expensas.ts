import * as XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";

// Uso: npx tsx scripts/comparar-excel-expensas.ts "Agosto/2026" "C:\ruta\Expensas 82026 1.xlsx"
// Compara, depto por depto, el "A pagar" del Excel de expensas contra el
// saldoActual calculado por el sistema para ese mismo periodo, sin necesidad
// de entrar a la app. Imprime solo las diferencias (tolerancia $1 por redondeo).

const TOLERANCIA = 1; // pesos

async function main() {
  const etiqueta = process.argv[2];
  const excelPath = process.argv[3];
  if (!etiqueta || !excelPath) {
    console.error('Uso: npx tsx scripts/comparar-excel-expensas.ts "Agosto/2026" "ruta al excel.xlsx"');
    process.exit(1);
  }

  // --- 1. Traer del sistema el detalle del periodo ---
  const periodo = await prisma.periodoExpensa.findFirst({
    where: { etiqueta: { contains: etiqueta, mode: "insensitive" } },
    orderBy: { fechaInicio: "desc" },
  });
  if (!periodo) {
    console.error("No se encontro un periodo que contenga:", etiqueta);
    const todos = await prisma.periodoExpensa.findMany({ select: { etiqueta: true } });
    console.error("Periodos disponibles:", todos.map((p) => p.etiqueta));
    process.exit(1);
  }

  const cargos = await prisma.cargoUnidadPeriodo.findMany({
    where: { periodoId: periodo.id },
    include: { unidad: true },
  });

  // torre+piso -> saldoActual segun el sistema
  const sistemaPorPiso = new Map<string, { saldoActual: number; depto: string; titular: string }>();
  for (const c of cargos) {
    const key = `${c.unidad.torre}|${c.unidad.piso}`;
    sistemaPorPiso.set(key, {
      saldoActual: c.saldoActual,
      depto: c.unidad.depto,
      titular: c.unidad.titular,
    });
  }

  // --- 2. Leer el Excel, hoja EXPENSAS ---
  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets["EXPENSAS"];
  if (!ws) {
    console.error('No se encontro la hoja "EXPENSAS" en el excel.');
    process.exit(1);
  }
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  // Columnas (0-indexed), segun el layout estandar de la hoja EXPENSAS:
  const COL_TORRE = 0;
  const COL_PISO = 1;
  const COL_DEPTO = 2;
  const COL_TITULAR = 3;
  const COL_A_PAGAR = 30;

  let torreActual = "";
  const excelPorPiso = new Map<string, { aPagar: number; depto: string; titular: string; torre: string }>();

  // Los datos empiezan en la fila con headers "TORRE" (fila index 1 en el dump
  // que vimos), los datos reales arrancan en la fila siguiente.
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i][COL_TORRE] === "TORRE") { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) {
    console.error('No se encontro la fila de encabezados ("TORRE") en la hoja EXPENSAS.');
    process.exit(1);
  }

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const piso = row[COL_PISO];
    const depto = row[COL_DEPTO];
    if (!piso || !depto) continue; // fin de la tabla o fila vacia
    if (row[COL_TORRE]) {
      torreActual = String(row[COL_TORRE]).toUpperCase().includes("CHICA") ? "CHICA" : "GRANDE";
    }
    const aPagar = Number(row[COL_A_PAGAR]) || 0;
    excelPorPiso.set(`${torreActual}|${String(piso).trim()}`, {
      aPagar,
      depto: String(depto),
      titular: String(row[COL_TITULAR] || ""),
      torre: torreActual,
    });
  }

  // --- 3. Comparar ---
  const diferencias: string[] = [];
  const keys = new Set([...sistemaPorPiso.keys(), ...excelPorPiso.keys()]);
  let comparados = 0;

  for (const key of keys) {
    const sis = sistemaPorPiso.get(key);
    const exc = excelPorPiso.get(key);
    if (!sis && exc) {
      diferencias.push(`FALTA EN SISTEMA  -> ${key} (${exc.depto} - ${exc.titular}): excel A pagar = ${exc.aPagar.toFixed(2)}`);
      continue;
    }
    if (sis && !exc) {
      diferencias.push(`FALTA EN EXCEL    -> ${key} (${sis.depto} - ${sis.titular}): sistema saldoActual = ${sis.saldoActual.toFixed(2)}`);
      continue;
    }
    if (sis && exc) {
      comparados++;
      const diff = Math.abs(sis.saldoActual - exc.aPagar);
      if (diff > TOLERANCIA) {
        diferencias.push(
          `DIFERENCIA -> ${key} (${sis.depto} - ${sis.titular}): sistema = $${sis.saldoActual.toFixed(2)} | excel = $${exc.aPagar.toFixed(2)} | diff = $${diff.toFixed(2)}`
        );
      }
    }
  }

  console.log(`Periodo: ${periodo.etiqueta}`);
  console.log(`Unidades comparadas: ${comparados}`);
  if (diferencias.length === 0) {
    console.log("✔ Todos los montos coinciden (dentro de $" + TOLERANCIA + " de tolerancia por redondeo).");
  } else {
    console.log(`✘ Se encontraron ${diferencias.length} diferencias:\n`);
    for (const d of diferencias) console.log(" - " + d);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
