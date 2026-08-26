import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

type CargoConDatos = {
  gastoComun: number;
  cochera: number;
  baulera: number;
  quincho: number;
  calefaccion: number;
  total: number;
  saldoAnterior: number;
  totalPagado: number;
  saldoActual: number;
};

type UnidadDatos = {
  torre: string;
  piso: string;
  depto: string;
  titular: string;
  m2: number;
  cocheraM2: number;
  bauleraM2: number;
};

type PeriodoDatos = {
  etiqueta: string;
  fechaInicio: Date;
  fechaFin: Date;
  vencimiento: Date;
};

type GastoCategoriaDatos = {
  nombre: string;
  monto: number;
  esFondoReserva: boolean;
};

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fecha(d: Date) {
  return d.toLocaleDateString("es-AR");
}

function m2Redondeado(n: number) {
  return Math.round(n) + " m²";
}

function porcentaje(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + " %";
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;
const MARGIN_BOTTOM = 60;
const RIGHT_EDGE = 545;

const VERDE = rgb(0.18, 0.42, 0.32);
const GRIS = rgb(0.35, 0.35, 0.35);
const NEGRO = rgb(0.1, 0.1, 0.1);
const LINEA_CLARA = rgb(0.85, 0.85, 0.85);

/** Contexto mutable de dibujo: página actual + posición vertical, con salto de página automático. */
class Lienzo {
  doc: PDFDocument;
  fontBold: PDFFont;
  font: PDFFont;
  page: PDFPage;
  y: number;

  constructor(doc: PDFDocument, fontBold: PDFFont, font: PDFFont) {
    this.doc = doc;
    this.fontBold = fontBold;
    this.font = font;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = 790;
  }

  /** Asegura que haya al menos `alto` puntos libres antes del margen inferior; si no, crea página nueva. */
  asegurarEspacio(alto: number) {
    if (this.y - alto < MARGIN_BOTTOM) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = 790;
    }
  }

  texto(str: string, opts: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb> }) {
    this.page.drawText(str, {
      x: opts.x ?? MARGIN_X,
      y: this.y,
      size: opts.size ?? 10,
      font: opts.bold ? this.fontBold : this.font,
      color: opts.color ?? NEGRO,
    });
  }

  linea(color = LINEA_CLARA, thickness = 1) {
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y },
      end: { x: RIGHT_EDGE, y: this.y },
      thickness,
      color,
    });
  }

  /** Fila de dos columnas: etiqueta a la izquierda, monto/valor a la derecha. */
  fila(label: string, valor: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}) {
    this.asegurarEspacio(18);
    this.texto(label, { size: opts.size ?? 10, bold: opts.bold, color: opts.color });
    this.texto(valor, { x: 420, size: opts.size ?? 10, bold: opts.bold, color: opts.color });
    this.y -= 18;
  }
}

/**
 * Agrupa gastos con el mismo nombre (misma categoría cargada en varias facturas)
 * en un solo renglón, sumando los montos. Mantiene el orden de primera aparición.
 * Los gastos de fondo de reserva se agrupan aparte de los que no lo son, aunque
 * compartan nombre, para no mezclar conceptos distintos.
 */
function agruparGastosPorNombre(gastos: GastoCategoriaDatos[]): GastoCategoriaDatos[] {
  const orden: string[] = [];
  const acumulado = new Map<string, GastoCategoriaDatos>();

  for (const g of gastos) {
    const clave = g.nombre + (g.esFondoReserva ? "__fondo" : "");
    const existente = acumulado.get(clave);
    if (existente) {
      existente.monto += g.monto;
    } else {
      acumulado.set(clave, { ...g });
      orden.push(clave);
    }
  }

  return orden.map((clave) => acumulado.get(clave)!);
}

