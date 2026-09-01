"use server";

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoriaReclamo } from "@prisma/client";
import {
  crearPeriodoYCalcular,
  actualizarPeriodoYCalcular,
  registrarPago,
  confirmarPagoInformado,
  rechazarPagoInformado,
  actualizarCalefaccion,
  calcularTotalM2Edificio,
  agruparM2ComplementariosPorUnidad,
  calcularGasPeriodo,
  MONTO_QUINCHO,
} from "@/lib/calculo";
import { generarPdfLiquidacion } from "@/lib/pdf";
import {
  enviarLiquidacionPorEmail,
  enviarRespuestaReclamoPorEmail,
  enviarBienvenidaAccesoPorEmail,
  enviarAvisoPagoInformadoPorEmail,
} from "@/lib/email";

// Extrae un detalle legible de cualquier error atrapado, para poder
// mostrarlo en pantalla. Los errores de Prisma (PrismaClientKnownRequestError,
// PrismaClientValidationError, etc.) tienen "code" y "message"; los errores
// comunes de JS solo tienen "message". Si no se puede extraer nada útil, no
// se agrega nada al texto (mejor un mensaje genérico que uno vacío/raro).
function detalleError(e: unknown): string {
  if (e && typeof e === "object") {
    const code = "code" in e ? String((e as { code: unknown }).code) : undefined;
    const message = "message" in e ? String((e as { message: unknown }).message) : undefined;
    if (code && message) return `${code}: ${message}`;
    if (message) return message;
  }
  return String(e);
}

/**
 * Interpreta un monto escrito a mano, aceptando cualquiera de estas formas:
 *   1801246.07   (punto como decimal, sin separador de miles)
 *   1801246      (sin separadores)
 *   1.801.246    (punto como separador de miles, sin decimales)
 *   1.801.246,07 (formato argentino: punto de miles, coma decimal)
 *   1801246,07   (coma como decimal, sin separador de miles)
 */
function parseMonto(raw: string | undefined | null): number {
  if (!raw) return 0;
  let s = String(raw).trim().replace(/[^\d.,-]/g, "");
  if (s === "") return 0;

  const tieneComa = s.includes(",");
  const tienePunto = s.includes(".");

  if (tieneComa && tienePunto) {
    // Formato argentino: 1.801.246,07 -> el punto es separador de miles
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (tieneComa && !tienePunto) {
    // 1801246,07 -> la coma es el separador decimal
    s = s.replace(",", ".");
  } else if (tienePunto && !tieneComa) {
    const partes = s.split(".");
    const ultima = partes[partes.length - 1];
    if (partes.length === 2 && ultima.length <= 2) {
      // 1801246.07 -> el punto ya es decimal, se deja como está
    } else {
      // 1.801.246 (o varios puntos) -> son separadores de miles
      s = s.replace(/\./g, "");
    }
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.rol !== "ADMIN") throw new Error("No autorizado");
  return session;
}

async function requirePropietario() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.rol !== "PROPIETARIO" || !session.user.unidadId) {
    throw new Error("No autorizado");
  }
  return session;
}

// ---------- ADMIN: expensas ----------

type ResultadoAccion<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// Nota sobre manejo de errores: Next.js oculta en producción el mensaje real
// de cualquier error que se "lance" (throw) desde una Server Action, y lo
// reemplaza por el texto generico "An error occurred in the Server
// Components render...". Por eso estas acciones NO lanzan errores de
// validacion: los devuelven como dato (`{ ok: false, error: "..." }`), y el
// componente que las llama decide que mostrar. Los errores realmente
// inesperados se registran con console.error (visibles en los logs de
// Vercel) y se devuelve un mensaje generico pero legible.

export async function crearPeriodoAction(formData: FormData): Promise<ResultadoAccion<{ id: string }>> {
  try {
    await requireAdmin();

    const etiqueta = String(formData.get("etiqueta"));
    const fechaInicio = new Date(String(formData.get("fechaInicio")));
    const fechaFin = new Date(String(formData.get("fechaFin")));
    const vencimiento = new Date(String(formData.get("vencimiento")));

    const nombres = formData.getAll("catNombre") as string[];
    const montos = formData.getAll("catMonto") as string[];
    const fondos = formData.getAll("catFondo") as string[]; // indices marcados

    const categorias = nombres
      .map((nombre, i) => ({
        nombre,
        monto: parseMonto(montos[i]),
        esFondoReserva: fondos.includes(String(i)),
      }))
      .filter((c) => c.nombre.trim() !== "" && c.monto > 0);

    if (categorias.length === 0) {
      return { ok: false, error: "Agregá al menos una categoría de gasto con monto." };
    }
    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime()) || isNaN(vencimiento.getTime())) {
      return { ok: false, error: "Revisá las 3 fechas, alguna quedó vacía o mal escrita." };
    }

    const periodo = await crearPeriodoYCalcular({ etiqueta, fechaInicio, fechaFin, vencimiento, categorias });

    revalidatePath("/admin/expensas");
    return { ok: true, data: { id: periodo.id } };
  } catch (e) {
    console.error("[crearPeriodoAction] Error inesperado:", e);
    return {
      ok: false,
      error:
        "No se pudo liquidar el período por un error inesperado en el servidor. Probá de nuevo en un minuto; si se repite, revisá los logs de Vercel (pestaña Logs del proyecto) para ver el detalle.",
    };
  }
}

