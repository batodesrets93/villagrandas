import { prisma } from "@/lib/prisma";

export const MONTO_QUINCHO = 50000;

type CategoriaInput = {
  nombre: string;
  monto: number;
  esFondoReserva?: boolean;
};

/**
 * Crea un período de expensas y calcula automáticamente el cargo de cada
 * unidad: gasto común (prorrateado por coeficiente), cochera/baulera fijas,
 * quincho (reservas confirmadas y no facturadas todavia) y arrastra el saldo
 * anterior de la última liquidación cerrada de cada unidad.
 */
export async function crearPeriodoYCalcular(params: {
  etiqueta: string;
  fechaInicio: Date;
  fechaFin: Date;
  vencimiento: Date;
  categorias: CategoriaInput[];
}) {
  const totalGastos = params.categorias.reduce((acc, c) => acc + c.monto, 0);

  return prisma.$transaction(async (tx) => {
    const periodo = await tx.periodoExpensa.create({
      data: {
        etiqueta: params.etiqueta,
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
        vencimiento: params.vencimiento,
        totalGastos,
        gastos: {
          create: params.categorias.map((c, i) => ({
            nombre: c.nombre,
            monto: c.monto,
            esFondoReserva: c.esFondoReserva ?? false,
            orden: i,
          })),
        },
      },
    });

    const unidades = await tx.unidad.findMany({ orderBy: [{ torre: "asc" }, { piso: "asc" }, { depto: "asc" }] });

    // Reservas confirmadas que todavia no fueron facturadas a ningun periodo
    const reservasPendientes = await tx.reserva.findMany({
      where: { estado: "CONFIRMADA", cargoId: null },
    });
    const quinchoPorUnidad = new Map<string, string[]>();
    for (const r of reservasPendientes) {
      const lista = quinchoPorUnidad.get(r.unidadId) ?? [];
      lista.push(r.id);
      quinchoPorUnidad.set(r.unidadId, lista);
    }

    for (const unidad of unidades) {
      const ultimoCargoAnterior = await tx.cargoUnidadPeriodo.findFirst({
        where: { unidadId: unidad.id },
        orderBy: { periodo: { fechaInicio: "desc" } },
      });
      const saldoAnterior = ultimoCargoAnterior ? ultimoCargoAnterior.saldoActual : 0;

      const gastoComun = totalGastos * unidad.coeficiente;
      const cochera = unidad.cocheraMonto;
      const baulera = unidad.bauleraMonto;
      const reservaIds = quinchoPorUnidad.get(unidad.id) ?? [];
      const quincho = reservaIds.length * MONTO_QUINCHO;
      const calefaccion = 0; // se completa manualmente luego (es por consumo)

      const total = gastoComun + cochera + baulera + quincho + calefaccion;
      const saldoActual = total + saldoAnterior;

      const cargo = await tx.cargoUnidadPeriodo.create({
        data: {
          periodoId: periodo.id,
          unidadId: unidad.id,
          gastoComun,
          cochera,
          baulera,
          quincho,
          calefaccion,
          total,
          saldoAnterior,
          totalPagado: 0,
          saldoActual,
        },
      });

      if (reservaIds.length > 0) {
        await tx.reserva.updateMany({
          where: { id: { in: reservaIds } },
          data: { cargoId: cargo.id },
        });
      }
    }

    return periodo;
  });
}

export async function registrarPago(cargoId: string, monto: number, medio?: string, nota?: string) {
  return prisma.$transaction(async (tx) => {
    await tx.pago.create({ data: { cargoId, monto, medio, nota } });
    const pagos = await tx.pago.aggregate({ where: { cargoId }, _sum: { monto: true } });
    const totalPagado = pagos._sum.monto ?? 0;
    const cargo = await tx.cargoUnidadPeriodo.findUniqueOrThrow({ where: { id: cargoId } });
    const saldoActual = cargo.total + cargo.saldoAnterior - totalPagado;
    return tx.cargoUnidadPeriodo.update({
      where: { id: cargoId },
      data: { totalPagado, saldoActual },
    });
  });
}

export async function actualizarCalefaccion(cargoId: string, calefaccion: number) {
  const cargo = await prisma.cargoUnidadPeriodo.findUniqueOrThrow({ where: { id: cargoId } });
  const total = cargo.gastoComun + cargo.cochera + cargo.baulera + cargo.quincho + calefaccion;
  const saldoActual = total + cargo.saldoAnterior - cargo.totalPagado;
  return prisma.cargoUnidadPeriodo.update({
    where: { id: cargoId },
    data: { calefaccion, total, saldoActual },
  });
}
