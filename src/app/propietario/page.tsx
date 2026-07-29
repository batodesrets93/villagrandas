import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CambiarPasswordForm from "@/components/CambiarPasswordForm";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

export default async function PropietarioPage() {
  const session = await getServerSession(authOptions);
  const unidad = await prisma.unidad.findUniqueOrThrow({
    where: { id: session!.user.unidadId! },
  });

  const cargos = await prisma.cargoUnidadPeriodo.findMany({
    where: { unidadId: unidad.id },
    include: { periodo: true, pagos: { orderBy: { fecha: "desc" } } },
    orderBy: { periodo: { fechaInicio: "desc" } },
  });

  const deudaActual = cargos[0]?.saldoActual ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">
          {unidad.torre === "GRANDE" ? "Torre Grande" : "Torre Chica"} · Piso {unidad.piso} - Depto {unidad.depto}
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

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Historial de liquidaciones</h2>
        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Vencimiento</th>
              <th>Total período</th>
              <th>Pagado</th>
              <th>Saldo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cargos.map((c) => (
              <tr key={c.id}>
                <td>{c.periodo.etiqueta}</td>
                <td>{c.periodo.vencimiento.toLocaleDateString("es-AR")}</td>
                <td>{money(c.total)}</td>
                <td>
                  {money(c.totalPagado)}
                  {c.pagos.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-brand-600 underline">
                        {c.pagos.length === 1 ? "1 pago" : `${c.pagos.length} pagos`}
                      </summary>
                      <table className="mt-1">
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
                </td>
                <td className={c.saldoActual > 0 ? "text-red-600 font-medium" : ""}>{money(c.saldoActual)}</td>
                <td>
                  <a href={`/api/pdf/${c.id}`} className="text-brand-600 underline text-sm">
                    PDF
                  </a>
                </td>
              </tr>
            ))}
            {cargos.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-6">
                  Todavía no hay liquidaciones cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CambiarPasswordForm />
    </div>
  );
}
