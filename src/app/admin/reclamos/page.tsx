import { prisma } from "@/lib/prisma";
import { responderReclamoAction } from "@/lib/actions";

const badge: Record<string, string> = {
  ABIERTO: "bg-red-100 text-red-700",
  RESPONDIDO: "bg-yellow-100 text-yellow-700",
  CERRADO: "bg-green-100 text-green-700",
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

export default async function ReclamosAdminPage() {
  const reclamos = await prisma.reclamo.findMany({
    orderBy: { createdAt: "desc" },
    include: { unidad: true, usuario: true, adjuntos: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Reclamos</h1>

      <div className="space-y-4">
        {reclamos.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-semibold">{r.titulo}</span>{" "}
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {categoriaLabel[r.categoria] ?? r.categoria}
                </span>{" "}
                <span className="text-sm text-gray-500">
                  · {r.unidad.torre === "GRANDE" ? "TG" : "TC"} {r.unidad.piso}º{r.unidad.depto} · {r.usuario.nombre}
                </span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${badge[r.estado]}`}>{r.estado}</span>
            </div>
            <p className="text-sm text-gray-700 mb-3">{r.descripcion}</p>

            {r.adjuntos.length > 0 && (
              <ul className="flex flex-wrap gap-2 mb-3">
                {r.adjuntos.map((a) => (
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
              <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 mb-3 text-sm">
                <span className="font-medium">Respuesta de administración: </span>
                {r.respuesta}
              </div>
            )}

            {r.estado !== "CERRADO" && (
              <form action={responderReclamoAction} className="space-y-2">
                <input type="hidden" name="reclamoId" value={r.id} />
                <textarea name="respuesta" placeholder="Escribir respuesta..." rows={2} defaultValue={r.respuesta ?? ""} />
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-500 flex items-center gap-1">
                    <input type="checkbox" name="cerrar" /> Marcar como cerrado
                  </label>
                  <button className="btn btn-primary text-xs">Responder</button>
                </div>
              </form>
            )}
          </div>
        ))}
        {reclamos.length === 0 && <p className="text-gray-400">No hay reclamos todavía.</p>}
      </div>
    </div>
  );
}
