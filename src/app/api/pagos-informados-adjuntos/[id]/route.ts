import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const comprobante = await prisma.comprobantePagoInformado.findUnique({
    where: { id: params.id },
    include: { pagoInformado: { include: { cargo: { select: { unidadId: true } } } } },
  });
  if (!comprobante) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // El admin puede ver cualquier comprobante; el propietario solo los de
  // pagos informados de su propia unidad.
  const esAdmin = session.user.rol === "ADMIN";
  const esDeSuUnidad = session.user.unidadId === comprobante.pagoInformado.cargo.unidadId;
  if (!esAdmin && !esDeSuUnidad) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return new NextResponse(Buffer.from(comprobante.datos), {
    headers: {
      "Content-Type": comprobante.tipoArchivo,
      "Content-Disposition": `inline; filename="${comprobante.nombreArchivo}"`,
    },
  });
}
