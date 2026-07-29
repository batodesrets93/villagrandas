"use server";

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crearPeriodoYCalcular, actualizarPeriodoYCalcular, registrarPago, actualizarCalefaccion, MONTO_QUINCHO } from "@/lib/calculo";
import { generarPdfLiquidacion } from "@/lib/pdf";
import { enviarLiquidacionPorEmail } from "@/lib/email";

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

    let enviados = 0;
    const sinEmail: string[] = [];

    for (const cargo of periodo.cargos) {
      const label = unidadLabel(cargo.unidad);
      const emails = Array.from(new Set(cargo.unidad.usuarios.map((u) => u.email).filter(Boolean)));

      if (emails.length === 0) {
        sinEmail.push(label);
        continue;
      }

      const pdfBytes = await generarPdfLiquidacion(
        {
          torre: cargo.unidad.torre,
          piso: cargo.unidad.piso,
          depto: cargo.unidad.depto,
          titular: cargo.unidad.titular,
          m2: cargo.unidad.m2,
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
        }
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

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.usuario.upsert({
    where: { email },
    update: { unidadId, nombre, passwordHash },
    create: { email, nombre, passwordHash, rol: "PROPIETARIO", unidadId },
  });

  revalidatePath("/admin/unidades");
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

// ---------- RECLAMOS ----------

export async function crearReclamoAction(formData: FormData): Promise<ResultadoAccion> {
  try {
    const session = await requirePropietario();
    const titulo = String(formData.get("titulo"));
    const descripcion = String(formData.get("descripcion"));
    if (!titulo.trim() || !descripcion.trim()) {
      return { ok: false, error: "Completá título y descripción." };
    }

    await prisma.reclamo.create({
      data: {
        titulo,
        descripcion,
        unidadId: session.user.unidadId!,
        usuarioId: session.user.id,
      },
    });
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

  await prisma.reclamo.update({
    where: { id: reclamoId },
    data: {
      respuesta,
      respondidoAt: new Date(),
      estado: cerrar ? "CERRADO" : "RESPONDIDO",
    },
  });
  revalidatePath("/admin/reclamos");
  revalidatePath("/propietario/reclamos");
}
