import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { totalGastosPeriodo } from "@/lib/gastosPeriodo";
import EliminarPeriodoButton from "@/components/EliminarPeriodoButton";
import EnviarEmailsButton from "@/components/EnviarEmailsButton";
import BloquearPeriodoButton from "@/components/BloquearPeriodoButton";
import OcultarPeriodoButton from "@/components/OcultarPeriodoButton";
import AccionesPeriodoMenu from "@/components/AccionesPeriodoMenu";

function money(n: number) {
  // \u00A0: que el "$" no quede en una línea y el importe en la otra.
  return "$\u00A0" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
              <th className="text-right">Total gastos</th>
              <th className="text-right">Deuda pendiente</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
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
                  <td className="font-semibold whitespace-nowrap">{p.etiqueta}</td>
                  <td>{p.vencimiento.toLocaleDateString("es-AR")}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{money(totalGastosPeriodo(p.gastos, p))}</td>
                  <td className={`whitespace-nowrap text-right tabular-nums ${deuda > 0 ? "text-red-700" : "text-gray-500"}`}>
                    {money(deuda)}
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex flex-col items-start gap-1">
                      {p.cerrado ? (
                        <span className="pill bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200">
                          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                          </svg>
                          Bloqueado
                        </span>
                      ) : (
                        <span className="pill bg-green-50 text-green-800 ring-1 ring-inset ring-green-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
                          Abierto
                        </span>
                      )}
                      <span
                        className={`text-xs ${visibles < conAcceso.length ? "text-amber-700" : "text-gray-500"}`}
                      >
                        {visibles === 0
                          ? "Oculto · sin enviar"
                          : visibles >= conAcceso.length
                          ? "Visible a propietarios"
                          : `Visible a ${visibles} de ${conAcceso.length}`}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/expensas/${p.id}`} className="btn btn-outline btn-sm">
                        Ver detalle
                      </Link>
                      {!p.cerrado && (
                        <Link href={`/admin/expensas/${p.id}/editar`} className="btn btn-outline btn-sm">
                          Editar
                        </Link>
                      )}
                      <AccionesPeriodoMenu>
                        <EnviarEmailsButton periodoId={p.id} etiqueta={p.etiqueta} enMenu />
                        {!p.cerrado && visibles > 0 && (
                          <OcultarPeriodoButton periodoId={p.id} etiqueta={p.etiqueta} enMenu />
                        )}
                        <BloquearPeriodoButton periodoId={p.id} etiqueta={p.etiqueta} cerrado={p.cerrado} enMenu />
                        {!p.cerrado && (
                          <>
                            <div className="menu-sep" />
                            <EliminarPeriodoButton periodoId={p.id} etiqueta={p.etiqueta} enMenu />
                          </>
                        )}
                      </AccionesPeriodoMenu>
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
