import { prisma } from "@/lib/prisma";
import { confirmarPagoInformadoAction, rechazarPagoInformadoAction } from "@/lib/actions";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function unidadLabel(unidad: { torre: string; piso: string; depto: string; titular: string }) {
  return `${unidad.torre === "GRANDE" ? "TG" : "TC"} ${unidad.piso}º${unidad.depto} · ${unidad.titular}`;
}

const badgeEstado: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-700",
  CONFIRMADO: "bg-green-100 text-green-700",
  RECHAZADO: "bg-red-100 text-red-700",
};

// Envoltorios locales: confirmarPagoInformadoAction / rechazarPagoInformadoAction
// devuelven ResultadoAccion (para poder mostrar errores en otros contextos),
// pero el atributo `action` de un <form> nativo necesita una función que
// devuelva void. Estos wrappers son Server Actions propias (declaradas con
// "use server" acá adentro) que llaman a la acción real y descartan el
// resultado.
async function confirmarWrapper(formData: FormData) {
  "use server";
  await confirmarPagoInformadoAction(formData);
}

async function rechazarWrapper(formData: FormData) {
  "use server";
  await rechazarPagoInformadoAction(formData);
}

const includePago = {
  cargo: { include: { unidad: true, periodo: true } },
  comprobantes: true,
} as const;

function fetchPendientes() {
  return prisma.pagoInformado.findMany({
    where: { estado: "PENDIENTE" },
    orderBy: { createdAt: "asc" },
    include: includePago,
  });
}

type PagoInformadoConDetalle = Awaited<ReturnType<typeof fetchPendientes>>[number];

export default async function PagosInformadosPage() {
  const [pendientes, resueltos] = await Promise.all([
    fetchPendientes(),
    prisma.pagoInformado.findMany({
      where: { estado: { in: ["CONFIRMADO", "RECHAZADO"] } },
      orderBy: { resueltoAt: "desc" },
      take: 30,
      include: includePago,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Pagos informados</h1>

      <div className="card">
        <h2 className="font-semibold mb-3">Pendientes de confirmar ({pendientes.length})</h2>
        {pendientes.length === 0 && <p className="text-sm text-gray-400">No hay pagos informados pendientes.</p>}
        <div className="space-y-4">
          {pendientes.map((p: PagoInformadoConDetalle) => (
            <div key={p.id} className="border-t border-gray-100 pt-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium">{unidadLabel(p.cargo.unidad)}</p>
                  <p className="text-sm text-gray-500">
                    {p.cargo.periodo.etiqueta} · Informado el {p.createdAt.toLocaleDateString("es-AR")}
                  </p>
                  <p className="text-sm mt-1">
                    <span className="font-semibold text-brand-700">{money(p.monto)}</span> ·{" "}
                    {p.fecha.toLocaleDateString("es-AR")} · {p.medio ?? "Sin medio informado"}
                  </p>
                  {p.nota && <p className="text-sm text-gray-600 mt-1">Nota: {p.nota}</p>}
                  {p.comprobantes.length > 0 && (
                    <ul className="flex flex-wrap gap-2 mt-2">
                      {p.comprobantes.map((c: PagoInformadoConDetalle["comprobantes"][number]) => (
                        <li key={c.id}>
                          <a
                            href={`/api/pagos-informados-adjuntos/${c.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-600 underline"
                            title={c.nombreArchivo}
                          >
                            📎 {c.nombreArchivo}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-56">
                  <form action={confirmarWrapper} className="flex gap-1">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="medio" defaultValue={p.medio ?? "Transferencia"} className="text-xs flex-1">
                      <option value="Transferencia">Transferencia</option>
                      <option value="Depósito">Depósito</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Otro">Otro</option>
                    </select>
                    <button className="btn btn-primary text-xs px-2">Confirmar</button>
                  </form>
                  <details>
                    <summary className="cursor-pointer text-xs text-gray-500">Rechazar</summary>
                    <form action={rechazarWrapper} className="mt-1 flex gap-1">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="notaAdmin" placeholder="Motivo (opcional)" className="text-xs flex-1" />
                      <button className="btn btn-danger text-xs px-2">Rechazar</button>
                    </form>
                  </details>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Resueltos recientemente</h2>
        {resueltos.length === 0 && <p className="text-sm text-gray-400">Todavía no hay pagos resueltos.</p>}
        <div className="space-y-2">
          {resueltos.map((p: PagoInformadoConDetalle) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-sm border-t border-gray-100 pt-2 flex-wrap gap-1"
            >
              <span>
                {unidadLabel(p.cargo.unidad)} · {p.cargo.periodo.etiqueta} · {money(p.monto)}
                {p.notaAdmin && <span className="text-gray-400"> · {p.notaAdmin}</span>}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full ${badgeEstado[p.estado]}`}>{p.estado}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
