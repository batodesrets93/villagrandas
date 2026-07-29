import { prisma } from "@/lib/prisma";
import Link from "next/link";
import MorosidadChart from "@/components/MorosidadChart";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function AdminDashboard() {
  const totalUnidades = await prisma.unidad.count();

  const periodosRecientes = await prisma.periodoExpensa.findMany({
    orderBy: { fechaInicio: "desc" },
    take: 6,
    include: { cargos: { include: { unidad: true } } },
  });

  const ultimoPeriodo = periodosRecientes[0] ?? null;

  const deudaTotal = ultimoPeriodo
    ? ultimoPeriodo.cargos.reduce((acc, c) => acc + c.saldoActual, 0)
    : 0;

  const historialMorosidad = periodosRecientes
    .slice()
    .reverse()
    .map((p) => ({
      etiqueta: p.etiqueta,
      deuda: p.cargos.reduce((acc, c) => acc + c.saldoActual, 0),
    }));

  const topDeudores = ultimoPeriodo
    ? [...ultimoPeriodo.cargos]
        .filter((c) => c.saldoActual > 0)
        .sort((a, b) => b.saldoActual - a.saldoActual)
        .slice(0, 5)
    : [];

  const reclamosAbiertos = await prisma.reclamo.count({ where: { estado: { in: ["ABIERTO", "RESPONDIDO"] } } });
  const proximasReservas = await prisma.reserva.count({
    where: { estado: "CONFIRMADA", fecha: { gte: new Date() } },
  });

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <p className="text-sm text-gray-500 mb-3">Evolución de la deuda total por período</p>
          <MorosidadChart datos={historialMorosidad} />
        </div>

        <div className="card">
          <p className="text-sm text-gray-500 mb-3">Top 5 deudores (último período)</p>
          {topDeudores.length === 0 ? (
            <p className="text-sm text-gray-500">No hay deudas pendientes en el último período.</p>
          ) : (
            <ul className="divide-y">
              {topDeudores.map((c) => (
                <li key={c.id} className="py-2 flex justify-between items-baseline gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-700 truncate">
                      {c.unidad.torre === "GRANDE" ? "Grande" : "Chica"} {c.unidad.piso}º{c.unidad.depto}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{c.unidad.titular}</p>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">{money(c.saldoActual)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/unidades" className="text-sm text-brand-600 underline mt-3 inline-block">
            Ver todas las unidades
          </Link>
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
