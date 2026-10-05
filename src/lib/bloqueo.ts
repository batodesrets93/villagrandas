import { prisma } from "@/lib/prisma";

/**
 * Bloqueo de períodos de expensas (PeriodoExpensa.cerrado).
 *
 * Una vez que el admin bloquea un período, ya no se puede tocar nada que
 * cambie sus números: editar categorías, recalcular gas, corregir
 * calefacción o ajustes, registrar/eliminar pagos, importar pagos,
 * subir/borrar comprobantes ni eliminar el período. El objetivo es que el
 * mes anterior quede "congelado" y que un retoque posterior no cambie el
 * saldo que ya se arrastró al período siguiente.
 *
 * Los pagos que un propietario informe sobre un período bloqueado se
 * imputan, al confirmarlos, en la liquidación abierta más reciente de esa
 * unidad (ver confirmarPagoInformado en calculo.ts).
 *
 * El admin puede desbloquearlo desde la web (con doble confirmación).
 */
export class PeriodoBloqueadoError extends Error {
  constructor(etiqueta?: string) {
    super(
      `El período${etiqueta ? ` "${etiqueta}"` : ""} está bloqueado: no se puede modificar. ` +
        "Si realmente hace falta corregir algo, desbloquealo primero desde Expensas."
    );
    this.name = "PeriodoBloqueadoError";
  }
}

export function esPeriodoBloqueadoError(e: unknown): e is PeriodoBloqueadoError {
  return e instanceof Error && e.name === "PeriodoBloqueadoError";
}

export async function asegurarPeriodoAbierto(periodoId: string) {
  const periodo = await prisma.periodoExpensa.findUnique({
    where: { id: periodoId },
    select: { cerrado: true, etiqueta: true },
  });
  if (periodo?.cerrado) throw new PeriodoBloqueadoError(periodo.etiqueta);
}

export async function asegurarCargoAbierto(cargoId: string) {
  const cargo = await prisma.cargoUnidadPeriodo.findUnique({
    where: { id: cargoId },
    select: { periodo: { select: { cerrado: true, etiqueta: true } } },
  });
  if (cargo?.periodo.cerrado) throw new PeriodoBloqueadoError(cargo.periodo.etiqueta);
}
