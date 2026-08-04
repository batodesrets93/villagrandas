import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export const MONTO_QUINCHO = 50000;

type CategoriaInput = {
  nombre: string;
  monto: number;
  esFondoReserva?: boolean;
};

type CargoComplementarioIndividual = {
  id: string;
  monto: number;
  unidadCobradaId: string;
};

/**
 * Trae cocheras y bauleras (cada una es su propia unidad complementaria,
 * con su propio m2) y calcula, para el total de gastos de un período:
 *
 * - el m2 total REAL del edificio: deptos + TODAS las cocheras + TODAS las
 *   bauleras, tengan o no propietario asignado (antes, el m2 de las que no
 *   tenían dueño no se contaba en ningún lado, y directamente no se
 *   cobraban).
 * - la liquidación individual de cada cochera y cada baulera (monto = su
 *   m2 * gasto por m2 del edificio), igual que en las pestañas COCHERAS y
 *   BAULERAS del excel.
 * - a qué unidad se le cobra cada una: a su propietario si tiene uno
 *   asignado, o a la unidad marcada como "esConsolidadaCocheraBaulera"
 *   (hoy, la cuenta consolidada de Costa Tranvial) si todavía no se
 *   asignó.
 */
async function calcularComplementarios(totalGastos: number) {
  const [unidades, cocheras, bauleras] = await Promise.all([
    prisma.unidad.findMany({ select: { id: true, m2: true, esConsolidadaCocheraBaulera: true } }),
    prisma.cochera.findMany({ select: { id: true, m2: true, unidadId: true } }),
    prisma.baulera.findMany({ select: { id: true, m2: true, unidadId: true } }),
  ]);

  const consolidada = unidades.find((u) => u.esConsolidadaCocheraBaulera);
  if (!consolidada) {
    throw new Error(
      "No existe la unidad 'consolidada' para cocheras/bauleras sin asignar " +
        "(esConsolidadaCocheraBaulera = true). Correr el seed antes de generar el período."
    );
  }

  const totalM2Unidades = unidades.reduce((acc, u) => acc + u.m2, 0);
  const totalM2Cocheras = cocheras.reduce((acc, c) => acc + c.m2, 0);
  const totalM2Bauleras = bauleras.reduce((acc, b) => acc + b.m2, 0);
  const totalM2Edificio = totalM2Unidades + totalM2Cocheras + totalM2Bauleras;
  const montoPorM2 = totalM2Edificio > 0 ? totalGastos / totalM2Edificio : 0;

  const cocherasIndividuales: CargoComplementarioIndividual[] = cocheras.map((c) => ({
    id: c.id,
    monto: montoPorM2 * c.m2,
    unidadCobradaId: c.unidadId ?? consolidada.id,
  }));
  const baulerasIndividuales: CargoComplementarioIndividual[] = bauleras.map((b) => ({
    id: b.id,
    monto: montoPorM2 * b.m2,
    unidadCobradaId: b.unidadId ?? consolidada.id,
  }));

  const cocheraPorUnidad = new Map<string, number>();
  for (const c of cocherasIndividuales) {
    cocheraPorUnidad.set(c.unidadCobradaId, (cocheraPorUnidad.get(c.unidadCobradaId) ?? 0) + c.monto);
  }
  const bauleraPorUnidad = new Map<string, number>();
  for (const b of baulerasIndividuales) {
    bauleraPorUnidad.set(b.unidadCobradaId, (bauleraPorUnidad.get(b.unidadCobradaId) ?? 0) + b.monto);
  }

  return {
    totalM2Edificio,
    montoPorM2,
    cocheraPorUnidad,
    bauleraPorUnidad,
    cocherasIndividuales,
    baulerasIndividuales,
  };
}