export async function actualizarPeriodoAction(formData: FormData): Promise<ResultadoAccion<{ id: string }>> {
  try {
    await requireAdmin();

    const periodoId = String(formData.get("periodoId"));
    const etiqueta = String(formData.get("etiqueta"));
    const fechaInicio = new Date(String(formData.get("fechaInicio")));
    const fechaFin = new Date(String(formData.get("fechaFin")));
    const vencimiento = new Date(String(formData.get("vencimiento")));

    const nombres = formData.getAll("catNombre") as string[];
    const montos = formData.getAll("catMonto") as string[];
    const fondos = formData.getAll("catFondo") as string[];

    const categorias = nombres
      .map((nombre, i) => ({
        nombre,
        monto: parseMonto(montos[i]),
        esFondoReserva: fondos.includes(String(i)),
      }))
      .filter((c) => c.nombre.trim() !== "" && c.monto > 0);

    if (!periodoId) {
      return { ok: false, error: "No se encontró el período a editar." };
    }
    if (categorias.length === 0) {
      return { ok: false, error: "Agregá al menos una categoría de gasto con monto." };
    }
    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime()) || isNaN(vencimiento.getTime())) {
      return { ok: false, error: "Revisá las 3 fechas, alguna quedó vacía o mal escrita." };
    }

    await actualizarPeriodoYCalcular(periodoId, { etiqueta, fechaInicio, fechaFin, vencimiento, categorias });

    revalidatePath("/admin/expensas");
    revalidatePath(`/admin/expensas/${periodoId}`);
    revalidatePath("/propietario");
    return { ok: true, data: { id: periodoId } };
  } catch (e) {
    console.error("[actualizarPeriodoAction] Error inesperado:", e);
    return {
      ok: false,
      error: "No se pudo actualizar el período por un error inesperado en el servidor. Probá de nuevo en un minuto.",
    };
  }
}

export async function registrarPagoAction(formData: FormData): Promise<void> {
  try {
    await requireAdmin();
    const cargoId = String(formData.get("cargoId"));
    const monto = parseMonto(String(formData.get("monto")));
    const medio = String(formData.get("medio") || "");
    const nota = String(formData.get("nota") || "");
    if (!cargoId || !monto || monto <= 0) {
      console.error("[registrarPagoAction] Monto inválido:", formData.get("monto"));
      return;
    }

       await registrarPago(cargoId, monto, medio, nota);
    revalidatePath("/admin/expensas");
    revalidatePath("/propietario");
  } catch (e) {
    console.error("[registrarPagoAction] Error inesperado:", e);
  }
}

// Registra varios pagos de una sola vez (importación desde Excel: ver
// ImportarPagosForm.tsx). Cada fila inválida o con error individual se
// descarta sin frenar al resto; al final se informa cuántos se guardaron
// y, si hubo problemas, un detalle de los primeros para que el admin los
// pueda corregir y reintentar solo esos.
export async function registrarPagosMasivoAction(
  pagos: { cargoId: string; monto: number; fecha?: string; medio?: string; nota?: string }[]
): Promise<ResultadoAccion<{ cantidad: number; omitidos: number; detalleErrores: string[] }>> {
  try {
    await requireAdmin();
    if (!Array.isArray(pagos) || pagos.length === 0) {
      return { ok: false, error: "No se recibió ningún pago para registrar." };
    }

    let cantidad = 0;
    let omitidos = 0;
    const detalleErrores: string[] = [];

    for (const p of pagos) {
      const cargoId = String(p.cargoId || "");
      const monto = typeof p.monto === "number" ? p.monto : parseMonto(String(p.monto ?? ""));
      if (!cargoId || !monto || monto <= 0) {
        omitidos++;
        continue;
      }
      const fecha = p.fecha ? new Date(p.fecha) : undefined;
      const fechaValida = fecha && !isNaN(fecha.getTime()) ? fecha : undefined;
      try {
        await registrarPago(cargoId, monto, p.medio || undefined, p.nota || undefined, fechaValida);
        cantidad++;
      } catch (e) {
        omitidos++;
        if (detalleErrores.length < 5) detalleErrores.push(`Unidad (id ${cargoId}): ${detalleError(e)}`);
      }
    }

    revalidatePath("/admin/expensas");
    revalidatePath("/propietario");

    if (cantidad === 0) {
      return {
        ok: false,
        error:
          detalleErrores.length > 0
            ? `No se pudo registrar ningún pago. ${detalleErrores.join(" · ")}`
            : "No había pagos válidos para registrar: completá la columna Monto con un número mayor a 0 en al menos una fila.",
      };
    }

    return { ok: true, data: { cantidad, omitidos, detalleErrores } };
  } catch (e) {
    console.error("[registrarPagosMasivoAction] Error inesperado:", e);
    return {
      ok: false,
      error: "No se pudieron registrar los pagos por un error inesperado en el servidor. Probá de nuevo en un minuto.",
    };
  }
}

