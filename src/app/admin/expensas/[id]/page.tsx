import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { registrarPagoAction, actualizarCalefaccionAction } from "@/lib/actions";
import { agruparM2ComplementariosPorUnidad, calcularTotalM2Edificio } from "@/lib/calculo";
import EnviarEmailsButton from "@/components/EnviarEmailsButton";
import ComprobantesGasto from "@/components/ComprobantesGasto";
import ImportarPagosForm from "./ImportarPagosForm";
import EliminarPagoButton from "@/components/EliminarPagoButton";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function m2Texto(n: number) {
  // Redondeado para mostrar; el valor real se sigue usando en el cálculo.
  return n ? Math.round(n).toLocaleString("es-AR") + " m²" : "-";
}

function porcentajeTexto(n: number) {
  return (n * 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + " %";
}

export default async function DetallePeriodoPage({ params }: { params: { id: string } }) {
  const periodo = await prisma.periodoExpensa.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      gastos: { orderBy: { orden: "asc" }, include: { comprobantes: true } },
      cargos: { include: { unidad: true, pagos: true }, orderBy: [{ unidad: { torre: "asc" } }, { unidad: { piso: "asc" } }, { unidad: { depto: "asc" } }] },
    },
  });

  // m2 total REAL del edificio (deptos + TODAS las cocheras + TODAS las
  // bauleras, asignadas o no) para el % de incidencia total de cada unidad.
  const [m2ComplementariosPorUnidad, totalM2Edificio] = await Promise.all([
    agruparM2ComplementariosPorUnidad(),
    calcularTotalM2Edificio(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">{periodo.etiqueta}</h1>
          <p className="text-sm text-gray-500">
            {periodo.fechaInicio.toLocaleDateString("es-AR")} al {periodo.fechaFin.toLocaleDateString("es-AR")} · Vence{" "}
            {periodo.vencimiento.toLocaleDateString("es-AR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/expensas/${periodo.id}/gas`} className="btn btn-secondary text-sm">
            Calcular gas / calefacción
          </Link>
          <EnviarEmailsButton periodoId={periodo.id} etiqueta={periodo.etiqueta} />
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">Gastos del período</h2>
        <table>
          <tbody>
            {periodo.gastos.map((g) => (
              <tr key={g.id}>
                <td>
                  {g.nombre} {g.esFondoReserva && <span className="text-xs text-brand-600">(fondo de reserva)</span>}
                </td>
                <td className="text-right">{money(g.monto)}</td>
                <td>
                  <ComprobantesGasto
                    gastoId={g.id}
                    comprobantes={g.comprobantes.map((c) => ({
                      id: c.id,
                      nombreArchivo: c.nombreArchivo,
                      tipoArchivo: c.tipoArchivo,
                      tamanio: c.tamanio,
                    }))}
                  />
                </td>
              </tr>
            ))}
            <tr className="font-bold">
              <td>Total</td>
              <td className="text-right">{money(periodo.totalGastos)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <ImportarPagosForm
        cargos={periodo.cargos.map((c) => ({
          id: c.id,
          torre: c.unidad.torre,
          piso: c.unidad.piso,
          depto: c.unidad.depto,
          titular: c.unidad.titular,
          saldoActual: c.saldoActual,
        }))}
      />

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Liquidación por unidad ({periodo.cargos.length})</h2>
        <table>
          <thead>
            <tr>
              <th className="sticky-col">Unidad</th>
              <th>Titular</th>
              <th>Gasto común</th>
              <th>Coch./Baul.</th>
              <th title="m² de cochera y baulera asignados a la unidad">Coch./Baul. (m²)</th>
              <th title="(m² unidad + cochera + baulera) / m² total del edificio">% Incidencia total</th>
              <th>Quincho</th>
              <th>Calefacción</th>
              <th>Total</th>
              <th>Saldo ant.</th>
              <th>Pagado</th>
              <th>A pagar</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {periodo.cargos.map((c) => {
              const m2Complementarios = m2ComplementariosPorUnidad.get(c.unidadId);
              const cocheraM2 = m2Complementarios?.cocheraM2 ?? 0;
              const bauleraM2 = m2Complementarios?.bauleraM2 ?? 0;
              return (
              <tr key={c.id}>
                <td className="sticky-col">
                  {c.unidad.torre === "GRANDE" ? "TG" : "TC"} {c.unidad.piso}º{c.unidad.depto}
                </td>
                <td>{c.unidad.titular}</td>
                <td>{money(c.gastoComun)}</td>
                <td>{money(c.cochera + c.baulera)}</td>
                <td>
                  {cocheraM2 > 0 && m2Texto(cocheraM2)}
                  {cocheraM2 > 0 && bauleraM2 > 0 && " + "}
                  {bauleraM2 > 0 && m2Texto(bauleraM2)}
                  {cocheraM2 === 0 && bauleraM2 === 0 && "-"}
                </td>
                <td>
                  {totalM2Edificio > 0
                    ? porcentajeTexto((c.unidad.m2 + cocheraM2 + bauleraM2) / totalM2Edificio)
                    : "-"}
                </td>
                <td>{money(c.quincho)}</td>
                <td>
                  {money(c.calefaccion)}
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-gray-400">Ajuste manual</summary>
                    <form action={actualizarCalefaccionAction} className="flex gap-1 mt-1">
                      <input type="hidden" name="cargoId" value={c.id} />
                      <input
                        name="calefaccion"
                        defaultValue={c.calefaccion || ""}
                        placeholder="0"
                        className="w-20 text-xs"
                      />
                      <button className="btn btn-secondary text-xs px-2">OK</button>
                    </form>
                  </details>
                </td>
                <td className="font-medium">{money(c.total)}</td>
                <td>{money(c.saldoAnterior)}</td>
                <td>{money(c.totalPagado)}</td>
                <td className="font-bold text-brand-700">{money(c.saldoActual)}</td>
                <td className="space-y-1">
                  <a href={`/api/pdf/${c.id}`} className="text-brand-600 underline text-xs block">
                    Descargar PDF
                  </a>
                  <EnviarEmailsButton periodoId={periodo.id} etiqueta={periodo.etiqueta} cargoId={c.id} />
                  <details>
                    <summary className="cursor-pointer text-xs text-gray-500">Registrar pago</summary>
                    <form action={registrarPagoAction} className="mt-1 space-y-1 w-36">
                      <input type="hidden" name="cargoId" value={c.id} />
                      <input name="monto" placeholder="Monto" inputMode="decimal" required className="text-xs" />
                      <select name="medio" defaultValue="Transferencia" className="text-xs w-full">
                        <option value="Transferencia">Transferencia</option>
                        <option value="Depósito">Depósito</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Otro">Otro</option>
                      </select>
                      <button className="btn btn-primary w-full text-xs">Guardar</button>
                    </form>
                  </details>
                  {c.pagos.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-xs text-gray-500">Pagos ({c.pagos.length})</summary>
                      <ul className="mt-1 space-y-1 w-44 text-xs">
                        {c.pagos.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-1 border-b border-gray-100 pb-1">
                            <span>
                              {p.fecha.toLocaleDateString("es-AR")} · {money(p.monto)}
                              {p.medio && ` · ${p.medio}`}
                            </span>
                            <EliminarPagoButton pagoId={p.id} etiqueta={`de ${money(p.monto)} (${p.fecha.toLocaleDateString("es-AR")})`} />
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
