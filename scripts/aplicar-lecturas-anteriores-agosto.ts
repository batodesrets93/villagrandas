import { prisma } from "../src/lib/prisma";
import { calcularGasPeriodo } from "../src/lib/calculo";

/**
 * Corrige la "lectura anterior" de gas de Agosto 2026.
 *
 * Motivo: al calcular el gas de este periodo por primera vez, todas las
 * unidades quedaron con lectura anterior = 0 (nadie cargo la "primera
 * lectura" a mano en /admin/expensas/[id]/gas, campo que solo aparece para
 * unidades sin historial todavia). Eso hizo que el "consumo" usado para
 * repartir el 55% variable de cada factura de gas fuera la lectura ACTUAL
 * completa en vez de (actual - anterior real), lo que distorsiono el
 * reparto entre unidades de forma no proporcional (algunas quedaron
 * pagando de mas, otras de menos).
 *
 * Este script NO toca ninguna formula: solo carga la lectura anterior real
 * de cada unidad (tomada de la hoja "AGUA CALIENTE-ACELF" del excel del
 * administrador, "Expensas 82026.xlsx", columna del 01/07/2026) y vuelve a
 * calcular el gas con calcularGasPeriodo -- la misma funcion que ya usa la
 * pantalla de admin -- usando la factura y la lectura ACTUAL que ya estan
 * guardadas (no se tocan).
 *
 * Se corre una sola vez, a mano, desde una terminal nativa (no funciona
 * desde una VM sin acceso directo a la base):
 *
 *   npx tsx scripts/aplicar-lecturas-anteriores-agosto.ts
 */

// torre|piso|depto -> lectura del medidor al 01/07/2026 (inicio del periodo)
const ANTERIORES: Record<string, number> = {
  "GRANDE|01|A": 0.1,
  "GRANDE|01|B": 0.13,
  "GRANDE|01|C": 0.1,
  "GRANDE|01|D": 0.15,
  "GRANDE|02|A": 0.13,
  "GRANDE|02|B": 0.12,
  "GRANDE|02|C": 0.29,
  "GRANDE|02|D": 399.15,
  "GRANDE|03|A": 0.1,
  "GRANDE|03|B": 1.13,
  "GRANDE|03|C": 280.82,
  "GRANDE|03|D": 0.13,
  "GRANDE|04|A": 224.4,
  "GRANDE|04|B": 691.84,
  "GRANDE|04|C": 652,
  "GRANDE|04|D": 0.1,
  "GRANDE|05|A": 0,
  "GRANDE|05|B": 0,
  "GRANDE|05|C": 0,
  "GRANDE|05|D": 0,
  "GRANDE|06|A": 0.1,
  "GRANDE|06|B": 0.11,
  "GRANDE|06|C": 6.92,
  "GRANDE|06|D": 0.1,
  "GRANDE|07|A": 0.1,
  "GRANDE|07|B": 0.1,
  "GRANDE|07|C": 605.71,
  "GRANDE|07|D": 138.47,
  "GRANDE|08|A": 0.1,
  "GRANDE|08|B": 0.1,
  "GRANDE|08|C": 563.62,
  "GRANDE|08|D": 586.28,
  "GRANDE|09|A": 192.82,
  "GRANDE|09|B": 626.67,
  "GRANDE|09|C": 0.1,
  "GRANDE|09|D": 1788.49,
  "GRANDE|10|A": 0.1,
  "GRANDE|10|B": 43.01,
  "GRANDE|10|C": 183.55,
  "GRANDE|10|D": 693.63,
  "GRANDE|11|A": 0.11,
  "GRANDE|11|B": 0.11,
  "GRANDE|12|A": 100.66,
  "GRANDE|12|B": 174.64,
  "GRANDE|13|A": 306.86,
  "GRANDE|13|B": 22.55,
  "GRANDE|14|A": 691.95,
  "GRANDE|14|B": 706.56,
  "GRANDE|15|A": 134.36,
  "GRANDE|15|B": 1937.1,
  "GRANDE|16|A": 747.75,
  "GRANDE|16|B": 201.59,
  "GRANDE|17|A": 0,
  "GRANDE|18|A": 0,
  "GRANDE|19|A": 39.6,
  "GRANDE|20|A": 1001.15,
  "GRANDE|21|A": 592.25,
  "CHICA|01|A": 3420.85,
  "CHICA|01|B": 4783.7,
  "CHICA|02|A": 9754.42,
  "CHICA|02|B": 2087.93,
  "CHICA|03|A": 591.38,
  "CHICA|03|B": 492.99,
  "CHICA|04|A": 106.09,
  "CHICA|04|B": 3388.64,
  "CHICA|05|A": 101.55,
  "CHICA|05|B": 536.92,
  "CHICA|06|A": 100.11,
  "CHICA|06|B": 5316.15,
  "CHICA|07|A": 99.66,
  "CHICA|07|B": 309.39,
  "CHICA|08|A": 456.68,
  "CHICA|08|B": 7902.37,
  "CHICA|09|B": 6198.45,
  "CHICA|09|A": 2310.98,
  "CHICA|10|B": 552.86,
  "CHICA|10|A": 153.33,
  "CHICA|11|B": 1201.58,
  "CHICA|11|A": 504.58,
};
// La pileta (Torre Grande) tenia lectura 200 al 01/07/2026 segun el mismo excel.
const ANTERIOR_PILETA = 200;

async function main() {
  const periodo = await prisma.periodoExpensa.findFirstOrThrow({
    where: { etiqueta: { contains: "gosto", mode: "insensitive" } },
    orderBy: { fechaInicio: "desc" },
  });

  console.log(`Periodo: ${periodo.etiqueta} (id ${periodo.id})`);
  console.log(`Factura Torre Grande: ${periodo.facturaGasTorreGrande}`);
  console.log(`Factura Torre Chica: ${periodo.facturaGasTorreChica}`);

  const unidades = await prisma.unidad.findMany({
    where: { m2GasPonderado: { not: null } },
    select: { id: true, torre: true, piso: true, depto: true, esEspacioComun: true },
  });

  const lecturasActuales = await prisma.lecturaGas.findMany({
    where: { periodoId: periodo.id },
    select: { unidadId: true, lecturaActual: true },
  });
  const actualPorUnidad = new Map(lecturasActuales.map((l) => [l.unidadId, l.lecturaActual]));

  const faltantes: string[] = [];
  const lecturas = unidades.map((u) => {
    const key = `${u.torre}|${u.piso}|${u.depto}`;
    const anteriorInicial = u.esEspacioComun ? ANTERIOR_PILETA : ANTERIORES[key];
    if (anteriorInicial === undefined) {
      faltantes.push(key);
    }
    const actual = actualPorUnidad.get(u.id) ?? 0;
    return { unidadId: u.id, lecturaActual: actual, lecturaAnteriorInicial: anteriorInicial ?? 0 };
  });

  if (faltantes.length > 0) {
    console.error(
      `ABORTADO: no tengo lectura anterior para ${faltantes.length} unidad(es), revisar antes de continuar: ${faltantes.join(", ")}`
    );
    process.exit(1);
  }

  console.log(`Recalculando gas para ${lecturas.length} unidades con lectura anterior real...`);
  await calcularGasPeriodo(periodo.id, {
    facturaGasTorreGrande: periodo.facturaGasTorreGrande,
    facturaGasTorreChica: periodo.facturaGasTorreChica,
    lecturas,
  });
  console.log("Listo. Corre scripts/diagnostico-agosto.ts para verificar los nuevos montos.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
