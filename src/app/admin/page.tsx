import { prisma } from "@/lib/prisma";
import Link from "next/link";

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
