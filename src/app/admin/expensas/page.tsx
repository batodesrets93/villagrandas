import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { totalGastosPeriodo } from "@/lib/gastosPeriodo";
import EliminarPeriodoButton from "@/components/EliminarPeriodoButton";
import EnviarEmailsButton from "@/components/EnviarEmailsButton";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ExpensasPage() {
  const periodos = await prisma.periodoExpensa.findMany({
    orderBy: { fechaInicio: "desc" },
    include: {
      cargos: { include: { unidad: { select: { esDesarrollador: true } } } },
      gastos: { select: { nombre: true, monto: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">Liquidaciones de expensas</h1>
        <Link href="/admin/expensas/nueva" className="btn btn-primary">
          + Nuevo período
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Vencimiento</th>
              <th>Total gastos</th>
              <th>Deuda pendiente</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => {
              // Sin las unidades del desarrollador (Costa Tranvial): su saldo no es deuda del consorcio.
              // Solo saldos de $1.000 o más (mismo criterio que el panel): los saldos a favor no compensan.
              const deuda = p.cargos
                .filter((c) => !c.unidad.esDesarrollador && c.saldoActual >= 1000)
                .reduce((acc, c) => acc + c.saldoActual, 0);
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.etiqueta}</td>
                  <td>{p.vencimiento.toLocaleDateString("es-AR")}</td>
                  <td>{money(totalGastosPeriodo(p.gastos, p))}</td>
                  <td>{money(deuda)}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/expensas/${p.id}`} className="text-brand-600 underline text-sm">
                        Ver detalle
                      </Link>
                      <Link href={`/admin/expensas/${p.id}/editar`} className="text-brand-600 underline text-sm">
                        Editar
                      </Link>
                      <EnviarEmailsButton periodoId={p.id} etiqueta={p.etiqueta} />
                      <EliminarPeriodoButton periodoId={p.id} etiqueta={p.etiqueta} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {periodos.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-6">
                  Todavía no liquidaste ningún período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
