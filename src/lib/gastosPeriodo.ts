/**
 * "Total gastos" de un período, tal como se muestra en el listado de
 * liquidaciones, en el detalle del período y en el PDF.
 *
 * Las facturas de gas (Torre Grande y Torre Chica) se pueden cargar de dos
 * formas: como una categoria "Gas" en el detalle de gastos, o solamente en
 * la pantalla "Calcular gas / calefaccion" (que las guarda en
 * PeriodoExpensa.facturaGasTorreGrande / facturaGasTorreChica). En el
 * segundo caso el total del período no las incluía (detectado en
 * Septiembre/2026: el total salía sin gas, cuando en Agosto, cargado como
 * categoria, sí lo incluía).
 *
 * Esto es SOLO para mostrar el total del edificio: el gas nunca se reparte
 * por coeficiente (ver esCategoriaGas en calculo.ts), se cobra aparte por
 * consumo en CargoUnidadPeriodo.calefaccion, así que no cambia lo que paga
 * ninguna unidad.
 */

type GastoLinea = { nombre: string; monto: number; esFondoReserva?: boolean };
type FacturasGas = {
  facturaGasTorreGrande?: number | null;
  facturaGasTorreChica?: number | null;
};

function esCategoriaGas(nombre: string): boolean {
  return nombre.trim().toLowerCase() === "gas";
}

/**
 * Si el período no tiene una categoria "Gas" cargada pero sí facturas de
 * gas cargadas desde "Calcular gas", devuelve la linea "Gas" a agregar al
 * detalle (suma de las dos facturas). Si no, null.
 */
export function lineaGasDesdeFacturas(
  gastos: GastoLinea[],
  facturas: FacturasGas
): { nombre: string; monto: number; esFondoReserva: boolean } | null {
  if (gastos.some((g) => esCategoriaGas(g.nombre))) return null;
  const monto = (facturas.facturaGasTorreGrande ?? 0) + (facturas.facturaGasTorreChica ?? 0);
  if (monto <= 0) return null;
  return { nombre: "Gas", monto: Math.round(monto * 100) / 100, esFondoReserva: false };
}

/** Detalle de gastos del período, con la linea "Gas" agregada si corresponde. */
export function gastosConGas<T extends GastoLinea>(
  gastos: T[],
  facturas: FacturasGas
): (T | { nombre: string; monto: number; esFondoReserva: boolean })[] {
  const linea = lineaGasDesdeFacturas(gastos, facturas);
  return linea ? [...gastos, linea] : gastos;
}

function esCategoriaPileta(nombre: string): boolean {
  return nombre.trim().toLowerCase() === "agua caliente - espacios comunes";
}

/**
 * Total de gastos del período, incluyendo las facturas de gas si no estaban
 * como categoria.
 *
 * Cuando el total ya incluye el gas (como categoria "Gas" o desde las
 * facturas de "Calcular gas"), NO se suma la categoria "Agua caliente -
 * espacios comunes": el gas de la pileta ya esta DENTRO de las facturas de
 * Camuzzi, y sumarla de nuevo la contaba dos veces (detectado en
 * Septiembre/2026 comparando contra la planilla de la administradora, que
 * no la lista aparte: diferencia de $63.209,37). Esa categoria se sigue
 * usando igual para el prorrateo del gasto comun (ver calculo.ts); esto es
 * solo el total que se muestra.
 */
export function totalGastosPeriodo(gastos: GastoLinea[], facturas: FacturasGas): number {
  const linea = lineaGasDesdeFacturas(gastos, facturas);
  const incluyeGas = linea !== null || gastos.some((g) => esCategoriaGas(g.nombre));
  const suma = gastos.reduce(
    (acc, g) => (incluyeGas && esCategoriaPileta(g.nombre) ? acc : acc + g.monto),
    0
  );
  return suma + (linea?.monto ?? 0);
}

/** true si la linea de la pileta queda fuera del total (para aclararlo en pantalla). */
export function piletaExcluidaDelTotal(gastos: GastoLinea[], facturas: FacturasGas): boolean {
  const incluyeGas = lineaGasDesdeFacturas(gastos, facturas) !== null || gastos.some((g) => esCategoriaGas(g.nombre));
  return incluyeGas && gastos.some((g) => esCategoriaPileta(g.nombre));
}