export async function actualizarCalefaccionAction(formData: FormData): Promise<void> {
  try {
    await requireAdmin();
    const cargoId = String(formData.get("cargoId"));
    const calefaccion = parseMonto(String(formData.get("calefaccion")));
    await actualizarCalefaccion(cargoId, calefaccion);
    revalidatePath("/admin/expensas");
  } catch (e) {
    console.error("[actualizarCalefaccionAction] Error inesperado:", e);
  }
}

// Calcula el gas/calefacción del período a partir de las 2 facturas (Torre
// Grande y Torre Chica) y la lectura actual de cada medidor, y reemplaza la
// calefacción de cada unidad por el monto calculado (ver calcularGasPeriodo
// en calculo.ts). Las lecturas llegan como 2 arrays paralelos: la posición i
// de "lecturaUnidadId" corresponde a la posición i de "lecturaActual".
export async function calcularGasAction(formData: FormData): Promise<ResultadoAccion<{ id: string }>> {
  try {
    await requireAdmin();

    const periodoId = String(formData.get("periodoId"));
    const facturaGasTorreGrande = parseMonto(String(formData.get("facturaGasTorreGrande")));
    const facturaGasTorreChica = parseMonto(String(formData.get("facturaGasTorreChica")));

    const unidadIds = formData.getAll("lecturaUnidadId") as string[];
    const lecturasActuales = formData.getAll("lecturaActual") as string[];
    const lecturasAnterioresIniciales = formData.getAll("lecturaAnteriorInicial") as string[];
    const lecturas = unidadIds.map((unidadId, i) => ({
      unidadId,
      lecturaActual: parseMonto(lecturasActuales[i]),
      lecturaAnteriorInicial:
        lecturasAnterioresIniciales[i] !== undefined && lecturasAnterioresIniciales[i] !== ""
          ? parseMonto(lecturasAnterioresIniciales[i])
          : undefined,
    }));

    if (facturaGasTorreGrande <= 0 || facturaGasTorreChica <= 0) {
      return { ok: false, error: "Ingresá el monto de las dos facturas de gas (Torre Grande y Torre Chica)." };
    }

    await calcularGasPeriodo(periodoId, { facturaGasTorreGrande, facturaGasTorreChica, lecturas });

    revalidatePath(`/admin/expensas/${periodoId}`);
    revalidatePath(`/admin/expensas/${periodoId}/gas`);
    return { ok: true, data: { id: periodoId } };
  } catch (e) {
    console.error("[calcularGasAction] Error inesperado:", e);
    return {
      ok: false,
      error:
        "No se pudo calcular el gas por un error inesperado en el servidor. Probá de nuevo en un minuto; si se repite, revisá los logs de Vercel (pestaña Logs del proyecto) para ver el detalle. " +
        `Detalle: ${detalleError(e)}`,
    };
  }
}

export async function eliminarPeriodoAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    await requireAdmin();
    const periodoId = String(formData.get("periodoId"));

    await prisma.$transaction(async (tx) => {
      const cargos = await tx.cargoUnidadPeriodo.findMany({ where: { periodoId }, select: { id: true } });
      const cargoIds = cargos.map((c) => c.id);

      // Las reservas de quincho que habían quedado facturadas en este período
      // vuelven a quedar "pendientes de facturar", para que se cobren en el
      // próximo período que se liquide bien.
      if (cargoIds.length > 0) {
        await tx.reserva.updateMany({
          where: { cargoId: { in: cargoIds } },
          data: { cargoId: null },
        });
      }

      // Al borrar el período se borran en cascada sus categorías de gasto,
      // los cargos por unidad y los pagos que se hubieran registrado ahí.
      await tx.periodoExpensa.delete({ where: { id: periodoId } });
    });

    revalidatePath("/admin/expensas");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[eliminarPeriodoAction] Error inesperado:", e);
    return { ok: false, error: "No se pudo eliminar el período por un error inesperado. Probá de nuevo." };
  }
}

function unidadLabel(u: { torre: "GRANDE" | "CHICA"; piso: string; depto: string }) {
  return `${u.torre === "GRANDE" ? "TG" : "TC"} ${u.piso}º${u.depto}`;
}

/**
 * Genera el PDF de liquidación de cada unidad (o de una sola, si se pasa
 * `cargoId`) y lo envía por email a las direcciones registradas de esa
 * unidad (los emails con los que sus propietarios tienen acceso al sitio).
 * Las unidades sin ningún usuario con acceso creado se listan en `sinEmail`
 * para que el admin sepa a quién le falta cargar el acceso.
 */
