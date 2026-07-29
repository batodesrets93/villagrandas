import { prisma } from "@/lib/prisma";

const PERIODOS_EVOLUCION = 6;
const TOP_DEUDORES = 5;

export type PuntoEvolucion = {
  periodoId: string;
  etiqueta: string;
  deudaTotal: number;
};

/**
 * Deuda total (suma de saldoActual de todos los cargos) de los últimos N
 * períodos liquidados, en orden cronológico ascendente para graficar.
 * Incluye unidades del desarrollador: es un total de la administración,
 * no un ranking de propietarios.
 */
export async function getEvolucionMorosidad(cantidad = PERIODOS_EVOLUCION): Promise<PuntoEvolucion[]> {
  const periodos = await prisma.periodoExpensa.findMany({
    orderBy: { fechaInicio: "desc" },
    take: cantidad,
    include: { cargos: { select: { saldoActual: true } } },
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
          saldoActual: { gt: 0 },
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
