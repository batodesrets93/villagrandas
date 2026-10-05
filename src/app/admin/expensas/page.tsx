import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { totalGastosPeriodo } from "@/lib/gastosPeriodo";
import EliminarPeriodoButton from "@/components/EliminarPeriodoButton";
import EnviarEmailsButton from "@/components/EnviarEmailsButton";
import BloquearPeriodoButton from "@/components/BloquearPeriodoButton";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ExpensasPage() {
  const periodos = await prisma.periodoExpensa.findMany({
    orderBy: { fechaInicio: "desc" },
    include: {
      cargos: { include: { unidad: { select: { esDesarrollador: true, usuarios: { select: { id: true } } } } } },
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
              <th>Estado</th>
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
              // Visibilidad para propietarios: solo cuentan las unidades con
              // acceso a la web (las demás no pueden verlo de todas formas).
              const conAcceso = p.cargos.filter((c) => c.unidad.usuarios.length > 0);
              const visibles = conAcceso.filter((c) => c.visiblePropietario).length;
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.etiqueta}</td>
                  <td>{p.vencimiento.toLocaleDateString("es-AR")}</td>
                  <td>{money(totalGastosPeriodo(p.gastos, p))}</td>
                  <td>{money(deuda)}</td>
                  <td className="text-xs whitespace-nowrap">
                    {p.cerrado ? (
                      <span className="inline-block rounded bg-gray-200 px-1.5 py-0.5 font-semibold text-gray-700">
                        🔒 Bloqueado
                      </span>
                    ) : (
                      <span className="inline-block rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800">
                        Abierto
                      </span>
                    )}
                    <div className={`mt-1 ${visibles === 0 ? "text-amber-700" : "text-gray-500"}`}>
                      {visibles === 0
                        ? "No enviado: oculto a propietarios"
                        : visibles >= conAcceso.length
                        ? "Enviado: visible a propietarios"
                        : `Visible a ${visibles} de ${conAcceso.length} unidades`}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/expensas/${p.id}`} className="text-brand-600 underline text-sm">
                        Ver detalle
                      </Link>
                      {!p.cerrado && (
                        <Link href={`/admin/expensas/${p.id}/editar`} className="text-brand-600 underline text-sm">
                          Editar
                        </Link>
                      )}
                      <EnviarEmailsButton periodoId={p.id} etiqueta={p.etiqueta} />
                      <BloquearPeriodoButton periodoId={p.id} etiqueta={p.etiqueta} cerrado={p.cerrado} />
                      {!p.cerrado && <EliminarPeriodoButton periodoId={p.id} etiqueta={p.etiqueta} />}
                    </div>
                  </td>
                </tr>
              );
            })}
            {periodos.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-6">
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
