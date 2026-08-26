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

/**
 * Email de bienvenida cuando el admin le crea un acceso nuevo a un
 * propietario: explica como entrar, como instalar la app en la pantalla de
 * inicio del celular (PWA, no hace falta App Store/Play Store) y lo manda a
 * cambiar la contraseña provisoria que le puso el admin. Se dispara solo
 * cuando el acceso es realmente nuevo (ver crearAccesoPropietarioAction),
 * no cada vez que se edita uno existente.
 */
export async function enviarBienvenidaAccesoPorEmail(opts: {
  to: string;
  nombre: string;
  unidadLabel: string;
}) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const appUrl = process.env.NEXTAUTH_URL || "https://villagrandas.vercel.app";

  await t.sendMail({
    from,
    to: opts.to,
    subject: "Torres Villa Grandas - Ya tenés acceso a tu cuenta online",
    text:
      `Hola ${opts.nombre},\n\n` +
      `Te creamos un acceso al sistema online de administración de Torres Villa Grandas, para la unidad ${opts.unidadLabel}. ` +
      `Desde ahí podés ver tu cuenta corriente y las expensas, reservar los quinchos y hacer reclamos.\n\n` +
      `1) INGRESAR\n` +
      `Entrá desde el navegador de tu celular o computadora a:\n` +
      `${appUrl}\n` +
      `Usá este email (${opts.to}) y la contraseña que te dio la administración.\n\n` +
      `2) PONER LA APP EN LA PANTALLA DE INICIO DEL CELULAR (opcional, pero recomendado)\n` +
      `No hace falta descargar nada de App Store ni Play Store. Con la página ya abierta en tu celular:\n` +
      `- iPhone (Safari): tocá el ícono de compartir (el cuadrado con la flecha hacia arriba) y elegí "Agregar a pantalla de inicio".\n` +
      `- Android (Chrome): tocá los tres puntos de arriba a la derecha y elegí "Instalar app" o "Agregar a pantalla de inicio".\n` +
      `Va a quedar un ícono como el de cualquier otra app, y se abre directo sin pasar por el navegador.\n\n` +
      `3) CAMBIAR LA CONTRASEÑA\n` +
      `Por seguridad, una vez que entres te recomendamos cambiar la contraseña provisoria: la opción está al final de la página principal, en "Cambiar contraseña".\n\n` +
      `Cualquier duda, respondé este mismo email.\n\n` +
      `Administración Torres Villa Grandas\n` +
      `Administración Joaquín Rigueiro · Cel. 223 5919009`,
  });
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
