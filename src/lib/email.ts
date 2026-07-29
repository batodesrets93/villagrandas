import nodemailer, { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "Falta configurar el envío de emails: definí SMTP_HOST, SMTP_USER y SMTP_PASS en las variables de entorno (.env en local, o Environment Variables en Vercel)."
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

export async function enviarRespuestaReclamoPorEmail(opts: {
  to: string;
  titulo: string;
  respuesta: string;
  cerrado: boolean;
}) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

  await t.sendMail({
    from,
    to: opts.to,
    subject: `Torres Villa Grandas - Respuesta a tu reclamo: ${opts.titulo}`,
    text:
      `Hola,\n\n` +
      `Administración respondió tu reclamo "${opts.titulo}":\n\n` +
      `${opts.respuesta}\n\n` +
      (opts.cerrado
        ? `Este reclamo quedó marcado como cerrado.\n\n`
        : `Podés ver el estado del reclamo ingresando a tu cuenta.\n\n`) +
      `Administración Torres Villa Grandas\n` +
      `Administración Joaquín Rigueiro · Cel. 223 5919009`,
  });
}

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function enviarLiquidacionPorEmail(opts: {
  to: string;
  unidadLabel: string;
  periodoEtiqueta: string;
  vencimiento: Date;
  totalAPagar: number;
  pdfBytes: Uint8Array;
  nombreArchivo: string;
}) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

  await t.sendMail({
    from,
    to: opts.to,
    subject: `Torres Villa Grandas - Expensas ${opts.periodoEtiqueta} - ${opts.unidadLabel}`,
    text:
      `Hola,\n\n` +
      `Te adjuntamos la liquidación de expensas del período ${opts.periodoEtiqueta} correspondiente a la unidad ${opts.unidadLabel}.\n\n` +
      `Total a pagar: ${money(opts.totalAPagar)}\n` +
      `Vencimiento: ${opts.vencimiento.toLocaleDateString("es-AR")}\n\n` +
      `Los pagos se hacen por transferencia o depósito; avisanos por WhatsApp o email cuando lo hagas.\n\n` +
      `Administración Torres Villa Grandas\n` +
      `Administración Joaquín Rigueiro · Cel. 223 5919009`,
    attachments: [
      {
        filename: opts.nombreArchivo,
        content: Buffer.from(opts.pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });
}