export async function enviarLiquidacionesPorEmailAction(
  formData: FormData
): Promise<ResultadoAccion<{ enviados: number; sinEmail: string[] }>> {
  try {
    await requireAdmin();
    const periodoId = String(formData.get("periodoId"));
    const cargoIdRaw = formData.get("cargoId");
    const cargoId = cargoIdRaw ? String(cargoIdRaw) : null;

    const periodo = await prisma.periodoExpensa.findUniqueOrThrow({
      where: { id: periodoId },
      include: {
        cargos: {
          where: cargoId ? { id: cargoId } : undefined,
          include: { unidad: { include: { usuarios: true } } },
        },
      },
    });

    if (periodo.cargos.length === 0) {
      return { ok: false, error: "No hay unidades para enviar en este período." };
    }

    const totalM2Edificio = await calcularTotalM2Edificio();
    const m2ComplementariosPorUnidad = await agruparM2ComplementariosPorUnidad();

    let enviados = 0;
    const sinEmail: string[] = [];

    for (const cargo of periodo.cargos) {
      const label = unidadLabel(cargo.unidad);
      const emails = Array.from(new Set(cargo.unidad.usuarios.map((u) => u.email).filter(Boolean)));

      if (emails.length === 0) {
        sinEmail.push(label);
        continue;
      }

      const m2Complementarios = m2ComplementariosPorUnidad.get(cargo.unidad.id);

      const pdfBytes = await generarPdfLiquidacion(
        {
          torre: cargo.unidad.torre,
          piso: cargo.unidad.piso,
          depto: cargo.unidad.depto,
          titular: cargo.unidad.titular,
          m2: cargo.unidad.m2,
          cocheraM2: m2Complementarios?.cocheraM2 ?? 0,
          bauleraM2: m2Complementarios?.bauleraM2 ?? 0,
        },
        {
          etiqueta: periodo.etiqueta,
          fechaInicio: periodo.fechaInicio,
          fechaFin: periodo.fechaFin,
          vencimiento: periodo.vencimiento,
        },
        {
          gastoComun: cargo.gastoComun,
          cochera: cargo.cochera,
          baulera: cargo.baulera,
          quincho: cargo.quincho,
          calefaccion: cargo.calefaccion,
          total: cargo.total,
          saldoAnterior: cargo.saldoAnterior,
          totalPagado: cargo.totalPagado,
          saldoActual: cargo.saldoActual,
        },
        totalM2Edificio
      );

      const nombreArchivo = `expensa_${cargo.unidad.piso}${cargo.unidad.depto}_${periodo.etiqueta.replace(/\s+/g, "_")}.pdf`;

      for (const email of emails) {
        await enviarLiquidacionPorEmail({
          to: email,
          unidadLabel: label,
          periodoEtiqueta: periodo.etiqueta,
          vencimiento: periodo.vencimiento,
          totalAPagar: cargo.saldoActual,
          pdfBytes,
          nombreArchivo,
        });
      }
      enviados++;
    }

    return { ok: true, data: { enviados, sinEmail } };
  } catch (e) {
    console.error("[enviarLiquidacionesPorEmailAction] Error inesperado:", e);
    const mensaje = e instanceof Error ? e.message : "";
    return {
      ok: false,
      error: mensaje.startsWith("Falta configurar")
        ? mensaje
        : "No se pudieron enviar los emails por un error inesperado en el servidor. Probá de nuevo en un minuto; si se repite, revisá los logs de Vercel.",
    };
  }
}

// ---------- ADMIN: comprobantes de gastos ----------

const TIPOS_COMPROBANTE_PERMITIDOS = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
const TAMANIO_MAXIMO_COMPROBANTE = 8 * 1024 * 1024; // 8 MB

export async function subirComprobanteAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    await requireAdmin();

    const gastoId = String(formData.get("gastoId"));
    const archivo = formData.get("archivo") as File | null;

    if (!gastoId) {
      return { ok: false, error: "Falta el gasto al que corresponde el comprobante." };
    }
    if (!archivo || archivo.size === 0) {
      return { ok: false, error: "Elegí un archivo para subir." };
    }
    if (!TIPOS_COMPROBANTE_PERMITIDOS.includes(archivo.type)) {
      return { ok: false, error: "Solo se aceptan archivos PDF, JPG, PNG o WEBP." };
    }
    if (archivo.size > TAMANIO_MAXIMO_COMPROBANTE) {
      return { ok: false, error: "El archivo no puede superar los 8 MB." };
    }

    const gasto = await prisma.gastoCategoria.findUnique({ where: { id: gastoId }, select: { periodoId: true } });
    if (!gasto) {
      return { ok: false, error: "No se encontró el gasto correspondiente." };
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());

    await prisma.comprobante.create({
      data: {
        gastoId,
        nombreArchivo: archivo.name || "comprobante",
        tipoArchivo: archivo.type,
        tamanio: archivo.size,
        datos: buffer,
      },
    });

    revalidatePath(`/admin/expensas/${gasto.periodoId}`);
    revalidatePath("/propietario");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[subirComprobanteAction] Error inesperado:", e);
    return {
      ok: false,
      error: "No se pudo subir el comprobante por un error inesperado en el servidor. Probá de nuevo en un minuto.",
    };
  }
}

