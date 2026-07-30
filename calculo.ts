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
 * unidad: gasto común (prorrateado por coeficiente), cochera y baulera
 * (prorrateadas por su propio m2 sobre el m2 total del edificio, con la
 * misma lógica y la misma bolsa de gastos que el gasto común), quincho
 * (reservas confirmadas y no facturadas todavia) y arrastra el saldo
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
  // m2 total del edificio = deptos + cocheras + baulera juntos. Cochera y
  // baulera se prorratean con este total (no con el m2 de los deptos solo),
  // exactamente igual que en el Excel de expensas.
  const totalM2Edificio = unidades.reduce(
    (acc, u) => acc + u.m2 + u.cocheraM2 + u.bauleraM2,
    0
  );

  const cargosData = unidades.map((unidad) => {
    const saldoAnterior = saldoAnteriorPorUnidad.get(unidad.id) ?? 0;
    const gastoComun = totalGastos * unidad.coeficiente;
    const coeficienteCochera = totalM2Edificio > 0 ? unidad.cocheraM2 / totalM2Edificio : 0;
    const coeficienteBaulera = totalM2Edificio > 0 ? unidad.bauleraM2 / totalM2Edificio : 0;
    const cochera = totalGastos * coeficienteCochera;
    const baulera = totalGastos * coeficienteBaulera;
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

/**
 * Recalcula un período YA EXISTENTE con nuevas categorías de gasto, en vez
 * de crear uno nuevo. Gasto común, cochera y baulera se vuelven a calcular
 * con el nuevo total de gastos (las tres se prorratean con el mismo total).
 * Se mantienen intactos: quincho, calefacción, saldo anterior y los pagos
 * ya registrados de cada unidad.
 */
export async function actualizarPeriodoYCalcular(
  periodoId: string,
  params: {
    etiqueta: string;
    fechaInicio: Date;
    fechaFin: Date;
    vencimiento: Date;
    categorias: CategoriaInput[];
  }
) {
  const totalGastos = params.categorias.reduce((acc, c) => acc + c.monto, 0);

  await prisma.periodoExpensa.update({
    where: { id: periodoId },
    data: {
      etiqueta: params.etiqueta,
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
      vencimiento: params.vencimiento,
      totalGastos,
    },
  });

  // Las categorías se reconcilian por nombre (en vez de borrar todo y
  // recrear) para no perder los comprobantes ya subidos a una categoría que
  // sigue existiendo, aunque haya cambiado de monto u orden. Si el admin
  // cambia el nombre de una categoría, se trata como una categoría nueva
  // (y la anterior, con sus comprobantes, se elimina) porque no hay otra
  // forma de saber que es "la misma" fila.
  const existentes = await prisma.gastoCategoria.findMany({ where: { periodoId } });
  const existentesPorNombre = new Map(existentes.map((g) => [g.nombre.trim().toLowerCase(), g]));
  const idsConservados = new Set<string>();

  for (const [i, c] of params.categorias.entries()) {
    const clave = c.nombre.trim().toLowerCase();
    const existente = existentesPorNombre.get(clave);
    if (existente && !idsConservados.has(existente.id)) {
      await prisma.gastoCategoria.update({
        where: { id: existente.id },
        data: { monto: c.monto, esFondoReserva: c.esFondoReserva ?? false, orden: i },
      });
      idsConservados.add(existente.id);
    } else {
      const nueva = await prisma.gastoCategoria.create({
        data: {
          periodoId,
          nombre: c.nombre,
          monto: c.monto,
          esFondoReserva: c.esFondoReserva ?? false,
          orden: i,
        },
      });
      idsConservados.add(nueva.id);
    }
  }

  const idsAEliminar = existentes.filter((g) => !idsConservados.has(g.id)).map((g) => g.id);
  if (idsAEliminar.length > 0) {
    await prisma.gastoCategoria.deleteMany({ where: { id: { in: idsAEliminar } } });
  }

  // m2 total del edificio (deptos + cocheras + baulera), igual criterio que
  // en crearPeriodoYCalcular, para poder prorratear cochera/baulera.
  const agregadoM2 = await prisma.unidad.aggregate({
    _sum: { m2: true, cocheraM2: true, bauleraM2: true },
  });
  const totalM2Edificio =
    (agregadoM2._sum.m2 ?? 0) +
    (agregadoM2._sum.cocheraM2 ?? 0) +
    (agregadoM2._sum.bauleraM2 ?? 0);
  // Evitar división por cero si todavia no hay unidades cargadas.
  const gastoPorM2 = totalM2Edificio > 0 ? totalGastos / totalM2Edificio : 0;

  // Recalcula gasto común, cochera, baulera y el total de las 79 unidades en
  // UNA sola consulta SQL (en vez de una actualización por unidad), para no
  // repetir el problema de lentitud que causaba el timeout al crear un
  // período.
  await prisma.$executeRaw`
    UPDATE "CargoUnidadPeriodo" AS c
    SET
      "gastoComun" = ${totalGastos} * u."coeficiente",
      "cochera" = ${gastoPorM2} * u."cocheraM2",
      "baulera" = ${gastoPorM2} * u."bauleraM2",
      "total" = (${totalGastos} * u."coeficiente") + (${gastoPorM2} * u."cocheraM2") + (${gastoPorM2} * u."bauleraM2") + c."quincho" + c."calefaccion",
      "saldoActual" = ((${totalGastos} * u."coeficiente") + (${gastoPorM2} * u."cocheraM2") + (${gastoPorM2} * u."bauleraM2") + c."quincho" + c."calefaccion")
                       + c."saldoAnterior" - c."totalPagado"
    FROM "Unidad" AS u
    WHERE c."unidadId" = u."id" AND c."periodoId" = ${periodoId}
  `;
}
