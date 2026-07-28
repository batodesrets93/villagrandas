import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NuevoReclamoForm from "./NuevoReclamoForm";

const badge: Record<string, string> = {
  ABIERTO: "bg-red-100 text-red-700",
  RESPONDIDO: "bg-yellow-100 text-yellow-700",
  CERRADO: "bg-green-100 text-green-700",
};

export default async function ReclamosPropietarioPage() {
  const session = await getServerSession(authOptions);
  const reclamos = await prisma.reclamo.findMany({
    where: { unidadId: session!.user.unidadId! },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Reclamos</h1>

      <NuevoReclamoForm />

      <div className="space-y-4">
        {reclamos.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">{r.titulo}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${badge[r.estado]}`}>{r.estado}</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">{r.descripcion}</p>
            {r.respuesta && (
              <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-sm">
                <span className="font-medium">Respuesta de administración: </span>
                {r.respuesta}
              </div>
            )}
          </div>
        ))}
        {reclamos.length === 0 && <p className="text-gray-400">No hiciste ningún reclamo todavía.</p>}
      </div>
    </div>
  );
}