/** m2 total del edificio (deptos + TODAS las cocheras + TODAS las bauleras). Para PDFs y pantallas que solo necesitan mostrar el % de incidencia. */
export async function calcularTotalM2Edificio(): Promise<number> {
  const [unidadAgg, cocheraAgg, bauleraAgg] = await Promise.all([
    prisma.unidad.aggregate({ _sum: { m2: true } }),
    prisma.cochera.aggregate({ _sum: { m2: true } }),
    prisma.baulera.aggregate({ _sum: { m2: true } }),
  ]);
  return (unidadAgg._sum.m2 ?? 0) + (cocheraAgg._sum.m2 ?? 0) + (bauleraAgg._sum.m2 ?? 0);
}

/**
 * m2 de cochera/baulera asignados a cada unidad (para mostrar en pantallas
 * y PDFs "Cochera: X m² + Baulera: Y m²"). Devuelve un Map por unidadId;
 * las unidades sin espacios asignados simplemente no aparecen (usar ?? 0).
 */
export async function agruparM2ComplementariosPorUnidad(): Promise<
  Map<string, { cocheraM2: number; bauleraM2: number }>
> {
  const [cocheras, bauleras] = await Promise.all([
    prisma.cochera.findMany({ where: { unidadId: { not: null } }, select: { unidadId: true, m2: true } }),
    prisma.baulera.findMany({ where: { unidadId: { not: null } }, select: { unidadId: true, m2: true } }),
  ]);
  const mapa = new Map<string, { cocheraM2: number; bauleraM2: number }>();
  for (const c of cocheras) {
    const actual = mapa.get(c.unidadId!) ?? { cocheraM2: 0, bauleraM2: 0 };
    actual.cocheraM2 += c.m2;
    mapa.set(c.unidadId!, actual);
  }
  for (const b of bauleras) {
    const actual = mapa.get(b.unidadId!) ?? { cocheraM2: 0, bauleraM2: 0 };
    actual.bauleraM2 += b.m2;
    mapa.set(b.unidadId!, actual);
  }
  return mapa;
}

/**
 * Crea un período de expensas y calcula automáticamente el cargo de cada
 * unidad: gasto común (prorrateado por coeficiente), cochera y baulera
 * (cada cochera y cada baulera se liquida individualmente por su propio
 * m2 sobre el m2 total del edificio, y se suma a quien la tenga asignada;
 * las que no tienen dueño se cargan a la cuenta consolidada), quincho
 * (reservas confirmadas y no facturadas todavia) y arrastra el saldo
 * anterior de la última liquidación de cada unidad.
 *
 * IMPORTANTE: con ~80 unidades, hacer una consulta a la base POR UNIDAD (como
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

  const { cocheraPorUnidad, bauleraPorUnidad, cocherasIndividuales, baulerasIndividuales } =
    await calcularComplementarios(totalGastos);

  const reservasPendientes = await prisma.reserva.findMany({
    where: {
      estado: "CONFIRMADA",
      cargoId: null,
      fecha: { gte: params.fechaInicio, lte: params.fechaFin },
    },
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
    const cochera = cocheraPorUnidad.get(unidad.id) ?? 0;
    const baulera = bauleraPorUnidad.get(unidad.id) ?? 0;
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

      // Una sola consulta para insertar los cargos por unidad, en vez de una
      // consulta por unidad.
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

      // Liquidación individual de cada cochera y cada baulera, para poder
      // ver/exportar despues cuánto le tocó pagar a cada espacio (y a quién
      // se le cobró, aunque después se reasigne).
      if (cocherasIndividuales.length > 0) {
        await tx.cargoCocheraPeriodo.createMany({
          data: cocherasIndividuales.map((c) => ({
            periodoId: periodo.id,
            cocheraId: c.id,
            unidadCobradaId: c.unidadCobradaId,
            monto: c.monto,
          })),
        });
      }
      if (baulerasIndividuales.length > 0) {
        await tx.cargoBauleraPeriodo.createMany({
          data: baulerasIndividuales.map((b) => ({
            periodoId: periodo.id,
            bauleraId: b.id,
            unidadCobradaId: b.unidadCobradaId,
            monto: b.monto,
          })),
        });
      }

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

/**
 * Calcula el gas (calefaccion) de un período a partir de las lecturas de
 * medidor de agua caliente de cada unidad (incluida la pileta, marcada con
 * Unidad.esEspacioComun = true) y de las dos facturas del período (Torre
 * Grande y Torre Chica se facturan y reparten por separado).
 *
 * Por cada torre: 45% de la factura es costo fijo (repartido por %incidencia
 * de m2GasPonderado sobre el total de esa torre) y 55% es costo variable
 * (repartido por consumo x %incidencia, sobre la suma de esa misma cuenta
 * de las unidades de esa torre).
 *
 * El resultado de la pileta no se factura a nadie directamente: se agrega
 * como una GastoCategoria mas ("Agua caliente - espacios comunes"), que se
 * reparte entre las 79 unidades por coeficiente, igual que EDEA u OSSE. Por
 * eso, despues de calcular el gas, se recalculan gastoComun/cochera/baulera
 * de todas las unidades (el total de gastos del periodo cambio).
 */
