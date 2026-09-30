import { prisma } from "@/lib/prisma";

const PERIODOS_EVOLUCION = 6;
const TOP_DEUDORES = 5;

export type PuntoEvolucion = {
  periodoId: string;
  etiqueta: string;
  deudaTotal: number;
};

/**
 * Deuda total (suma de saldoActual positivos; los saldos a favor no compensan) de los últimos N
 * períodos liquidados, en orden cronológico ascendente para graficar.
 * Excluye las unidades del desarrollador (esDesarrollador = true, hoy Costa
 * Tranvial): su saldo no es deuda de propietarios del consorcio.
 */
export async function getEvolucionMorosidad(cantidad = PERIODOS_EVOLUCION): Promise<PuntoEvolucion[]> {
  const periodos = await prisma.periodoExpensa.findMany({
    orderBy: { fechaInicio: "desc" },
    take: cantidad,
    include: { cargos: { where: { unidad: { esDesarrollador: false }, saldoActual: { gt: 0.01 } }, select: { saldoActual: true } } },
  });

  return periodos
    .map((p) => ({
      periodoId: p.id,
      etiqueta: p.etiqueta,
      deudaTotal: p.cargos.reduce((acc, c) => acc + c.saldoActual, 0),
    }))
    .reverse();
}

export type Deudor = {
  unidadId: string;
  torre: "GRANDE" | "CHICA";
  piso: string;
  depto: string;
  titular: string;
  saldoActual: number;
};

/**
 * Top deudores del último período liquidado. Excluye siempre las unidades
 * marcadas como esDesarrollador=true (son del edificio, no propietarios
 * reales, y no tiene sentido exponerlas en un ranking de morosidad).
 */
export async function getTopDeudores(cantidad = TOP_DEUDORES): Promise<{ etiqueta: string | null; deudores: Deudor[] }> {
  const ultimoPeriodo = await prisma.periodoExpensa.findFirst({
    orderBy: { fechaInicio: "desc" },
    include: {
      cargos: {
        where: {
          saldoActual: { gte: 1000 },
          unidad: { esDesarrollador: false },
        },
        orderBy: { saldoActual: "desc" },
        take: cantidad,
        include: { unidad: true },
      },
    },
  });

  if (!ultimoPeriodo) return { etiqueta: null, deudores: [] };

  return {
    etiqueta: ultimoPeriodo.etiqueta,
    deudores: ultimoPeriodo.cargos.map((c) => ({
      unidadId: c.unidad.id,
      torre: c.unidad.torre,
      piso: c.unidad.piso,
      depto: c.unidad.depto,
      titular: c.unidad.titular,
      saldoActual: c.saldoActual,
    })),
  };
}
