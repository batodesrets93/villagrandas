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
  eliminarPago,
  confirmarPagoInformado,
  rechazarPagoInformado,
  actualizarCalefaccion,
  actualizarAjuste,
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
  enviarConfirmacionReservaPorEmail,
  enviarAvisoReservaPorEmail,
} from "@/lib/email";

function detalleError(e: unknown): string {
  if (e && typeof e === "object") {
    const code = "code" in e ? String((e as { code: unknown }).code) : undefined;
    const message = "message" in e ? String((e as { message: unknown }).message) : undefined;
    if (code && message) return code + ": " + message;
    if (message) return message;
  }
  return String(e);
}

function parseMonto(raw: string | undefined | null): number {
  if (!raw) return 0;
  let s = String(raw).trim().replace(/[^\d.,-]/g, "");
  if (s === "") return 0;

  const tieneComa = s.includes(",");
  const tienePunto = s.includes(".");

  if (tieneComa && tienePunto) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (tieneComa && !tienePunto) {
    s = s.replace(",", ".");
  } else if (tienePunto && !tieneComa) {
    const partes = s.split(".");
    const ultima = partes[partes.length - 1];
    if (partes.length === 2 && ultima.length <= 2) {
      // ya es decimal
    } else {
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

function emailsAvisoAdmin(): string[] {
  const raw = process.env.ADMIN_NOTIFY_EMAIL || "";
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

type ResultadoAccion<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function crearPeriodoAction(formData: FormData): Promise<ResultadoAccion<{ id: string }>> {
  try {
    await requireAdmin();

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
