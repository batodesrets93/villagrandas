import { prisma } from "@/lib/prisma";
import RespuestaReclamoForm from "./RespuestaReclamoForm";
import { cerrarReclamoAction, reabrirReclamoAction } from "@/lib/actions";

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

type ReclamoAdmin = Awaited<ReturnType<typeof cargarReclamos>>[number];

function cargarReclamos() {
  return prisma.reclamo.findMany({
    orderBy: { createdAt: "desc" },
    include: { unidad: true, usuario: true, adjuntos: { select: { id: true, nombreArchivo: true, tipoArchivo: true, esRespuesta: true }, orderBy: { createdAt: "asc" } } },
  });
}

const fmtUnidad = (r: ReclamoAdmin) => `${r.unidad.torre === "GRANDE" ? "TG" : "TC"} ${r.unidad.piso}º${r.unidad.depto}`;

function Detalle({ r }: { r: ReclamoAdmin }) {
  return (
    <>
      <p className="text-sm text-gray-700 mb-3">{r.descripcion}</p>

      {r.adjuntos.filter((a) => !a.esRespuesta).length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-3">
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
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 mb-3 text-sm">
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
    </>
  );
}

function Encabezado({ r }: { r: ReclamoAdmin }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div>
        <span className={`text-xs px-2 py-0.5 rounded-full mr-1 ${tipoBadge[r.tipo] ?? "bg-gray-100 text-gray-600"}`}>
          {tipoLabel[r.tipo] ?? r.tipo}
        </span>
        <span className="font-semibold">{r.titulo}</span>{" "}
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {categoriaLabel[r.categoria] ?? r.categoria}
        </span>{" "}
        <span className="text-sm text-gray-500">
          · {fmtUnidad(r)} · {r.usuario.nombre}
        </span>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full ${badge[r.estado]}`}>{r.estado}</span>
    </div>
  );
}

function TarjetaAbierta({ r }: { r: ReclamoAdmin }) {
  return (
    <div className="card">
      <Encabezado r={r} />
      <Detalle r={r} />
      <RespuestaReclamoForm reclamoId={r.id} respuestaActual={r.respuesta ?? ""} />
      {r.estado === "RESPONDIDO" && (
        <form action={cerrarReclamoAction} className="mt-3 pt-3 border-t flex items-center justify-between gap-2">
          <input type="hidden" name="reclamoId" value={r.id} />
          <span className="text-xs text-gray-500">¿Ya está solucionado? Cerralo y pasa a la lista de cerrados.</span>
          <button className="btn text-xs border border-green-600 text-green-700 hover:bg-green-50">Cerrar reclamo</button>
        </form>
      )}
    </div>
  );
}

function Seccion({ titulo, color, items, vacio }: { titulo: string; color: string; items: ReclamoAdmin[]; vacio: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        {titulo}
        <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{items.length}</span>
      </h2>
      {items.map((r) => (
        <TarjetaAbierta key={r.id} r={r} />
      ))}
      {items.length === 0 && <p className="text-sm text-gray-400">{vacio}</p>}
    </section>
  );
}

export default async function ReclamosAdminPage() {
  const reclamos = await cargarReclamos();
  const abiertos = reclamos.filter((r) => r.estado === "ABIERTO");
  const respondidos = reclamos.filter((r) => r.estado === "RESPONDIDO");
  const cerrados = reclamos.filter((r) => r.estado === "CERRADO");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-700">Reclamos/Sugerencias</h1>

      <Seccion titulo="Abiertos" color={badge.ABIERTO} items={abiertos} vacio="No hay reclamos abiertos." />
      <Seccion titulo="Respondidos" color={badge.RESPONDIDO} items={respondidos} vacio="No hay reclamos respondidos pendientes de cierre." />

      <section>
        <details className="group">
          <summary className="cursor-pointer text-lg font-semibold flex items-center gap-2 select-none">
            Cerrados
            <span className={`text-xs px-2 py-0.5 rounded-full ${badge.CERRADO}`}>{cerrados.length}</span>
            <span className="text-xs font-normal text-gray-400 group-open:hidden">(tocar para desplegar)</span>
          </summary>
          <ul className="mt-3 divide-y border rounded-lg bg-white">
            {cerrados.map((r) => (
              <li key={r.id}>
                <details className="px-3 py-2">
                  <summary className="cursor-pointer text-sm text-gray-700 select-none">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full mr-1 ${tipoBadge[r.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                      {tipoLabel[r.tipo] ?? r.tipo}
                    </span>
                    {r.titulo}
                  </summary>
                  <div className="mt-2 pl-1">
                    <p className="text-xs text-gray-500 mb-2">
                      {fmtUnidad(r)} · {r.usuario.nombre} · {categoriaLabel[r.categoria] ?? r.categoria}
                    </p>
                    <Detalle r={r} />
                    <form action={reabrirReclamoAction}>
                      <input type="hidden" name="reclamoId" value={r.id} />
                      <button className="text-xs text-brand-600 underline">Reabrir</button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
            {cerrados.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No hay reclamos cerrados.</li>}
          </ul>
        </details>
      </section>

      {reclamos.length === 0 && <p className="text-gray-400">No hay reclamos todavía.</p>}
    </div>
  );
}
