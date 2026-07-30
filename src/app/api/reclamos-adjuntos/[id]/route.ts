import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const adjunto = await prisma.adjuntoReclamo.findUnique({
    where: { id: params.id },
    include: { reclamo: { select: { unidadId: true } } },
  });
  if (!adjunto) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // El admin puede ver cualquier adjunto; el propietario solo los de reclamos
  // de su propia unidad.
  const esAdmin = session.user.rol === "ADMIN";
  const esDeSuUnidad = session.user.unidadId === adjunto.reclamo.unidadId;
  if (!esAdmin && !esDeSuUnidad) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return new NextResponse(Buffer.from(adjunto.datos), {
    headers: {
      "Content-Type": adjunto.tipoArchivo,
      "Content-Disposition": `inline; filename="${adjunto.nombreArchivo}"`,
    },
  });
}
