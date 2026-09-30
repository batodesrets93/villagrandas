import { prisma } from "@/lib/prisma";
import Link from "next/link";
import MorosidadChart from "@/components/MorosidadChart";

const MINIMO_DEUDOR = 1000;

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function AdminDashboard() {
  const periodosRecientes = await prisma.periodoExpensa.findMany({
    orderBy: { fechaInicio: "desc" },
    take: 6,
    include: { cargos: { include: { unidad: true } } },
  });

  const ultimoPeriodo = periodosRecientes[0] ?? null;

  // La deuda de las unidades del desarrollador (esDesarrollador = true, hoy
  // Costa Tranvial, incluida su cuenta consolidada de cocheras/bauleras) no
  // cuenta como morosidad del consorcio: se excluye del total, del grafico
  // de evolucion y del top de deudores.
  type Cargo = (typeof periodosRecientes)[number]["cargos"][number];
  const cargosPropietarios = (cargos: Cargo[]) => cargos.filter((c) => !c.unidad.esDesarrollador);

  // Deuda = solo saldos positivos. Los saldos a favor (negativos) NO se
  // compensan contra la deuda de otras unidades: se muestran aparte.
  const EPS = 0.01;
  const resumen = (cargos: Cargo[]) => {
    const propios = cargosPropietarios(cargos);
    const deudores = propios.filter((c) => c.saldoActual > EPS);
    const aFavor = propios.filter((c) => c.saldoActual < -EPS);
    return {
      deuda: deudores.reduce((acc, c) => acc + c.saldoActual, 0),
      unidadesConDeuda: propios.filter((c) => c.saldoActual >= MINIMO_DEUDOR).length,
      saldoAFavor: aFavor.reduce((acc, c) => acc - c.saldoActual, 0),
      unidadesAFavor: aFavor.length,
      unidades: propios.length,
      cobrado: propios.reduce((acc, c) => acc + c.totalPagado, 0),
    };
  };

  const actual = ultimoPeriodo ? resumen(ultimoPeriodo.cargos) : null;

  const historialMorosidad = periodosRecientes
    .slice()
    .reverse()
    .map((p) => {
      const r = resumen(p.cargos);
      return { etiqueta: p.etiqueta, deuda: r.deuda, cobrado: r.cobrado };
    });

  // Top deudores: solo saldos de al menos $1.000 (debajo son diferencias de
  // redondeo o centavos, no morosidad real).
  const topDeudores = ultimoPeriodo
    ? cargosPropietarios(ultimoPeriodo.cargos)
        .filter((c) => c.saldoActual >= MINIMO_DEUDOR)
        .sort((a, b) => b.saldoActual - a.saldoActual)
        .slice(0, 5)
    : [];

  const reclamosAbiertos = await prisma.reclamo.count({ where: { estado: { in: ["ABIERTO", "RESPONDIDO"] } } });
  const proximasReservas = await prisma.reserva.count({
    where: { estado: "CONFIRMADA", fecha: { gte: new Date() } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">Panel de administración</h1>
        <p className="text-sm text-gray-500 mt-1">
          {ultimoPeriodo ? (
            <>
              Último período liquidado: <span className="font-medium text-gray-700">{ultimoPeriodo.etiqueta}</span>
            </>
          ) : (
            "Sin liquidaciones aún"
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border-l-4 border-red-400">
          <p className="text-sm text-gray-500">Deuda al cierre{ultimoPeriodo ? ` de ${ultimoPeriodo.etiqueta}` : ""}</p>
          <p className="text-2xl font-bold text-red-700">{money(actual?.deuda ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">Suma de saldos pendientes (sin compensar saldos a favor)</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Unidades con deuda</p>
          <p className="text-2xl font-bold">
            {actual?.unidadesConDeuda ?? 0}
            <span className="text-base font-normal text-gray-400"> / {actual?.unidades ?? 0}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">Con saldo de {money(MINIMO_DEUDOR)} o más (sin Costa Tranvial)</p>
        </div>
        <div className="card border-l-4 border-brand-500">
          <p className="text-sm text-gray-500">Saldos a favor</p>
          <p className="text-2xl font-bold text-brand-700">{money(actual?.saldoAFavor ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {actual?.unidadesAFavor ?? 0} {actual?.unidadesAFavor === 1 ? "unidad pagó" : "unidades pagaron"} de más
          </p>
        </div>
        <Link href="/admin/reclamos" className="card hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500">Reclamos/Sugerencias pendientes</p>
          <p className="text-2xl font-bold">{reclamosAbiertos}</p>
          <p className="text-xs text-brand-600 mt-1">Ver reclamos →</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <p className="text-sm font-medium text-gray-700">Deuda y cobranza por período</p>
          <p className="text-xs text-gray-500 mb-3">
            Deuda: saldo pendiente al cierre de cada período. Cobrado: pagos registrados en ese período.
          </p>
          <MorosidadChart datos={historialMorosidad} />
        </div>

        <div className="card">
          <p className="text-sm font-medium text-gray-700">Principales deudores</p>
          <p className="text-xs text-gray-500 mb-3">
            {ultimoPeriodo?.etiqueta ?? "Último período"} · saldos desde {money(MINIMO_DEUDOR)}
          </p>
          {topDeudores.length === 0 ? (
            <p className="text-sm text-gray-500">No hay unidades con deuda significativa en el último período.</p>
          ) : (
            <ul className="divide-y">
              {topDeudores.map((c, i) => (
                <li key={c.id} className="py-2 flex justify-between items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex-none w-6 h-6 rounded-full bg-red-50 text-red-700 text-xs font-semibold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-brand-700 truncate">
                        {c.unidad.torre === "GRANDE" ? "Grande" : "Chica"} {c.unidad.piso}º{c.unidad.depto}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{c.unidad.titular}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-red-700 whitespace-nowrap">{money(c.saldoActual)}</span>
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
