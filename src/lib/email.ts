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
      `Usá este email (${opts.to}) y la contraseña provisoria: cambiar1234\n\n` +
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

/**
 * Aviso a los admins cuando un propietario informa un pago desde la app
 * (con comprobante adjunto), para que lo revisen y lo confirmen o rechacen
 * en /admin/pagos-informados. Se manda a todos los usuarios con rol ADMIN
 * activos (no a un email fijo), para no depender de que sea siempre el
 * mismo admin el que lo vea.
 */
export async function enviarAvisoPagoInformadoPorEmail(opts: {
  to: string[];
  unidadLabel: string;
  monto: number;
}) {
  if (opts.to.length === 0) return;
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const appUrl = process.env.NEXTAUTH_URL || "https://villagrandas.vercel.app";

  await t.sendMail({
    from,
    to: opts.to.join(","),
    subject: `Torres Villa Grandas - Nuevo pago informado (${opts.unidadLabel})`,
    text:
      `Hola,\n\n` +
      `La unidad ${opts.unidadLabel} informó desde la app un pago de ${money(opts.monto)}, con comprobante adjunto.\n\n` +
      `Podés revisarlo y confirmarlo (o rechazarlo si no corresponde) entrando a:\n` +
      `${appUrl}/admin/pagos-informados\n\n` +
      `Mientras no lo confirmes, no se descuenta del saldo del propietario.\n\n` +
      `Administración Torres Villa Grandas`,
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

function turnoLabel(turno: "MEDIODIA" | "NOCHE") {
  return turno === "MEDIODIA" ? "Mediodía" : "Noche";
}

/**
 * Confirmación al propietario cuando reserva un quincho desde la app.
 */
export async function enviarConfirmacionReservaPorEmail(opts: {
  to: string;
  quinchoNombre: string;
  fecha: Date;
  turno: "MEDIODIA" | "NOCHE";
  unidadLabel: string;
  montoAplicado: number;
}) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const appUrl = process.env.NEXTAUTH_URL || "https://villagrandas.vercel.app";

  await t.sendMail({
    from,
    to: opts.to,
    subject: `Torres Villa Grandas - Reserva confirmada: ${opts.quinchoNombre} ${opts.fecha.toLocaleDateString("es-AR")}`,
    text:
      `Hola,\n\n` +
      `Confirmamos tu reserva del quincho ${opts.quinchoNombre} para la unidad ${opts.unidadLabel}:\n\n` +
      `Fecha: ${opts.fecha.toLocaleDateString("es-AR")}\n` +
      `Turno: ${turnoLabel(opts.turno)}\n` +
      `Monto a aplicar: ${money(opts.montoAplicado)}\n\n` +
      `Este monto se va a cargar en la próxima liquidación de expensas de la unidad.\n\n` +
      `Si necesitás cancelarla, podés hacerlo desde la app entrando a:\n` +
      `${appUrl}/propietario/reservas\n\n` +
      `Administración Torres Villa Grandas\n` +
      `Administración Joaquín Rigueiro · Cel. 223 5919009`,
  });
}

/**
 * Aviso a los admins cuando un propietario reserva un quincho desde la app.
 * Igual que con los pagos informados, se manda a todos los usuarios con rol
 * ADMIN activos, no a un email fijo.
 */
export async function enviarAvisoReservaPorEmail(opts: {
  to: string[];
  quinchoNombre: string;
  fecha: Date;
  turno: "MEDIODIA" | "NOCHE";
  unidadLabel: string;
}) {
  if (opts.to.length === 0) return;
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const appUrl = process.env.NEXTAUTH_URL || "https://villagrandas.vercel.app";

  await t.sendMail({
    from,
    to: opts.to.join(","),
    subject: `Torres Villa Grandas - Nueva reserva de quincho (${opts.unidadLabel})`,
    text:
      `Hola,\n\n` +
      `La unidad ${opts.unidadLabel} reservó el quincho ${opts.quinchoNombre}:\n\n` +
      `Fecha: ${opts.fecha.toLocaleDateString("es-AR")}\n` +
      `Turno: ${turnoLabel(opts.turno)}\n\n` +
      `Podés ver el detalle entrando a:\n` +
      `${appUrl}/admin/reservas\n\n` +
      `Administración Torres Villa Grandas`,
  });
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
      `FORMAS DE PAGO\n` +
      `El pago se puede hacer en efectivo, por transferencia o por depósito.\n\n` +
      `Si pagás por transferencia o depósito, por favor informalo a través de la app cargando el comprobante. No se aceptarán comprobantes por WhatsApp.\n\n` +
      `DATOS BANCARIOS\n` +
      `NOMBRE: COSTA TRANS VIAL\n` +
      `CUIT: 30-53466745-7\n` +
      `BANCO: SANTANDER\n` +
      `CVU: 0720067020000001754504\n` +
      `ALIAS: PUMA.ALPACA.AXILA\n\n` +
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