export async function eliminarComprobanteAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    await requireAdmin();
    const comprobanteId = String(formData.get("comprobanteId"));

    const comprobante = await prisma.comprobante.findUnique({
      where: { id: comprobanteId },
      select: { gasto: { select: { periodoId: true } } },
    });
    if (!comprobante) {
      return { ok: false, error: "No se encontró el comprobante." };
    }

    await prisma.comprobante.delete({ where: { id: comprobanteId } });

    revalidatePath(`/admin/expensas/${comprobante.gasto.periodoId}`);
    revalidatePath("/propietario");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[eliminarComprobanteAction] Error inesperado:", e);
    return {
      ok: false,
      error: "No se pudo eliminar el comprobante por un error inesperado en el servidor. Probá de nuevo en un minuto.",
    };
  }
}

// ---------- ADMIN: unidades / propietarios ----------

export async function crearAccesoPropietarioAction(formData: FormData) {
  await requireAdmin();
  const unidadId = String(formData.get("unidadId"));
  const email = String(formData.get("email")).toLowerCase().trim();
  const nombre = String(formData.get("nombre"));
  const password = String(formData.get("password"));

  if (!email || !password || password.length < 6) {
    throw new Error("Email y contraseña (mínimo 6 caracteres) son obligatorios.");
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.usuario.upsert({
    where: { email },
    update: { unidadId, nombre, passwordHash },
    create: { email, nombre, passwordHash, rol: "PROPIETARIO", unidadId },
  });

  revalidatePath("/admin/unidades");

  // Solo mandamos el email de bienvenida si el acceso es realmente nuevo
  // (si ya existia, esto fue una edicion desde crearAccesoPropietarioAction
  // -- por ejemplo, reasignar un email existente a otra unidad -- y no
  // corresponde re-mandar las instrucciones de instalacion).
  if (!existente) {
    const unidad = await prisma.unidad.findUnique({
      where: { id: unidadId },
      select: { torre: true, piso: true, depto: true },
    });
    if (unidad) {
      try {
        await enviarBienvenidaAccesoPorEmail({ to: email, nombre, unidadLabel: unidadLabel(unidad) });
      } catch (e) {
        // No hacemos fallar la creacion del acceso si el email no se pudo
        // mandar (por ejemplo, SMTP mal configurado): el acceso ya quedo
        // creado y funciona igual, el admin puede avisarle a mano.
        console.error("[crearAccesoPropietarioAction] No se pudo enviar el email de bienvenida:", e);
      }
    }
  }
}

export async function marcarDesarrolladorAction(formData: FormData) {
  await requireAdmin();
  const unidadId = String(formData.get("unidadId"));
  const esDesarrollador = formData.get("esDesarrollador") === "on";

  await prisma.unidad.update({
    where: { id: unidadId },
    data: { esDesarrollador },
  });

  revalidatePath("/admin/unidades");
  revalidatePath("/admin");
}

/**
 * Cambia el titular (nombre del dueño) de una unidad. No toca los accesos
 * (usuarios/emails): eso se maneja aparte, con crearAccesoPropietarioAction,
 * editarAccesoAction y cambiarEstadoAccesoAction. Se usa, por ejemplo,
 * cuando se vende un depto y hay que actualizar quién figura como dueño.
 */
export async function actualizarTitularAction(formData: FormData) {
  await requireAdmin();
  const unidadId = String(formData.get("unidadId"));
  const titular = String(formData.get("titular")).trim();

  if (!titular) {
    throw new Error("El nombre del titular no puede quedar vacío.");
  }

  await prisma.unidad.update({
    where: { id: unidadId },
    data: { titular },
  });

  revalidatePath("/admin/unidades");
  revalidatePath(`/admin/unidades/${unidadId}`);
}

/**
 * Edita un acceso ya existente (nombre, email, y opcionalmente contraseña).
 * A diferencia de crearAccesoPropietarioAction (que hace upsert por email),
 * esta busca al usuario por id, asi que puede cambiarle el email sin
 * confundirlo con otro usuario. Si el email nuevo ya esta en uso por otro
 * acceso, Prisma tira un error de restriccion unica que se propaga como
 * mensaje legible.
 */
export async function editarAccesoAction(formData: FormData) {
  await requireAdmin();
  const usuarioId = String(formData.get("usuarioId"));
  const nombre = String(formData.get("nombre")).trim();
  const email = String(formData.get("email")).toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  if (!nombre || !email) {
    throw new Error("Nombre y email son obligatorios.");
  }
  if (password && password.length < 6) {
    throw new Error("La contraseña nueva debe tener al menos 6 caracteres.");
  }

  const data: { nombre: string; email: string; passwordHash?: string } = { nombre, email };
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  try {
    await prisma.usuario.update({ where: { id: usuarioId }, data });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: unknown }).code === "P2002") {
      throw new Error("Ese email ya está en uso por otro acceso.");
    }
    throw e;
  }

  revalidatePath("/admin/unidades");
}

/**
 * Revoca o reactiva un acceso (campo Usuario.activo). Revocar bloquea el
 * login sin borrar al usuario, para no perder su historial de reclamos y
 * reservas. Se usa, por ejemplo, para dar de baja al dueño viejo cuando se
 * vende un depto, manteniendo el acceso nuevo del comprador.
 */
export async function cambiarEstadoAccesoAction(formData: FormData) {
  await requireAdmin();
  const usuarioId = String(formData.get("usuarioId"));
  const activo = String(formData.get("activo")) === "true";

  await prisma.usuario.update({ where: { id: usuarioId }, data: { activo } });

  revalidatePath("/admin/unidades");
}

