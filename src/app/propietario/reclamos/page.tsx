import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NuevoReclamoForm from "./NuevoReclamoForm";
import MarcarVistos from "./MarcarVistos";

const badge: Record<string, string> = {
  ABIERTO: "bg-red-100 text-red-700",
  RESPONDIDO: "bg-yellow-100 text-yellow-700",
  CERRADO: "bg-green-100 text-green-700",
};

const tipoLabel: Record<string, string> = {
  RECLAMO: "Reclamo",
  SUGERENCIA: "Sugerencia",
};

const tipoBadge: Record<string, string> = {
  RECLAMO: "bg-orange-100 text-orange-700",
  SUGERENCIA: "bg-blue-100 text-blue-700",
};

const categoriaLabel: Record<string, string> = {
  RUIDO: "Ruido",
  MANTENIMIENTO: "Mantenimiento",
  SEGURIDAD: "Seguridad",
  CONVIVENCIA: "Convivencia",
  ASCENSOR: "Ascensor",
  PLOMERIA: "Plomería",
  ELECTRICIDAD: "Electricidad",
  LIMPIEZA: "Limpieza",
  OTRO: "Otro",
};

export default async function ReclamosPropietarioPage() {
  const session = await getServerSession(authOptions);
  const reclamos = await prisma.reclamo.findMany({
    where: { unidadId: session!.user.unidadId! },
    orderBy: { createdAt: "desc" },
    include: { adjuntos: { select: { id: true, nombreArchivo: true, tipoArchivo: true, esRespuesta: true }, orderBy: { createdAt: "asc" } } },
  });

  const esNueva = (r: (typeof reclamos)[number]) =>
    !!r.respondidoAt && (!r.respuestaVistaAt || r.respuestaVistaAt < r.respondidoAt);
  const cantNuevas = reclamos.filter(esNueva).length;

  return (
    <div className="space-y-6">
      <MarcarVistos />
      <h1 className="text-2xl font-bold text-brand-700">Reclamos/Sugerencias</h1>

      {cantNuevas > 0 && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">
          🔔 {cantNuevas === 1 ? "Tenés 1 respuesta nueva de administración." : `Tenés ${cantNuevas} respuestas nuevas de administración.`}
        </div>
      )}

      <NuevoReclamoForm />

      <div className="space-y-4">
        {reclamos.map((r) => (
          <div key={r.id} className={`card ${esNueva(r) ? "ring-2 ring-green-400" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <span>
                <span className={`text-xs px-2 py-0.5 rounded-full mr-1 ${tipoBadge[r.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                  {tipoLabel[r.tipo] ?? r.tipo}
                </span>
                <span className="font-semibold">{r.titulo}</span>{" "}
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {categoriaLabel[r.categoria] ?? r.categoria}
                </span>
              </span>
              <span className="flex items-center gap-1">
                {esNueva(r) && <span className="text-xs px-2 py-1 rounded-full bg-green-600 text-white">Respuesta nueva</span>}
                <span className={`text-xs px-2 py-1 rounded-full ${badge[r.estado]}`}>{r.estado}</span>
              </span>
            </div>
            <p className="text-sm text-gray-700 mb-2">{r.descripcion}</p>
            {r.adjuntos.filter((a) => !a.esRespuesta).length > 0 && (
              <ul className="flex flex-wrap gap-2 mb-2">
                {r.adjuntos.filter((a) => !a.esRespuesta).map((a) => (
                  <li key={a.id}>
                    <a
                      href={`/api/reclamos-adjuntos/${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-600 underline"
                      title={a.nombreArchivo}
                    >
                      📎 {a.nombreArchivo}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {r.respuesta && (
              <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-sm">
                <span className="font-medium">Respuesta de administración: </span>
                {r.respuesta}
                {r.adjuntos.some((a) => a.esRespuesta) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {r.adjuntos.filter((a) => a.esRespuesta).map((a) => (
                      <a key={a.id} href={`/api/reclamos-adjuntos/${a.id}`} target="_blank" rel="noopener noreferrer" title={a.nombreArchivo}>
                        {a.tipoArchivo === "application/pdf" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-brand-600 underline">📄 {a.nombreArchivo}</span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/reclamos-adjuntos/${a.id}`} alt={a.nombreArchivo} className="h-24 w-24 object-cover rounded border" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {reclamos.length === 0 && <p className="text-gray-400">No hiciste ningún reclamo todavía.</p>}
      </div>
    </div>
  );
}
