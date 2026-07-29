import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getEvolucionMorosidad, getTopDeudores } from "@/lib/dashboard";
import EvolucionMorosidadChart from "./EvolucionMorosidadChart";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function AdminDashboard() {
  const totalUnidades = await prisma.unidad.count();
  const ultimoPeriodo = await prisma.periodoExpensa.findFirst({
    orderBy: { fechaInicio: "desc" },
    include: { cargos: true },
  });

  const deudaTotal = ultimoPeriodo ? ultimoPeriodo.cargos.reduce((acc, c) => acc + c.saldoActual, 0) : 0;
  const reclamosAbiertos = await prisma.reclamo.count({ where: { estado: { in: ["ABIERTO", "RESPONDIDO"] } } });
  const proximasReservas = await prisma.reserva.count({
    where: { estado: "CONFIRMADA", fecha: { gte: new Date() } },
  });

  const evolucion = await getEvolucionMorosidad();
  const { deudores } = await getTopDeudores();
  const maxDeudor = deudores.length > 0 ? deudores[0].saldoActual : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Panel de administración</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Unidades totales</p>
          <p className="text-2xl font-bold">{totalUnidades}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Último período liquidado</p>
          <p className="text-lg font-semibold">{ultimoPeriodo?.etiqueta ?? "Sin liquidaciones aún"}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Deuda total (último período)</p>
          <p className="text-2xl font-bold text-brand-700">{money(deudaTotal)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Reclamos pendientes</p>
          <p className="text-2xl font-bold">{reclamosAbiertos}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="card">
          <h2 className="font-bold mb-1">Evolución de morosidad</h2>
          <p className="text-sm text-gray-500 mb-3">Deuda total al cierre de cada período liquidado</p>
          <EvolucionMorosidadChart datos={evolucion} />
        </div>

        <div className="card">
          <h2 className="font-bold mb-1">Top {deudores.length || 5} deudores</h2>
          <p className="text-sm text-gray-500 mb-3">
            Mayor saldo actual, último período liquidado. No incluye unidades del edificio.
          </p>
          {deudores.length === 0 ? (
            <p className="text-sm text-gray-500">No hay unidades con saldo pendiente en el último período. 🎉</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Unidad</th>
                  <th style={{ textAlign: "right" }}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {deudores.map((d, i) => (
                  <tr key={d.unidadId}>
                    <td>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 font-bold text-xs">
                        {i + 1}
                      </span>
                    </td>
                    <td>
                      <div className="font-semibold">{d.titular}</div>
                      <div className="text-xs text-gray-500">
                        {d.torre === "GRANDE" ? "Torre Grande" : "Torre Chica"} · {d.piso}
                        {d.depto}
                      </div>
                      <div className="w-full h-1 bg-gray-100 rounded mt-1 overflow-hidden">
                        <div
                          className="h-full bg-red-700 rounded"
                          style={{ width: `${maxDeudor > 0 ? (d.saldoActual / maxDeudor) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                    <td className="text-right font-bold text-red-700">{money(d.saldoActual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3">
            <Link href="/admin/unidades" className="text-brand-600 text-sm font-semibold hover:underline">
              Ver todas las unidades →
            </Link>
          </p>
        </div>
      </div>

      <div className="card">
        <p className="text-sm text-gray-500 mb-3">Próximas reservas de quincho confirmadas: {proximasReservas}</p>
        <div className="flex gap-3">
          <Link href="/admin/expensas/nueva" className="btn btn-primary">
            + Liquidar nuevo período
          </Link>
          <Link href="/admin/unidades" className="btn btn-secondary">
            Gestionar unidades
          </Link>
        </div>
      </div>
    </div>
  );
}