export async function calcularGasPeriodo(
  periodoId: string,
  params: {
    facturaGasTorreGrande: number;
    facturaGasTorreChica: number;
    lecturas: { unidadId: string; lecturaActual: number }[];
  }
) {
  await prisma.periodoExpensa.update({
    where: { id: periodoId },
    data: {
      facturaGasTorreGrande: params.facturaGasTorreGrande,
      facturaGasTorreChica: params.facturaGasTorreChica,
    },
  });

  const periodo = await prisma.periodoExpensa.findUniqueOrThrow({ where: { id: periodoId } });

  const unidades = await prisma.unidad.findMany({
    where: { m2GasPonderado: { not: null } },
    select: { id: true, torre: true, esEspacioComun: true, m2GasPonderado: true },
  });

  // Lectura anterior de cada unidad: la lecturaActual del periodo anterior
  // (el mas reciente antes de este), o 0 si es la primera vez que se le
  // toma lectura. Mismo mecanismo que el arrastre de saldoAnterior.
  const lecturasPrevias = await prisma.lecturaGas.findMany({
    where: { periodo: { fechaInicio: { lt: periodo.fechaInicio } } },
    orderBy: { periodo: { fechaInicio: "desc" } },
    select: { unidadId: true, lecturaActual: true },
  });
  const lecturaAnteriorPorUnidad = new Map<string, number>();
  for (const l of lecturasPrevias) {
    if (!lecturaAnteriorPorUnidad.has(l.unidadId)) lecturaAnteriorPorUnidad.set(l.unidadId, l.lecturaActual);
  }

  const lecturaActualPorUnidad = new Map(params.lecturas.map((l) => [l.unidadId, l.lecturaActual]));
  const consumoPorUnidad = new Map<string, number>();
  for (const u of unidades) {
    const actual = lecturaActualPorUnidad.get(u.id) ?? 0;
    const anterior = lecturaAnteriorPorUnidad.get(u.id) ?? 0;
    consumoPorUnidad.set(u.id, actual - anterior);
  }

  await prisma.$transaction(
    unidades.map((u) =>
      prisma.lecturaGas.upsert({
        where: { periodoId_unidadId: { periodoId, unidadId: u.id } },
        create: {
          periodoId,
          unidadId: u.id,
          lecturaActual: lecturaActualPorUnidad.get(u.id) ?? 0,
          consumo: consumoPorUnidad.get(u.id) ?? 0,
        },
        update: {
          lecturaActual: lecturaActualPorUnidad.get(u.id) ?? 0,
          consumo: consumoPorUnidad.get(u.id) ?? 0,
        },
      })
    )
  );

  // Costo de gas por unidad, torre por torre (cada torre con su propia
  // factura y su propio total de m2GasPonderado/consumo, sin mezclarlas).
  const gasPorUnidad = new Map<string, number>();
  let costoPiscina = 0;

  for (const torre of ["GRANDE", "CHICA"] as const) {
    const deLaTorre = unidades.filter((u) => u.torre === torre);
    const factura = torre === "GRANDE" ? params.facturaGasTorreGrande : params.facturaGasTorreChica;
    const totalM2Ponderado = deLaTorre.reduce((acc, u) => acc + (u.m2GasPonderado ?? 0), 0);

    const kPorUnidad = new Map<string, number>();
    for (const u of deLaTorre) {
      const incidencia = totalM2Ponderado > 0 ? (u.m2GasPonderado ?? 0) / totalM2Ponderado : 0;
      const consumo = consumoPorUnidad.get(u.id) ?? 0;
      kPorUnidad.set(u.id, consumo * incidencia);
    }
    const sumaK = [...kPorUnidad.values()].reduce((acc, k) => acc + k, 0);

    for (const u of deLaTorre) {
      const incidencia = totalM2Ponderado > 0 ? (u.m2GasPonderado ?? 0) / totalM2Ponderado : 0;
      const fijo = factura * 0.45 * incidencia;
      const k = kPorUnidad.get(u.id) ?? 0;
      const variable = sumaK > 0 ? factura * 0.55 * (k / sumaK) : 0;
      const total = fijo + variable;
      if (u.esEspacioComun) {
        costoPiscina += total;
      } else {
        gasPorUnidad.set(u.id, total);
      }
    }
  }

  // La pileta se agrega/actualiza como una categoria de gasto comun mas.
  const categoriasActuales = await prisma.gastoCategoria.findMany({ where: { periodoId } });
  const categoriaPiscina = categoriasActuales.find(
    (g) => g.nombre.trim().toLowerCase() === "agua caliente - espacios comunes"
  );
  if (categoriaPiscina) {
    await prisma.gastoCategoria.update({ where: { id: categoriaPiscina.id }, data: { monto: costoPiscina } });
  } else {
    await prisma.gastoCategoria.create({
      data: {
        periodoId,
        nombre: "Agua caliente - espacios comunes",
        monto: costoPiscina,
        orden: categoriasActuales.length,
      },
    });
  }

  // El total de gastos del periodo cambio (se sumo/actualizo la categoria de
  // la pileta): hay que recalcular gastoComun/cochera/baulera de las 79
  // unidades con el nuevo total, y ahora si reemplazar calefaccion por el
  // gas recien calculado (a diferencia de actualizarPeriodoYCalcular, que
  // la deja intacta).
  const categorias = await prisma.gastoCategoria.findMany({ where: { periodoId } });
  const totalGastos = categorias.reduce((acc, c) => acc + c.monto, 0);
  await prisma.periodoExpensa.update({ where: { id: periodoId }, data: { totalGastos } });

  const { cocheraPorUnidad, bauleraPorUnidad, cocherasIndividuales, baulerasIndividuales } =
    await calcularComplementarios(totalGastos);

  const cargos = await prisma.cargoUnidadPeriodo.findMany({
    where: { periodoId },
    select: { id: true, unidadId: true, quincho: true, saldoAnterior: true, totalPagado: true },
  });

  await prisma.$transaction(
    async (tx) => {
      await Promise.all(
        cargos.map(async (cargo) => {
          const unidad = await tx.unidad.findUniqueOrThrow({
            where: { id: cargo.unidadId },
            select: { coeficiente: true },
          });
          const gastoComun = totalGastos * unidad.coeficiente;
          const cochera = cocheraPorUnidad.get(cargo.unidadId) ?? 0;
          const baulera = bauleraPorUnidad.get(cargo.unidadId) ?? 0;
          const calefaccion = gasPorUnidad.get(cargo.unidadId) ?? 0;
          const total = gastoComun + cochera + baulera + cargo.quincho + calefaccion;
          const saldoActual = total + cargo.saldoAnterior - cargo.totalPagado;
          await tx.cargoUnidadPeriodo.update({
            where: { id: cargo.id },
            data: { gastoComun, cochera, baulera, calefaccion, total, saldoActual },
          });
        })
      );

      await Promise.all(
        cocherasIndividuales.map((c) =>
          tx.cargoCocheraPeriodo.upsert({
            where: { periodoId_cocheraId: { periodoId, cocheraId: c.id } },
            create: { periodoId, cocheraId: c.id, unidadCobradaId: c.unidadCobradaId, monto: c.monto },
            update: { unidadCobradaId: c.unidadCobradaId, monto: c.monto },
          })
        )
      );
      await Promise.all(
        baulerasIndividuales.map((b) =>
          tx.cargoBauleraPeriodo.upsert({
            where: { periodoId_bauleraId: { periodoId, bauleraId: b.id } },
            create: { periodoId, bauleraId: b.id, unidadCobradaId: b.unidadCobradaId, monto: b.monto },
            update: { unidadCobradaId: b.unidadCobradaId, monto: b.monto },
          })
        )
      );
    },
    { timeout: 20000 }
  );

  return { costoPiscina, totalGastos };
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
 * con el nuevo total de gastos (las tres se prorratean con el mismo total,
 * y cochera/baulera se recalculan espacio por espacio). Se mantienen
 * intactos: quincho, calefacción, saldo anterior y los pagos ya
 * registrados de cada unidad.
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

  const { cocheraPorUnidad, bauleraPorUnidad, cocherasIndividuales, baulerasIndividuales } =
    await calcularComplementarios(totalGastos);

  const cargos = await prisma.cargoUnidadPeriodo.findMany({
    where: { periodoId },
    select: { id: true, unidadId: true, quincho: true, calefaccion: true, saldoAnterior: true, totalPagado: true },
  });

  // Recalcula gasto común, cochera, baulera y el total de cada unidad. Con
  // Promise.all las ~80 actualizaciones se disparan en paralelo (no una
  // por una en secuencia), para no repetir el problema de lentitud que
  // causaba el timeout al crear un período.
  await prisma.$transaction(
    async (tx) => {
      await Promise.all(
        cargos.map(async (cargo) => {
          const unidad = await tx.unidad.findUniqueOrThrow({
            where: { id: cargo.unidadId },
            select: { coeficiente: true },
          });
          const gastoComun = totalGastos * unidad.coeficiente;
          const cochera = cocheraPorUnidad.get(cargo.unidadId) ?? 0;
          const baulera = bauleraPorUnidad.get(cargo.unidadId) ?? 0;
          const total = gastoComun + cochera + baulera + cargo.quincho + cargo.calefaccion;
          const saldoActual = total + cargo.saldoAnterior - cargo.totalPagado;
          await tx.cargoUnidadPeriodo.update({
            where: { id: cargo.id },
            data: { gastoComun, cochera, baulera, total, saldoActual },
          });
        })
      );

      // Liquidación individual de cada cochera/baulera para este período:
      // como el período ya existe, se actualiza (upsert) en vez de crear.
      await Promise.all(
        cocherasIndividuales.map((c) =>
          tx.cargoCocheraPeriodo.upsert({
            where: { periodoId_cocheraId: { periodoId, cocheraId: c.id } },
            create: { periodoId, cocheraId: c.id, unidadCobradaId: c.unidadCobradaId, monto: c.monto },
            update: { unidadCobradaId: c.unidadCobradaId, monto: c.monto },
          })
        )
      );
      await Promise.all(
        baulerasIndividuales.map((b) =>
          tx.cargoBauleraPeriodo.upsert({
            where: { periodoId_bauleraId: { periodoId, bauleraId: b.id } },
            create: { periodoId, bauleraId: b.id, unidadCobradaId: b.unidadCobradaId, monto: b.monto },
            update: { unidadCobradaId: b.unidadCobradaId, monto: b.monto },
          })
        )
      );
    },
    { timeout: 20000, maxWait: 10000 }
  );
}
