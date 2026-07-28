import { randomUUID } from "crypto";
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
 * anterior de la última liquidación de cada unidad.
 *
 * IMPORTANTE: con 79 unidades, hacer una consulta a la base POR UNIDAD (como
 * en la version anterior) significa mas de 150 idas y vueltas secuenciales a
 * la base, lo que puede superar el tiempo maximo que Vercel le da a una
 * accion de servidor. Por eso aca se resuelve todo con un puñado de
 * consultas agrupadas (traer todo de una, calcular en memoria, e insertar
 * todo junto con createMany).
 */
export async function crearPeriodoYCalcular(params: {
  etiqueta: string;
  fechaInicio: Date;
  fechaFin: Date;
  vencimiento: Date;
  categorias: CategoriaInput[];
}) {
  const totalGastos = params.categorias.reduce((acc, c) => acc + c.monto, 0);

  // 1) Traer todo lo necesario en pocas consultas (fuera de la transaccion,
  //    son solo lecturas).
  const unidades = await prisma.unidad.findMany({
    orderBy: [{ torre: "asc" }, { piso: "asc" }, { depto: "asc" }],
  });

  const reservasPendientes = await prisma.reserva.findMany({
    where: { estado: "CONFIRMADA", cargoId: null },
    select: { id: true, unidadId: true },
  });
  const quinchoPorUnidad = new Map<string, string[]>();
  for (const r of reservasPendientes) {
    const lista = quinchoPorUnidad.get(r.unidadId) ?? [];
    lista.push(r.id);
    quinchoPorUnidad.set(r.unidadId, lista);
  }

  // Saldo anterior de cada unidad: se trae UNA sola consulta con todos los
  // cargos existentes (ordenados por fecha del periodo, mas reciente primero)
  // y se toma el primero que aparezca para cada unidad.
  const cargosPrevios = await prisma.cargoUnidadPeriodo.findMany({
    select: { unidadId: true, saldoActual: true },
    orderBy: { periodo: { fechaInicio: "desc" } },
  });
  const saldoAnteriorPorUnidad = new Map<string, number>();
  for (const c of cargosPrevios) {
    if (!saldoAnteriorPorUnidad.has(c.unidadId)) {
      saldoAnteriorPorUnidad.set(c.unidadId, c.saldoActual);
    }
  }

  // 2) Calcular todo en memoria (rapido, no toca la base).
  const cargosData = unidades.map((unidad) => {
    const saldoAnterior = saldoAnteriorPorUnidad.get(unidad.id) ?? 0;
    const gastoComun = totalGastos * unidad.coeficiente;
    const cochera = unidad.cocheraMonto;
    const baulera = unidad.bauleraMonto;
    const reservaIds = quinchoPorUnidad.get(unidad.id) ?? [];
    const quincho = reservaIds.length * MONTO_QUINCHO;
    const calefaccion = 0; // se completa a mano despues, es por consumo

    const total = gastoComun + cochera + baulera + quincho + calefaccion;
    const saldoActual = total + saldoAnterior;

    return {
      id: randomUUID(),
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
      reservaIds,
    };
  });

  // 3) Escribir todo junto, en pocas consultas dentro de la transaccion.
  const periodo = await prisma.$transaction(
    async (tx) => {
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

      // Una sola consulta para insertar los 79 cargos, en vez de 79 consultas.
      await tx.cargoUnidadPeriodo.createMany({
        data: cargosData.map((c) => ({
          id: c.id,
          periodoId: periodo.id,
          unidadId: c.unidadId,
          gastoComun: c.gastoComun,
          cochera: c.cochera,
          baulera: c.baulera,
          quincho: c.quincho,
          calefaccion: c.calefaccion,
          total: c.total,
          saldoAnterior: c.saldoAnterior,
          totalPagado: c.totalPagado,
          saldoActual: c.saldoActual,
        })),
      });

      // Vincular las reservas de quincho ya facturadas con su cargo (solo
      // las unidades que efectivamente tenian reservas pendientes).
      for (const c of cargosData) {
        if (c.reservaIds.length > 0) {
          await tx.reserva.updateMany({
            where: { id: { in: c.reservaIds } },
            data: { cargoId: c.id },
          });
        }
      }

      return periodo;
    },
    { timeout: 20000, maxWait: 10000 }
  );

  return periodo;
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