// ---------- ADMIN: cocheras y bauleras ----------

/**
 * Asigna (o desasigna, si unidadId viene vacío) una cochera a una unidad.
 * Solo cambia a quién se le cobra DE ACÁ EN ADELANTE: los períodos ya
 * generados no se recalculan, porque son liquidaciones cerradas de meses
 * anteriores.
 */
export async function asignarCocheraAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    await requireAdmin();
    const cocheraId = String(formData.get("cocheraId"));
    const unidadIdRaw = String(formData.get("unidadId") ?? "");
    const unidadId = unidadIdRaw.trim() === "" ? null : unidadIdRaw;

    await prisma.cochera.update({ where: { id: cocheraId }, data: { unidadId } });

    revalidatePath("/admin/cocheras-bauleras");
    revalidatePath("/admin/unidades");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[asignarCocheraAction] Error inesperado:", e);
    return { ok: false, error: "No se pudo asignar la cochera. Probá de nuevo en un minuto." };
  }
}

/** Igual que asignarCocheraAction, pero para bauleras. */
export async function asignarBauleraAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    await requireAdmin();
    const bauleraId = String(formData.get("bauleraId"));
    const unidadIdRaw = String(formData.get("unidadId") ?? "");
    const unidadId = unidadIdRaw.trim() === "" ? null : unidadIdRaw;

    await prisma.baulera.update({ where: { id: bauleraId }, data: { unidadId } });

    revalidatePath("/admin/cocheras-bauleras");
    revalidatePath("/admin/unidades");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[asignarBauleraAction] Error inesperado:", e);
    return { ok: false, error: "No se pudo asignar la baulera. Probá de nuevo en un minuto." };
  }
}

// ---------- RESERVAS (propietario y admin) ----------

export async function crearReservaAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    const session = await requirePropietario();
    const quinchoId = String(formData.get("quinchoId"));
    const fecha = new Date(String(formData.get("fecha")));
    const turno = String(formData.get("turno")) as "MEDIODIA" | "NOCHE";

    if (isNaN(fecha.getTime())) {
      return { ok: false, error: "Elegí una fecha válida." };
    }

    const ahora = new Date();
    const horasHastaEvento = (fecha.getTime() - ahora.getTime()) / (1000 * 60 * 60);
    if (horasHastaEvento < 24) {
      return { ok: false, error: "Las reservas deben hacerse con un mínimo de 24 horas de anticipación." };
    }

    const existente = await prisma.reserva.findFirst({
      where: { quinchoId, fecha, turno, estado: "CONFIRMADA" },
    });
    if (existente) {
      return { ok: false, error: "Ese quincho ya está reservado para ese día y turno." };
    }

    await prisma.reserva.create({
      data: {
        quinchoId,
        fecha,
        turno,
        unidadId: session.user.unidadId!,
        usuarioId: session.user.id,
        montoAplicado: MONTO_QUINCHO,
      },
    });

    revalidatePath("/propietario/reservas");
    revalidatePath("/admin/reservas");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[crearReservaAction] Error inesperado:", e);
    return { ok: false, error: "No se pudo crear la reserva por un error inesperado. Probá de nuevo en un minuto." };
  }
}

export async function cancelarReservaAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("No autorizado");
  const reservaId = String(formData.get("reservaId"));

  const reserva = await prisma.reserva.findUniqueOrThrow({ where: { id: reservaId } });
  const esDueño = session.user.rol === "PROPIETARIO" && reserva.unidadId === session.user.unidadId;
  const esAdmin = session.user.rol === "ADMIN";
  if (!esDueño && !esAdmin) throw new Error("No autorizado");
  if (reserva.cargoId) throw new Error("No se puede cancelar: ya fue facturada en una liquidación.");

  await prisma.reserva.update({ where: { id: reservaId }, data: { estado: "CANCELADA" } });
  revalidatePath("/propietario/reservas");
  revalidatePath("/admin/reservas");
}

// ---------- PAGOS INFORMADOS ----------

const TIPOS_ADJUNTO_PAGO_PERMITIDOS = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
const TAMANIO_MAXIMO_ADJUNTO_PAGO = 8 * 1024 * 1024; // 8 MB
const MAX_ADJUNTOS_PAGO = 5;

