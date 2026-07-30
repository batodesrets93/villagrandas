import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generarPdfLiquidacion } from "@/lib/pdf";

export async function GET(_req: NextRequest, { params }: { params: { cargoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const cargo = await prisma.cargoUnidadPeriodo.findUnique({
    where: { id: params.cargoId },
    include: {
      unidad: true,
      periodo: { include: { gastos: { orderBy: { orden: "asc" } } } },
    },
  });
  if (!cargo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const esDueño = session.user.rol === "PROPIETARIO" && session.user.unidadId === cargo.unidadId;
  const esAdmin = session.user.rol === "ADMIN";
  if (!esDueño && !esAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const agregadoM2 = await prisma.unidad.aggregate({
    _sum: { m2: true, cocheraM2: true, bauleraM2: true },
  });
  const totalM2Edificio =
    (agregadoM2._sum.m2 ?? 0) + (agregadoM2._sum.cocheraM2 ?? 0) + (agregadoM2._sum.bauleraM2 ?? 0);

  const bytes = await generarPdfLiquidacion(
    {
      torre: cargo.unidad.torre,
      piso: cargo.unidad.piso,
      depto: cargo.unidad.depto,
      titular: cargo.unidad.titular,
      m2: cargo.unidad.m2,
      cocheraM2: cargo.unidad.cocheraM2,
      bauleraM2: cargo.unidad.bauleraM2,
    },
    {
      etiqueta: cargo.periodo.etiqueta,
      fechaInicio: cargo.periodo.fechaInicio,
      fechaFin: cargo.periodo.fechaFin,
      vencimiento: cargo.periodo.vencimiento,
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
    totalM2Edificio,
    cargo.periodo.gastos.map((g) => ({
      nombre: g.nombre,
      monto: g.monto,
      esFondoReserva: g.esFondoReserva,
    })),
    cargo.periodo.totalGastos
  );

  const nombreArchivo = `expensa_${cargo.unidad.piso}${cargo.unidad.depto}_${cargo.periodo.etiqueta.replace(/\s+/g, "_")}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
