import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EliminarPeriodoButton from "@/components/EliminarPeriodoButton";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

export default async function ExpensasPage() {
  const periodos = await prisma.periodoExpensa.findMany({
    orderBy: { fechaInicio: "desc" },
    include: { cargos: true },
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
              const deuda = p.cargos.reduce((acc, c) => acc + c.saldoActual, 0);
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.etiqueta}</td>
                  <td>{p.vencimiento.toLocaleDateString("es-AR")}</td>
                  <td>{money(p.totalGastos)}</td>
                  <td>{money(deuda)}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/expensas/${p.id}`} className="text-brand-600 underline text-sm">
                        Ver detalle
                      </Link>
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