// El propietario informa un pago (con uno o más comprobantes) para un cargo
// (liquidación) puntual. Queda en estado PENDIENTE: todavía NO se descuenta
// del saldo, eso pasa recién cuando el admin lo confirma (ver
// confirmarPagoInformadoAction) después de verlo acreditado en la cuenta del
// edificio.
export async function informarPagoAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    const session = await requirePropietario();
    const cargoId = String(formData.get("cargoId"));
    const monto = parseMonto(String(formData.get("monto")));
    const fechaRaw = String(formData.get("fecha") || "");
    const medio = String(formData.get("medio") || "").trim();
    const nota = String(formData.get("nota") || "").trim();

    if (!cargoId) {
      return { ok: false, error: "No se encontró la liquidación correspondiente." };
    }
    if (!monto || monto <= 0) {
      return { ok: false, error: "Ingresá el monto que pagaste." };
    }
    const fecha = fechaRaw ? new Date(fechaRaw) : new Date();
    if (isNaN(fecha.getTime())) {
      return { ok: false, error: "La fecha del pago no es válida." };
    }

    // El cargo tiene que pertenecer a la propia unidad del propietario
    // logueado (nunca confiar en el cargoId que llega del form sin
    // verificarlo contra la sesión).
    const cargo = await prisma.cargoUnidadPeriodo.findUnique({
      where: { id: cargoId },
      select: { unidadId: true },
    });
    if (!cargo || cargo.unidadId !== session.user.unidadId) {
      return { ok: false, error: "No autorizado." };
    }

    // Evita duplicados por doble envío (doble clic, reenvío manual por
    // conexión lenta, etc.): si ya hay un pago informado PENDIENTE para el
    // mismo cargo y el mismo monto, no se crea otro.
    const yaInformado = await prisma.pagoInformado.findFirst({
      where: { cargoId, monto, estado: "PENDIENTE" },
      select: { id: true },
    });
    if (yaInformado) {
      return {
        ok: false,
        error: "Ya informaste un pago pendiente por ese mismo monto para este período. Esperá a que la administración lo confirme.",
      };
    }

    const archivos = formData
      .getAll("archivos")
      .filter((a): a is File => a instanceof File && a.size > 0);

    if (archivos.length === 0) {
      return { ok: false, error: "Adjuntá al menos un comprobante." };
    }
    if (archivos.length > MAX_ADJUNTOS_PAGO) {
      return { ok: false, error: `Podés adjuntar hasta ${MAX_ADJUNTOS_PAGO} archivos.` };
    }
    for (const archivo of archivos) {
      if (!TIPOS_ADJUNTO_PAGO_PERMITIDOS.includes(archivo.type)) {
        return { ok: false, error: `${archivo.name}: solo se aceptan archivos PDF, JPG, PNG o WEBP.` };
      }
      if (archivo.size > TAMANIO_MAXIMO_ADJUNTO_PAGO) {
        return { ok: false, error: `${archivo.name}: el archivo no puede superar los 8 MB.` };
      }
    }

    const pagoInformado = await prisma.pagoInformado.create({
      data: { cargoId, monto, fecha, medio: medio || null, nota: nota || null },
    });

    for (const archivo of archivos) {
      const buffer = Buffer.from(await archivo.arrayBuffer());
      await prisma.comprobantePagoInformado.create({
        data: {
          pagoInformadoId: pagoInformado.id,
          nombreArchivo: archivo.name || "comprobante",
          tipoArchivo: archivo.type,
          tamanio: archivo.size,
          datos: buffer,
        },
      });
    }

    revalidatePath("/propietario");
    revalidatePath("/admin/pagos-informados");

    try {
      const [unidad, admins] = await Promise.all([
        prisma.unidad.findUnique({ where: { id: session.user.unidadId! } }),
        prisma.usuario.findMany({ where: { rol: "ADMIN", activo: true }, select: { email: true } }),
      ]);
      if (unidad && admins.length > 0) {
        await enviarAvisoPagoInformadoPorEmail({
          to: admins.map((a) => a.email),
          unidadLabel: `${unidad.torre === "GRANDE" ? "Torre Grande" : "Torre Chica"} - Piso ${unidad.piso} Depto ${unidad.depto}`,
          monto,
        });
      }
    } catch (e) {
      // No bloqueamos el informe de pago si falla el email de aviso al admin.
      console.error("[informarPagoAction] No se pudo enviar el email de aviso:", e);
    }

    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[informarPagoAction] Error inesperado:", e);
    return {
      ok: false,
      error: "No se pudo informar el pago por un error inesperado. Probá de nuevo en un minuto.",
    };
  }
}

// El admin confirma un pago informado DESPUÉS de verlo acreditado en la
// cuenta del edificio: recién ahí se crea el Pago real y se descuenta del
// saldo del propietario (ver confirmarPagoInformado en calculo.ts). El medio
// se puede ajustar acá (ej: el propietario tildó "Transferencia" pero en
// realidad pagó en mano y el admin lo corrige a "Efectivo").
export async function confirmarPagoInformadoAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    await requireAdmin();
    const id = String(formData.get("id"));
    const medio = String(formData.get("medio") || "").trim();
    if (!id) return { ok: false, error: "No se encontró el pago informado." };

    await confirmarPagoInformado(id, { medio: medio || undefined });

    revalidatePath("/admin/pagos-informados");
    revalidatePath("/admin/expensas");
    revalidatePath("/propietario");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[confirmarPagoInformadoAction] Error inesperado:", e);
    return { ok: false, error: detalleError(e) };
  }
}

