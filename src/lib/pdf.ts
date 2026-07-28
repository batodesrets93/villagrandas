import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
};

type PeriodoDatos = {
  etiqueta: string;
  fechaInicio: Date;
  fechaFin: Date;
  vencimiento: Date;
};

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fecha(d: Date) {
  return d.toLocaleDateString("es-AR");
}

export async function generarPdfLiquidacion(unidad: UnidadDatos, periodo: PeriodoDatos, cargo: CargoConDatos) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const marginX = 50;
  let y = 790;

  const verde = rgb(0.18, 0.42, 0.32);
  const gris = rgb(0.35, 0.35, 0.35);
  const negro = rgb(0.1, 0.1, 0.1);

  page.drawText("Torres Villa Grandas", { x: marginX, y, size: 18, font: fontBold, color: verde });
  y -= 22;
  page.drawText("Liquidación de expensas", { x: marginX, y, size: 12, font, color: gris });
  y -= 30;

  page.drawText(`Período: ${periodo.etiqueta}`, { x: marginX, y, size: 11, font: fontBold, color: negro });
  y -= 16;
  page.drawText(
    `${fecha(periodo.fechaInicio)} al ${fecha(periodo.fechaFin)}  ·  Vencimiento: ${fecha(periodo.vencimiento)}`,
    { x: marginX, y, size: 10, font, color: gris }
  );
  y -= 28;

  const torreLabel = unidad.torre === "GRANDE" ? "Torre Grande" : "Torre Chica";
  page.drawText(`Unidad: Piso ${unidad.piso} - Depto ${unidad.depto}  (${torreLabel})`, {
    x: marginX,
    y,
    size: 11,
    font: fontBold,
    color: negro,
  });
  y -= 16;
  page.drawText(`Titular: ${unidad.titular}   ·   Superficie: ${unidad.m2} m²`, {
    x: marginX,
    y,
    size: 10,
    font,
    color: gris,
  });
  y -= 30;

  page.drawLine({
    start: { x: marginX, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 22;

  const filas: [string, number][] = [
    ["Gasto común (prorrateo por coeficiente)", cargo.gastoComun],
    ["Cochera", cargo.cochera],
    ["Baulera", cargo.baulera],
    ["Uso de quincho", cargo.quincho],
    ["Calefacción / agua caliente", cargo.calefaccion],
  ];

  for (const [label, valor] of filas) {
    if (valor === 0) continue;
    page.drawText(label, { x: marginX, y, size: 10, font, color: negro });
    page.drawText(money(valor), { x: 420, y, size: 10, font, color: negro });
    y -= 18;
  }

  y -= 6;
  page.drawLine({ start: { x: marginX, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 20;

  page.drawText("Total del período", { x: marginX, y, size: 11, font: fontBold, color: negro });
  page.drawText(money(cargo.total), { x: 420, y, size: 11, font: fontBold, color: negro });
  y -= 20;

  page.drawText("Saldo anterior", { x: marginX, y, size: 10, font, color: gris });
  page.drawText(money(cargo.saldoAnterior), { x: 420, y, size: 10, font, color: gris });
  y -= 18;

  page.drawText("Pagos registrados", { x: marginX, y, size: 10, font, color: gris });
  page.drawText("- " + money(cargo.totalPagado), { x: 420, y, size: 10, font, color: gris });
  y -= 24;

  page.drawLine({ start: { x: marginX, y }, end: { x: 545, y }, thickness: 1.5, color: verde });
  y -= 24;

  page.drawText("TOTAL A PAGAR", { x: marginX, y, size: 13, font: fontBold, color: verde });
  page.drawText(money(cargo.saldoActual), { x: 400, y, size: 13, font: fontBold, color: verde });

  y -= 60;
  page.drawText("Administración Joaquín Rigueiro", { x: marginX, y, size: 9, font, color: gris });
  y -= 13;
  page.drawText("Cel. 223 5919009  ·  propiedadesjoaquinrigueiro@gmail.com", {
    x: marginX,
    y,
    size: 9,
    font,
    color: gris,
  });
  y -= 13;
  page.drawText("Pagos por transferencia o depósito. Avisar el pago por WhatsApp o email.", {
    x: marginX,
    y,
    size: 9,
    font,
    color: gris,
  });

  return doc.save();
}
