import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Cualquier usuario logueado (admin o propietario) puede ver los
  // comprobantes: son gastos del edificio, no de una unidad en particular.
  const comprobante = await prisma.comprobante.findUnique({
    where: { id: params.id },
    include: { gasto: { select: { periodoId: true } } },
  });
  if (!comprobante) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Un propietario solo ve comprobantes de períodos que ya se le enviaron.
  if (session.user.rol !== "ADMIN") {
    const visible = await prisma.cargoUnidadPeriodo.findFirst({
      where: {
        periodoId: comprobante.gasto.periodoId,
        visiblePropietario: true,
        ...(session.user.unidadId ? { unidadId: session.user.unidadId } : {}),
      },
      select: { id: true },
    });
    if (!visible) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(comprobante.datos), {
    headers: {
      "Content-Type": comprobante.tipoArchivo,
      "Content-Disposition": `inline; filename="${comprobante.nombreArchivo}"`,
    },
  });
}