// El admin rechaza un pago informado (ej: no aparece en la cuenta, el monto
// no coincide). No se toca el saldo del propietario ni se crea ningún Pago.
export async function rechazarPagoInformadoAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    await requireAdmin();
    const id = String(formData.get("id"));
    const notaAdmin = String(formData.get("notaAdmin") || "").trim();
    if (!id) return { ok: false, error: "No se encontró el pago informado." };

    await rechazarPagoInformado(id, notaAdmin || undefined);

    revalidatePath("/admin/pagos-informados");
    revalidatePath("/propietario");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[rechazarPagoInformadoAction] Error inesperado:", e);
    return { ok: false, error: detalleError(e) };
  }
}

// ---------- RECLAMOS ----------

const TIPOS_ADJUNTO_RECLAMO_PERMITIDOS = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
const TAMANIO_MAXIMO_ADJUNTO_RECLAMO = 8 * 1024 * 1024; // 8 MB
const MAX_ADJUNTOS_RECLAMO = 5;

export async function crearReclamoAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    const session = await requirePropietario();
    const titulo = String(formData.get("titulo"));
    const descripcion = String(formData.get("descripcion"));
    const categoriaRaw = String(formData.get("categoria") || "OTRO");
    if (!titulo.trim() || !descripcion.trim()) {
      return { ok: false, error: "Completá título y descripción." };
    }
    const categoria = Object.values(CategoriaReclamo).includes(categoriaRaw as CategoriaReclamo)
      ? (categoriaRaw as CategoriaReclamo)
      : CategoriaReclamo.OTRO;

    const archivos = formData
      .getAll("archivos")
      .filter((a): a is File => a instanceof File && a.size > 0);

    if (archivos.length > MAX_ADJUNTOS_RECLAMO) {
      return { ok: false, error: `Podés adjuntar hasta ${MAX_ADJUNTOS_RECLAMO} archivos.` };
    }
    for (const archivo of archivos) {
      if (!TIPOS_ADJUNTO_RECLAMO_PERMITIDOS.includes(archivo.type)) {
        return { ok: false, error: `${archivo.name}: solo se aceptan archivos PDF, JPG, PNG o WEBP.` };
      }
      if (archivo.size > TAMANIO_MAXIMO_ADJUNTO_RECLAMO) {
        return { ok: false, error: `${archivo.name}: el archivo no puede superar los 8 MB.` };
      }
    }

    const reclamo = await prisma.reclamo.create({
      data: {
        titulo,
        descripcion,
        categoria,
        unidadId: session.user.unidadId!,
        usuarioId: session.user.id,
      },
    });

    for (const archivo of archivos) {
      const buffer = Buffer.from(await archivo.arrayBuffer());
      await prisma.adjuntoReclamo.create({
        data: {
          reclamoId: reclamo.id,
          nombreArchivo: archivo.name || "adjunto",
          tipoArchivo: archivo.type,
          tamanio: archivo.size,
          datos: buffer,
        },
      });
    }

    revalidatePath("/propietario/reclamos");
    revalidatePath("/admin/reclamos");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[crearReclamoAction] Error inesperado:", e);
    return { ok: false, error: "No se pudo enviar el reclamo por un error inesperado. Probá de nuevo en un minuto." };
  }
}

export async function responderReclamoAction(formData: FormData) {
  await requireAdmin();
  const reclamoId = String(formData.get("reclamoId"));
  const respuesta = String(formData.get("respuesta"));
  const cerrar = formData.get("cerrar") === "on";

  const reclamo = await prisma.reclamo.update({
    where: { id: reclamoId },
    data: {
      respuesta,
      respondidoAt: new Date(),
      estado: cerrar ? "CERRADO" : "RESPONDIDO",
    },
    include: { usuario: true },
  });
  revalidatePath("/admin/reclamos");
  revalidatePath("/propietario/reclamos");

  try {
    await enviarRespuestaReclamoPorEmail({
      to: reclamo.usuario.email,
      titulo: reclamo.titulo,
      respuesta,
      cerrado: cerrar,
    });
  } catch (e) {
    // No bloqueamos la respuesta del reclamo si falla el envío del email.
    console.error("[responderReclamoAction] No se pudo enviar el email de notificación:", e);
  }
}
// ---------- CUENTA ----------

export async function cambiarPasswordAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return { ok: false, error: "No autorizado" };

    const passwordActual = String(formData.get("passwordActual") || "");
    const passwordNueva = String(formData.get("passwordNueva") || "");
    const passwordNuevaRepetida = String(formData.get("passwordNuevaRepetida") || "");

    if (!passwordActual || !passwordNueva || !passwordNuevaRepetida) {
      return { ok: false, error: "Completá todos los campos." };
    }
    if (passwordNueva.length < 6) {
      return { ok: false, error: "La contraseña nueva tiene que tener al menos 6 caracteres." };
    }
    if (passwordNueva !== passwordNuevaRepetida) {
      return { ok: false, error: "Las contraseñas nuevas no coinciden." };
    }

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: session.user.id } });
    const valido = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!valido) {
      return { ok: false, error: "La contraseña actual no es correcta." };
    }

    const nuevoHash = await bcrypt.hash(passwordNueva, 10);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash: nuevoHash },
    });

    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[cambiarPasswordAction] Error inesperado:", e);
    return { ok: false, error: "No se pudo cambiar la contraseña por un error inesperado. Probá de nuevo en un minuto." };
  }
}