export async function generarPdfLiquidacion(
  unidad: UnidadDatos,
  periodo: PeriodoDatos,
  cargo: CargoConDatos,
  totalM2Edificio: number,
  gastosPeriodoSinAgrupar: GastoCategoriaDatos[] = [],
  totalGastosPeriodo: number = 0
) {
  const gastosPeriodo = agruparGastosPorNombre(gastosPeriodoSinAgrupar);

  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const c = new Lienzo(doc, fontBold, font);

  // ---------- Encabezado ----------
  c.texto("Torres Villa Grandas", { size: 18, bold: true, color: VERDE });
  c.y -= 22;
  c.texto("Liquidación de expensas", { size: 12, color: GRIS });
  c.y -= 30;

  c.texto(`Período: ${periodo.etiqueta}`, { size: 11, bold: true });
  c.y -= 16;
  c.texto(`${fecha(periodo.fechaInicio)} al ${fecha(periodo.fechaFin)}  ·  Vencimiento: ${fecha(periodo.vencimiento)}`, {
    size: 10,
    color: GRIS,
  });
  c.y -= 28;

  // ---------- Sección 1: detalle de gastos del edificio en el período ----------
  if (gastosPeriodo.length > 0) {
    c.asegurarEspacio(30);
    c.texto("Detalle de gastos del período (edificio completo)", { size: 12, bold: true, color: VERDE });
    c.y -= 20;
    c.linea();
    c.y -= 16;

    for (const g of gastosPeriodo) {
      const etiquetaFondo = g.esFondoReserva ? "  (fondo de reserva)" : "";
      c.fila(g.nombre + etiquetaFondo, money(g.monto));
    }

    c.y -= 4;
    c.linea();
    c.y -= 20;
    c.fila("Total de gastos del período", money(totalGastosPeriodo), { bold: true });
    c.y -= 14;
  }

  // ---------- Sección 2: liquidación / volante de pago de la unidad ----------
  // Reservamos el espacio de la sección completa (encabezado + hasta 5 conceptos +
  // totales + total a pagar) para que, si no entra, arranque entera en página nueva
  // en vez de cortarse a la mitad.
  const filasConValor = [
    cargo.gastoComun,
    cargo.cochera,
    cargo.baulera,
    cargo.quincho,
    cargo.calefaccion,
  ].filter((v) => v !== 0).length;
  const altoSeccionUnidad = 20 + 16 + 16 + 30 + 22 + filasConValor * 18 + 6 + 20 + 18 * 3 + 6 + 24 + 60;
  c.asegurarEspacio(altoSeccionUnidad);
  c.texto("Tu liquidación", { size: 12, bold: true, color: VERDE });
  c.y -= 20;

  const torreLabel = unidad.torre === "GRANDE" ? "Torre Grande" : "Torre Chica";
  c.texto(`Unidad: Piso ${unidad.piso} - Depto ${unidad.depto}  (${torreLabel})`, { size: 11, bold: true });
  c.y -= 16;
  c.texto(`Titular: ${unidad.titular}   ·   Superficie: ${unidad.m2} m²`, { size: 10, color: GRIS });
  c.y -= 16;

  const partesM2: string[] = [];
  if (unidad.cocheraM2 > 0) partesM2.push(`Cochera: ${m2Redondeado(unidad.cocheraM2)}`);
  if (unidad.bauleraM2 > 0) partesM2.push(`Baulera: ${m2Redondeado(unidad.bauleraM2)}`);
  const incidenciaTotal =
    totalM2Edificio > 0 ? ((unidad.m2 + unidad.cocheraM2 + unidad.bauleraM2) / totalM2Edificio) * 100 : 0;
  partesM2.push(`Incidencia total: ${porcentaje(incidenciaTotal)}`);

  c.texto(partesM2.join("   ·   "), { size: 9, color: GRIS });
  c.y -= 30;

  c.linea();
  c.y -= 22;

  const filas: [string, number][] = [
    ["Gasto común (prorrateo por coeficiente)", cargo.gastoComun],
    ["Cochera", cargo.cochera],
    ["Baulera", cargo.baulera],
    ["Uso de quincho", cargo.quincho],
    ["Calefacción / agua caliente", cargo.calefaccion],
  ];

  for (const [label, valor] of filas) {
    if (valor === 0) continue;
    c.fila(label, money(valor));
  }

  c.y -= 6;
  c.linea();
  c.y -= 20;

  c.fila("Total del período", money(cargo.total), { size: 11, bold: true });
  c.fila("Saldo anterior", money(cargo.saldoAnterior), { color: GRIS });
  c.fila("Pagos registrados", "- " + money(cargo.totalPagado), { color: GRIS });

  c.y -= 6;
  c.asegurarEspacio(60);
  c.linea(VERDE, 1.5);
  c.y -= 24;

  c.texto("TOTAL A PAGAR", { size: 13, bold: true, color: VERDE });
  c.texto(money(cargo.saldoActual), { x: 400, size: 13, bold: true, color: VERDE });
  c.y -= 60;

  // ---------- Pie ----------
  c.asegurarEspacio(45);
  c.texto("Administración Joaquín Rigueiro", { size: 9, color: GRIS });
  c.y -= 13;
  c.texto("Cel. 223 5919009  ·  propiedadesjoaquinrigueiro@gmail.com", { size: 9, color: GRIS });
  c.y -= 13;
  c.texto("Pagos por transferencia o depósito. Avisar el pago por WhatsApp o email.", { size: 9, color: GRIS });

  return doc.save();
}
