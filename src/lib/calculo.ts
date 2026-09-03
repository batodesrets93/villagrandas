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

  // Se trae tambien montoAplicado: el precio del quincho puede cambiar con
  // el tiempo, y cada reserva "congela" el precio vigente al momento de
  // reservar. Por eso el monto a facturar se suma reserva por reserva
  // (montoAplicado), en vez de multiplicar la cantidad de reservas por
  // MONTO_QUINCHO (el precio ACTUAL), que cobraria de mas o de menos a
  // reservas hechas antes de un cambio de precio.
  const reservasPendientes = await prisma.reserva.findMany({
    where: {
      estado: "CONFIRMADA",
      cargoId: null,
      fecha: { gte: params.fechaInicio, lte: params.fechaFin },
    },
    select: { id: true, unidadId: true, montoAplicado: true },
  });
  const quinchoPorUnidad = new Map<string, { reservaIds: string[]; monto: number }>();
  for (const r of reservasPendientes) {
    const actual = quinchoPorUnidad.get(r.unidadId) ?? { reservaIds: [], monto: 0 };
    actual.reservaIds.push(r.id);
    actual.monto += r.montoAplicado;
    quinchoPorUnidad.set(r.unidadId, actual);
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
    const quinchoDatos = quinchoPorUnidad.get(unidad.id);
    const reservaIds = quinchoDatos?.reservaIds ?? [];
    const quincho = quinchoDatos?.monto ?? 0;
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

export async function registrarPago(
  cargoId: string,
  monto: number,
  medio?: string,
  nota?: string,
  fecha?: Date
) {
  return prisma.$transaction(async (tx) => {
    await tx.pago.create({ data: { cargoId, monto, medio, nota, ...(fecha ? { fecha } : {}) } });
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
 * Elimina un pago (registrado manualmente por el admin, o creado al
 * confirmar un pago informado) y recalcula totalPagado/saldoActual del
 * cargo correspondiente, exactamente igual que registrarPago pero restando
 * en vez de sumando. Si el pago venía de un PagoInformado ya CONFIRMADO, ese
 * PagoInformado vuelve a quedar PENDIENTE (se "deshace" la confirmación)
 * para que el admin pueda decidir de nuevo qué hacer con él, en vez de
 * quedar en un estado inconsistente (CONFIRMADO pero sin Pago vinculado).
 */
export async function eliminarPago(pagoId: string) {
  return prisma.$transaction(async (tx) => {
    const pago = await tx.pago.findUniqueOrThrow({
      where: { id: pagoId },
      include: { pagoInformado: true },
    });

    if (pago.pagoInformado) {
      await tx.pagoInformado.update({
        where: { id: pago.pagoInformado.id },
        data: { estado: "PENDIENTE", pagoId: null, notaAdmin: null, resueltoAt: null },
      });
    }

    await tx.pago.delete({ where: { id: pagoId } });

    const pagos = await tx.pago.aggregate({ where: { cargoId: pago.cargoId }, _sum: { monto: true } });
    const totalPagado = pagos._sum.monto ?? 0;
    const cargo = await tx.cargoUnidadPeriodo.findUniqueOrThrow({ where: { id: pago.cargoId } });
    const saldoActual = cargo.total + cargo.saldoAnterior - totalPagado;
    return tx.cargoUnidadPeriodo.update({
      where: { id: pago.cargoId },
      data: { totalPagado, saldoActual },
    });
  });
}

/**
 * Confirma un pago que un propietario informó desde la app: crea el Pago
 * real (mismo efecto que registrarPago: descuenta totalPagado/saldoActual
 * del cargo) y lo deja linkeado al PagoInformado via pagoId. El medio final
 * puede pisar el que declaró el propietario (ej: el admin corrige a
 * "Efectivo" si así lo ve acreditado). Si el PagoInformado ya no está
 * PENDIENTE (ya fue confirmado o rechazado, ej. por otra pestaña abierta),
 * tira error en vez de duplicar el pago.
 */
export async function confirmarPagoInformado(
  pagoInformadoId: string,
  opts?: { medio?: string; notaAdmin?: string }
) {
  return prisma.$transaction(async (tx) => {
    const informado = await tx.pagoInformado.findUniqueOrThrow({ where: { id: pagoInformadoId } });
    if (informado.estado !== "PENDIENTE") {
      throw new Error("Este pago informado ya fue procesado antes.");
    }

    const pago = await tx.pago.create({
      data: {
        cargoId: informado.cargoId,
        monto: informado.monto,
        medio: opts?.medio || informado.medio || undefined,
        nota: informado.nota || undefined,
      },
    });

    const pagos = await tx.pago.aggregate({ where: { cargoId: informado.cargoId }, _sum: { monto: true } });
    const totalPagado = pagos._sum.monto ?? 0;
    const cargo = await tx.cargoUnidadPeriodo.findUniqueOrThrow({ where: { id: informado.cargoId } });
    const saldoActual = cargo.total + cargo.saldoAnterior - totalPagado;
    await tx.cargoUnidadPeriodo.update({
      where: { id: informado.cargoId },
      data: { totalPagado, saldoActual },
    });

    return tx.pagoInformado.update({
      where: { id: pagoInformadoId },
      data: {
        estado: "CONFIRMADO",
        pagoId: pago.id,
        notaAdmin: opts?.notaAdmin || undefined,
        resueltoAt: new Date(),
      },
    });
  });
}

/**
 * Rechaza un pago informado (ej: no aparece en la cuenta del edificio, o el
 * monto no coincide). No toca el saldo del propietario ni crea ningún Pago.
 */
export async function rechazarPagoInformado(pagoInformadoId: string, notaAdmin?: string) {
  const informado = await prisma.pagoInformado.findUniqueOrThrow({ where: { id: pagoInformadoId } });
  if (informado.estado !== "PENDIENTE") {
    throw new Error("Este pago informado ya fue procesado antes.");
  }
  return prisma.pagoInformado.update({
    where: { id: pagoInformadoId },
    data: { estado: "RECHAZADO", notaAdmin: notaAdmin || undefined, resueltoAt: new Date() },
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
    lecturas: { unidadId: string; lecturaActual: number; lecturaAnteriorInicial?: number }[];
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
    select: { id: true, torre: true, piso: true, depto: true, esEspacioComun: true, m2GasPonderado: true },
  });

  // Lectura anterior de cada unidad: la lecturaActual del periodo anterior
  // (el mas reciente antes de este). Si no hay ningun periodo previo con
  // lectura para esa unidad (primera vez que se mide), se usa la
  // lecturaAnteriorInicial que cargo el admin a mano (o 0 si no cargo nada).
  const lecturasPrevias = await prisma.lecturaGas.findMany({
    where: { periodo: { fechaInicio: { lt: periodo.fechaInicio } } },
    orderBy: { periodo: { fechaInicio: "desc" } },
    select: { unidadId: true, lecturaActual: true },
  });
  const lecturaAnteriorHistoricaPorUnidad = new Map<string, number>();
  for (const l of lecturasPrevias) {
    if (!lecturaAnteriorHistoricaPorUnidad.has(l.unidadId)) lecturaAnteriorHistoricaPorUnidad.set(l.unidadId, l.lecturaActual);
  }
  const lecturaAnteriorInicialPorUnidad = new Map(
    params.lecturas.map((l) => [l.unidadId, l.lecturaAnteriorInicial])
  );

  const lecturaActualPorUnidad = new Map(params.lecturas.map((l) => [l.unidadId, l.lecturaActual]));
  const consumoPorUnidad = new Map<string, number>();
  for (const u of unidades) {
    const actual = lecturaActualPorUnidad.get(u.id) ?? 0;
    const anterior =
      lecturaAnteriorHistoricaPorUnidad.get(u.id) ?? lecturaAnteriorInicialPorUnidad.get(u.id) ?? 0;
    consumoPorUnidad.set(u.id, actual - anterior);
  }

  // Salvaguarda: un consumo negativo (lectura actual menor a la anterior)
  // significa que se cargo mal una lectura -- el medidor de gas nunca
  // "retrocede". Si esto pasa, la formula de reparto variable (55% de la
  // factura repartido proporcional al consumo de cada unidad sobre el total
  // de la torre) puede quedar dividiendo por una suma de consumos que da
  // (casi) cero por cancelacion entre valores negativos y positivos, y ese
  // cociente cercano a cero en el denominador puede disparar el resultado a
  // un numero absurdo (paso real: en Agosto/2026 esto convirtio una factura
  // de ~$1,5M en un cargo de ~$4.082.164.500.744.874 para "Agua caliente -
  // espacios comunes", que se arrastro a gastoComun de las 81 unidades). Por
  // eso se corta aca con un error claro en vez de guardar un calculo
  // corrupto.
  const unidadesConConsumoNegativo = unidades.filter((u) => (consumoPorUnidad.get(u.id) ?? 0) < 0);
  if (unidadesConConsumoNegativo.length > 0) {
    const detalle = unidadesConConsumoNegativo
      .map((u) => {
        const label = u.esEspacioComun ? "Pileta" : `${u.torre === "GRANDE" ? "TG" : "TC"} ${u.piso}º${u.depto}`;
        const actual = lecturaActualPorUnidad.get(u.id) ?? 0;
        const anterior =
          lecturaAnteriorHistoricaPorUnidad.get(u.id) ?? lecturaAnteriorInicialPorUnidad.get(u.id) ?? 0;
        return `${label} (anterior ${anterior}, actual ${actual})`;
      })
      .join("; ");
    throw new Error(
      `No se puede calcular el gas: ${unidadesConConsumoNegativo.length} unidad(es) con consumo negativo ` +
        `(la lectura actual es menor a la anterior, algo imposible en un medidor real). Revisá esas lecturas ` +
        `antes de volver a calcular: ${detalle}`
    );
  }

  // ANTES: esto era un $transaction interactiva con ~79 upserts lanzados en
  // paralelo (Promise.all) sobre una única conexión (la que te da el pooler
  // de transacción de Supabase). Esos 79 upserts en realidad NO corrían en
  // paralelo contra la base: se encolaban uno atrás del otro en esa misma
  // conexión, y contra el pooler cada uno tarda bastante (ida y vuelta de
  // red), así que la suma total podía superar el timeout aunque estuviera
  // en 20000ms — de ahí el P2028 con "20128 ms passed".
  //
  // AHORA: un solo INSERT ... ON CONFLICT con unnest() de arrays, así las
  // 79 filas se mandan y se escriben en UN solo viaje a la base, sin
  // transacción interactiva y sin riesgo de timeout.
  if (unidades.length > 0) {
    const ids = unidades.map(() => randomUUID());
    const periodoIds = unidades.map(() => periodoId);
    const unidadIds = unidades.map((u) => u.id);
    const lecturasActuales = unidades.map((u) => lecturaActualPorUnidad.get(u.id) ?? 0);
    const consumos = unidades.map((u) => consumoPorUnidad.get(u.id) ?? 0);

    await prisma.$executeRaw`
      INSERT INTO "LecturaGas" (id, "periodoId", "unidadId", "lecturaActual", "consumo")
      SELECT * FROM unnest(
        ${ids}::text[],
        ${periodoIds}::text[],
        ${unidadIds}::text[],
        ${lecturasActuales}::float8[],
        ${consumos}::float8[]
      ) AS t(id, "periodoId", "unidadId", "lecturaActual", "consumo")
      ON CONFLICT ("periodoId", "unidadId")
      DO UPDATE SET "lecturaActual" = EXCLUDED."lecturaActual", "consumo" = EXCLUDED."consumo"
    `;
  }

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

  // ANTES: por cada uno de los ~79 cargos se hacía un findUniqueOrThrow
  // aparte para el coeficiente de la unidad (79 consultas más), y después
  // 79 updates + los upserts de cocheras/bauleras, todo adentro de una
  // misma transacción interactiva. Igual que con lecturaGas, esos ~160+
  // viajes a la base contra el pooler de Supabase podían superar el
  // timeout aunque estuviera en 20000ms — de ahí el "Transaction not
  // found" (la transacción ya se había cerrado por timeout del lado del
  // servidor cuando Prisma todavía le quería mandar más queries).
  //
  // AHORA: un solo findMany para los coeficientes, los cálculos se hacen
  // en JS (sin ir a la base), y despues 3 sentencias bulk (un UPDATE con
  // unnest para los cargos, y dos INSERT ... ON CONFLICT con unnest para
  // cocheras/bauleras), envueltas en la forma "array" de $transaction que
  // no tiene el problema de timeout de la forma interactiva.
  const unidadesCoef = await prisma.unidad.findMany({
    where: { id: { in: cargos.map((c) => c.unidadId) } },
    select: { id: true, coeficiente: true },
  });
  const coeficientePorUnidad = new Map(unidadesCoef.map((u) => [u.id, u.coeficiente]));

  const cargoIds: string[] = [];
  const gastoComunes: number[] = [];
  const cocheraMontos: number[] = [];
  const bauleraMontos: number[] = [];
  const calefacciones: number[] = [];
  const totales: number[] = [];
  const saldosActuales: number[] = [];

  for (const cargo of cargos) {
    const gastoComun = totalGastos * (coeficientePorUnidad.get(cargo.unidadId) ?? 0);
    const cochera = cocheraPorUnidad.get(cargo.unidadId) ?? 0;
    const baulera = bauleraPorUnidad.get(cargo.unidadId) ?? 0;
    const calefaccion = gasPorUnidad.get(cargo.unidadId) ?? 0;
    const total = gastoComun + cochera + baulera + cargo.quincho + calefaccion;
    const saldoActual = total + cargo.saldoAnterior - cargo.totalPagado;

    cargoIds.push(cargo.id);
    gastoComunes.push(gastoComun);
    cocheraMontos.push(cochera);
    bauleraMontos.push(baulera);
    calefacciones.push(calefaccion);
    totales.push(total);
    saldosActuales.push(saldoActual);
  }

  const queries = [];

  if (cargoIds.length > 0) {
    queries.push(prisma.$executeRaw`
      UPDATE "CargoUnidadPeriodo" AS c
      SET "gastoComun" = u."gastoComun",
          cochera = u.cochera,
          baulera = u.baulera,
          calefaccion = u.calefaccion,
          total = u.total,
          "saldoActual" = u."saldoActual"
      FROM (
        SELECT * FROM unnest(
          ${cargoIds}::text[],
          ${gastoComunes}::float8[],
          ${cocheraMontos}::float8[],
          ${bauleraMontos}::float8[],
          ${calefacciones}::float8[],
          ${totales}::float8[],
          ${saldosActuales}::float8[]
        ) AS t(id, "gastoComun", cochera, baulera, calefaccion, total, "saldoActual")
      ) AS u
      WHERE c.id = u.id
    `);
  }

  if (cocherasIndividuales.length > 0) {
    const ids = cocherasIndividuales.map(() => randomUUID());
    const periodoIds = cocherasIndividuales.map(() => periodoId);
    const cocheraIds = cocherasIndividuales.map((c) => c.id);
    const unidadCobradaIds = cocherasIndividuales.map((c) => c.unidadCobradaId);
    const montos = cocherasIndividuales.map((c) => c.monto);
    queries.push(prisma.$executeRaw`
      INSERT INTO "CargoCocheraPeriodo" (id, "periodoId", "cocheraId", "unidadCobradaId", monto)
      SELECT * FROM unnest(
        ${ids}::text[],
        ${periodoIds}::text[],
        ${cocheraIds}::text[],
        ${unidadCobradaIds}::text[],
        ${montos}::float8[]
      ) AS t(id, "periodoId", "cocheraId", "unidadCobradaId", monto)
      ON CONFLICT ("periodoId", "cocheraId")
      DO UPDATE SET "unidadCobradaId" = EXCLUDED."unidadCobradaId", monto = EXCLUDED.monto
    `);
  }

  if (baulerasIndividuales.length > 0) {
    const ids = baulerasIndividuales.map(() => randomUUID());
    const periodoIds = baulerasIndividuales.map(() => periodoId);
    const bauleraIds = baulerasIndividuales.map((b) => b.id);
    const unidadCobradaIds = baulerasIndividuales.map((b) => b.unidadCobradaId);
    const montos = baulerasIndividuales.map((b) => b.monto);
    queries.push(prisma.$executeRaw`
      INSERT INTO "CargoBauleraPeriodo" (id, "periodoId", "bauleraId", "unidadCobradaId", monto)
      SELECT * FROM unnest(
        ${ids}::text[],
        ${periodoIds}::text[],
        ${bauleraIds}::text[],
        ${unidadCobradaIds}::text[],
        ${montos}::float8[]
      ) AS t(id, "periodoId", "bauleraId", "unidadCobradaId", monto)
      ON CONFLICT ("periodoId", "bauleraId")
      DO UPDATE SET "unidadCobradaId" = EXCLUDED."unidadCobradaId", monto = EXCLUDED.monto
    `);
  }

  if (queries.length > 0) {
    await prisma.$transaction(queries);
  }

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

  // Recalcula gasto común, cochera, baulera y el total de cada unidad.
  // MISMO arreglo que en calcularGasPeriodo: antes esto era una transacción
  // interactiva con un findUniqueOrThrow + update por cada uno de los ~79
  // cargos (más los upserts de cocheras/bauleras), todo contra el pooler de
  // Supabase — el mismo patrón que causaba P2028 / "Transaction not found"
  // al calcular el gas. Acá todavía no había fallado, pero tenía la misma
  // bomba de tiempo adentro, así que se arregla de la misma forma: un solo
  // findMany para los coeficientes, los cálculos en JS, y 3 sentencias bulk
  // con unnest() (un UPDATE + dos INSERT ... ON CONFLICT) en vez de ~160
  // queries individuales.
  const unidadesCoef = await prisma.unidad.findMany({
    where: { id: { in: cargos.map((c) => c.unidadId) } },
    select: { id: true, coeficiente: true },
  });
  const coeficientePorUnidad = new Map(unidadesCoef.map((u) => [u.id, u.coeficiente]));

  const cargoIds: string[] = [];
  const gastoComunes: number[] = [];
  const cocheraMontos: number[] = [];
  const bauleraMontos: number[] = [];
  const totales: number[] = [];
  const saldosActuales: number[] = [];

  for (const cargo of cargos) {
    const gastoComun = totalGastos * (coeficientePorUnidad.get(cargo.unidadId) ?? 0);
    const cochera = cocheraPorUnidad.get(cargo.unidadId) ?? 0;
    const baulera = bauleraPorUnidad.get(cargo.unidadId) ?? 0;
    const total = gastoComun + cochera + baulera + cargo.quincho + cargo.calefaccion;
    const saldoActual = total + cargo.saldoAnterior - cargo.totalPagado;

    cargoIds.push(cargo.id);
    gastoComunes.push(gastoComun);
    cocheraMontos.push(cochera);
    bauleraMontos.push(baulera);
    totales.push(total);
    saldosActuales.push(saldoActual);
  }

  const queries = [];

  if (cargoIds.length > 0) {
    queries.push(prisma.$executeRaw`
      UPDATE "CargoUnidadPeriodo" AS c
      SET "gastoComun" = u."gastoComun",
          cochera = u.cochera,
          baulera = u.baulera,
          total = u.total,
          "saldoActual" = u."saldoActual"
      FROM (
        SELECT * FROM unnest(
          ${cargoIds}::text[],
          ${gastoComunes}::float8[],
          ${cocheraMontos}::float8[],
          ${bauleraMontos}::float8[],
          ${totales}::float8[],
          ${saldosActuales}::float8[]
        ) AS t(id, "gastoComun", cochera, baulera, total, "saldoActual")
      ) AS u
      WHERE c.id = u.id
    `);
  }

  // Liquidación individual de cada cochera/baulera para este período: como
  // el período ya existe, se actualiza (upsert) en vez de crear.
  if (cocherasIndividuales.length > 0) {
    const ids = cocherasIndividuales.map(() => randomUUID());
    const periodoIds = cocherasIndividuales.map(() => periodoId);
    const cocheraIds = cocherasIndividuales.map((c) => c.id);
    const unidadCobradaIds = cocherasIndividuales.map((c) => c.unidadCobradaId);
    const montos = cocherasIndividuales.map((c) => c.monto);
    queries.push(prisma.$executeRaw`
      INSERT INTO "CargoCocheraPeriodo" (id, "periodoId", "cocheraId", "unidadCobradaId", monto)
      SELECT * FROM unnest(
        ${ids}::text[],
        ${periodoIds}::text[],
        ${cocheraIds}::text[],
        ${unidadCobradaIds}::text[],
        ${montos}::float8[]
      ) AS t(id, "periodoId", "cocheraId", "unidadCobradaId", monto)
      ON CONFLICT ("periodoId", "cocheraId")
      DO UPDATE SET "unidadCobradaId" = EXCLUDED."unidadCobradaId", monto = EXCLUDED.monto
    `);
  }

  if (baulerasIndividuales.length > 0) {
    const ids = baulerasIndividuales.map(() => randomUUID());
    const periodoIds = baulerasIndividuales.map(() => periodoId);
    const bauleraIds = baulerasIndividuales.map((b) => b.id);
    const unidadCobradaIds = baulerasIndividuales.map((b) => b.unidadCobradaId);
    const montos = baulerasIndividuales.map((b) => b.monto);
    queries.push(prisma.$executeRaw`
      INSERT INTO "CargoBauleraPeriodo" (id, "periodoId", "bauleraId", "unidadCobradaId", monto)
      SELECT * FROM unnest(
        ${ids}::text[],
        ${periodoIds}::text[],
        ${bauleraIds}::text[],
        ${unidadCobradaIds}::text[],
        ${montos}::float8[]
      ) AS t(id, "periodoId", "bauleraId", "unidadCobradaId", monto)
      ON CONFLICT ("periodoId", "bauleraId")
      DO UPDATE SET "unidadCobradaId" = EXCLUDED."unidadCobradaId", monto = EXCLUDED.monto
    `);
  }

  if (queries.length > 0) {
    await prisma.$transaction(queries);
  }
}
