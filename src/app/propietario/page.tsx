import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CambiarPasswordForm from "@/components/CambiarPasswordForm";
import DescargarPdfButton from "@/components/DescargarPdfButton";

function money(n: number) {
  return "$\u00A0" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function PropietarioPage() {
  const session = await getServerSession(authOptions);
  const unidad = await prisma.unidad.findUniqueOrThrow({
    where: { id: session!.user.unidadId! },
  });

  const cargos = await prisma.cargoUnidadPeriodo.findMany({
    where: { unidadId: unidad.id },
    include: {
      periodo: {
        include: {
          gastos: {
            orderBy: { orden: "asc" },
            include: {
              comprobantes: {
                orderBy: { createdAt: "desc" },
                select: { id: true, nombreArchivo: true },
              },
            },
          },
        },
      },
      pagos: { orderBy: { fecha: "desc" } },
    },
    orderBy: { periodo: { fechaInicio: "desc" } },
  });

  const deudaActual = cargos[0]?.saldoActual ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">
          {unidad.torre === "GRANDE" ? "Torre Grande" : "Torre Chica"}{"\u00A0\u00B7\u00A0"}Piso {unidad.piso} - Depto {unidad.depto}
        </h1>
        <p className="text-sm text-gray-500">{unidad.titular}</p>
      </div>

      <div className="card">
        <p className="text-sm text-gray-500">Saldo actual</p>
        <p className={`text-3xl font-bold ${deudaActual > 0 ? "text-red-600" : "text-brand-700"}`}>
          {money(deudaActual)}
        </p>
        {deudaActual <= 0 && <p className="text-sm text-brand-600 mt-1">Estás al día 🎉</p>}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Historial de liquidaciones</h2>

        {cargos.length === 0 && (
          <p className="text-center text-gray-400 py-6 text-sm">Todavía no hay liquidaciones cargadas.</p>
        )}

        <div className="space-y-3">
          {cargos.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800">{c.periodo.etiqueta}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Vence {c.periodo.vencimiento.toLocaleDateString("es-AR")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Saldo</p>
                  <p className={`font-bold ${c.saldoActual > 0 ? "text-red-600" : "text-brand-700"}`}>
                    {money(c.saldoActual)}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-2.5 pt-2.5 border-t border-gray-50 text-xs">
                <p>
                  <span className="text-gray-400">Total: </span>
                  <span className="text-gray-700">{money(c.total)}</span>
                </p>
                <p>
                  <span className="text-gray-400">Pagado: </span>
                  <span className="text-gray-700">{money(c.totalPagado)}</span>
                </p>
              </div>

              <div className="flex items-center gap-4 mt-2.5 text-xs">
                <DescargarPdfButton
                  cargoId={c.id}
                  nombreArchivo={`expensa_${unidad.piso}${unidad.depto}_${c.periodo.etiqueta.replace(/\s+/g, "_")}.pdf`}
                />

                {c.pagos.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-brand-600 underline">
                      {c.pagos.length === 1 ? "1 pago" : `${c.pagos.length} pagos`}
                    </summary>
                    <table className="mt-2">
                      <tbody>
                        {c.pagos.map((p) => (
                          <tr key={p.id}>
                            <td className="whitespace-nowrap">{p.fecha.toLocaleDateString("es-AR")}</td>
                            <td className="text-right">{money(p.monto)}</td>
                            <td className="text-gray-500">{p.medio || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}

                {c.periodo.gastos.some((g) => g.comprobantes.length > 0) && (
                  <details>
                    <summary className="cursor-pointer text-brand-600 underline">Comprobantes</summary>
                    <ul className="mt-2 space-y-1">
                      {c.periodo.gastos
                        .filter((g) => g.comprobantes.length > 0)
                        .map((g) => (
                          <li key={g.id}>
                            <span className="text-gray-500">{g.nombre}:</span>
                            <ul className="ml-2">
                              {g.comprobantes.map((comp) => (
                                <li key={comp.id}>
                                  
                                    href={`/api/comprobantes/${comp.id}`}
                                    download
                                    className="text-brand-600 underline"
                                  >
                                    {comp.nombreArchivo}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <CambiarPasswordForm />
    </div>
  );
}
