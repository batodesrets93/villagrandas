"use server";

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crearPeriodoYCalcular, registrarPago, actualizarCalefaccion, MONTO_QUINCHO } from "@/lib/calculo";

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
        monto:
          parseFloat((montos[i] || "0").replace(/\./g, "").replace(",", ".")) || parseFloat(montos[i] || "0") || 0,
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

export async function registrarPagoAction(formData: FormData) {
  await requireAdmin();
  const cargoId = String(formData.get("cargoId"));
  const monto = Number(formData.get("monto"));
  const medio = String(formData.get("medio") || "");
  const nota = String(formData.get("nota") || "");
  if (!cargoId || !monto || monto <= 0) throw new Error("Monto inválido");

  await registrarPago(cargoId, monto, medio, nota);
  revalidatePath("/admin/expensas");
  revalidatePath("/propietario");
}

export async function actualizarCalefaccionAction(formData: FormData) {
  await requireAdmin();
  const cargoId = String(formData.get("cargoId"));
  const calefaccion = Number(formData.get("calefaccion"));
  await actualizarCalefaccion(cargoId, isNaN(calefaccion) ? 0 : calefaccion);
  revalidatePath("/admin/expensas");
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