/**
 * Evolución de la expensa de UNA unidad, para el gráfico de "Mi cuenta"
 * del propietario: cuánto le liquidaron cada mes (CargoUnidadPeriodo.total)
 * y, si el último mes subió, por qué.
 *
 * Es una función pura (no toca la base): la página del propietario ya trae
 * los cargos visibles con el detalle de gastos de cada período.
 */

export type CargoParaEvolucion = {
  id: string;
  total: number;
  gastoComun: number;
  cochera: number;
  baulera: number;
  calefaccion: number;
  quincho: number;
  ajuste: number;
  ajusteConcepto: string | null;
  periodo: {
    etiqueta: string;
    gastos: { nombre: string; monto: number; excluyeDesarrollador: boolean }[];
  };
};

export type UnidadParaEvolucion = {
  coeficiente: number;
  esDesarrollador: boolean;
};

export type PuntoExpensa = {
  cargoId: string;
  etiqueta: string;
  total: number;
};

export type MotivoSuba = {
  concepto: string;
  /** Cuánto de la suba de ESTA unidad se explica por este concepto. */
  importe: number;
  /** Texto corto que aclara el origen (ej: "el gasto del edificio subió 18%"). */
  detalle?: string;
};

export type ExplicacionSuba = {
  etiquetaActual: string;
  etiquetaAnterior: string;
  diferencia: number;
  porcentaje: number;
  motivos: MotivoSuba[];
};

export type EvolucionExpensa = {
  puntos: PuntoExpensa[];
  /** null si el último mes no subió (o no hay mes anterior con qué comparar). */
  explicacion: ExplicacionSuba | null;
};

export const MESES_EVOLUCION = 12;

/**
 * Misma tolerancia que usa DesgloseLiquidacion para decir "Similar al mes
 * anterior": por debajo de 0,5% no se considera una suba.
 */
const UMBRAL_SUBA = 0.005;
const MAX_MOTIVOS = 3;

// Misma regla que esCategoriaGas en calculo.ts: la factura de "Gas" no se
// reparte por coeficiente (se cobra por consumo, en "calefaccion"), así que
// no puede explicar un cambio del gasto común.
function esCategoriaGas(nombre: string): boolean {
  return nombre.trim().toLowerCase() === "gas";
}

function clave(nombre: string): string {
  return nombre.trim().toLowerCase();
}

type AporteCategoria = { nombre: string; montoEdificio: number; aporteUnidad: number };

/**
 * Cuánto aportó cada categoría de gasto a lo que paga esta unidad: su
 * coeficiente sobre el monto de la categoría (igual que calcularGastoComunUnidad
 * en calculo.ts, incluida la exclusión de las categorías que no se le cobran
 * a las unidades del desarrollador).
 */
function aportesPorCategoria(
  gastos: CargoParaEvolucion["periodo"]["gastos"],
  unidad: UnidadParaEvolucion
): Map<string, AporteCategoria> {
  const mapa = new Map<string, AporteCategoria>();
  for (const g of gastos) {
    if (esCategoriaGas(g.nombre)) continue;
    const k = clave(g.nombre);
    const aporte = g.excluyeDesarrollador && unidad.esDesarrollador ? 0 : g.monto * unidad.coeficiente;
    const previo = mapa.get(k);
    if (previo) {
      previo.montoEdificio += g.monto;
      previo.aporteUnidad += aporte;
    } else {
      mapa.set(k, { nombre: g.nombre.trim(), montoEdificio: g.monto, aporteUnidad: aporte });
    }
  }
  return mapa;
}

function motivosDeSuba(
  actual: CargoParaEvolucion,
  anterior: CargoParaEvolucion,
  unidad: UnidadParaEvolucion
): MotivoSuba[] {
  const motivos: MotivoSuba[] = [];

  // 1) Gasto común: categoría por categoría, en lo que le toca a la unidad.
  const ahora = aportesPorCategoria(actual.periodo.gastos, unidad);
  const antes = aportesPorCategoria(anterior.periodo.gastos, unidad);
  for (const [k, a] of ahora) {
    const previo = antes.get(k);
    const delta = a.aporteUnidad - (previo?.aporteUnidad ?? 0);
    if (delta < 1) continue;
    let detalle: string | undefined;
    if (!previo || previo.montoEdificio <= 0) {
      detalle = "gasto nuevo este mes";
    } else {
      const pct = Math.round((a.montoEdificio / previo.montoEdificio - 1) * 100);
      if (pct >= 1) detalle = `el gasto del edificio subió ${pct}%`;
    }
    motivos.push({ concepto: a.nombre, importe: delta, detalle });
  }

  // 2) Lo que se cobra aparte a la unidad (no depende de las categorías).
  const aparte: { concepto: string; ahora: number; antes: number; detalle?: string }[] = [
    { concepto: "Cochera", ahora: actual.cochera, antes: anterior.cochera },
    { concepto: "Baulera", ahora: actual.baulera, antes: anterior.baulera },
    {
      concepto: "Calefacción / agua caliente",
      ahora: actual.calefaccion,
      antes: anterior.calefaccion,
      detalle: "según tu consumo",
    },
    { concepto: "Uso de quincho", ahora: actual.quincho, antes: anterior.quincho, detalle: "reservas del mes" },
    {
      concepto: actual.ajuste !== 0 && actual.ajusteConcepto ? `Ajuste: ${actual.ajusteConcepto}` : "Ajuste",
      ahora: actual.ajuste,
      antes: anterior.ajuste,
    },
  ];
  for (const r of aparte) {
    const delta = r.ahora - r.antes;
    if (delta >= 1) motivos.push({ concepto: r.concepto, importe: delta, detalle: r.detalle });
  }

  return motivos.sort((a, b) => b.importe - a.importe).slice(0, MAX_MOTIVOS);
}

/**
 * @param cargos liquidaciones visibles de la unidad, de la más nueva a la más vieja.
 */
export function armarEvolucionExpensa(
  cargos: CargoParaEvolucion[],
  unidad: UnidadParaEvolucion,
  cantidad = MESES_EVOLUCION
): EvolucionExpensa {
  const recientes = cargos.slice(0, cantidad);

  // En orden cronológico para graficar de izquierda a derecha.
  const puntos: PuntoExpensa[] = [...recientes]
    .reverse()
    .map((c) => ({ cargoId: c.id, etiqueta: c.periodo.etiqueta, total: c.total }));

  const actual = cargos[0];
  const anterior = cargos[1];
  if (!actual || !anterior || anterior.total <= 0) return { puntos, explicacion: null };

  const diferencia = actual.total - anterior.total;
  const porcentaje = diferencia / anterior.total;
  if (porcentaje < UMBRAL_SUBA) return { puntos, explicacion: null };

  return {
    puntos,
    explicacion: {
      etiquetaActual: actual.periodo.etiqueta,
      etiquetaAnterior: anterior.periodo.etiqueta,
      diferencia,
      porcentaje: porcentaje * 100,
      motivos: motivosDeSuba(actual, anterior, unidad),
    },
  };
}
