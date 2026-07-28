import { prisma } from "@/lib/prisma";
import { registrarPagoAction, actualizarCalefaccionAction } from "@/lib/actions";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

export default async function DetallePeriodoPage({ params }: { params: { id: string } }) {
  const periodo = await prisma.periodoExpensa.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      gastos: { orderBy: { orden: "asc" } },
      cargos: { include: { unidad: true, pagos: true }, orderBy: [{ unidad: { torre: "asc" } }, { unidad: { piso: "asc" } }, { unidad: { depto: "asc" } }] },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">{periodo.etiqueta}</h1>
        <p className="text-sm text-gray-500">
          {periodo.fechaInicio.toLocaleDateString("es-AR")} al {periodo.fechaFin.toLocaleDateString("es-AR")} · Vence{" "}
          {periodo.vencimiento.toLocaleDateString("es-AR")}
        </p>
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
              </tr>
            ))}
            <tr className="font-bold">
              <td>Total</td>
              <td className="text-right">{money(periodo.totalGastos)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Liquidación por unidad ({periodo.cargos.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Titular</th>
              <th>Gasto común</th>
              <th>Coch./Baul.</th>
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
            {periodo.cargos.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.unidad.torre === "GRANDE" ? "TG" : "TC"} {c.unidad.piso}º{c.unidad.depto}
                </td>
                <td>{c.unidad.titular}</td>
                <td>{money(c.gastoComun)}</td>
                <td>{money(c.cochera + c.baulera)}</td>
                <td>{money(c.quincho)}</td>
                <td>
                  <form action={actualizarCalefaccionAction} className="flex gap-1">
                    <input type="hidden" name="cargoId" value={c.id} />
                    <input
                      name="calefaccion"
                      defaultValue={c.calefaccion || ""}
                      placeholder="0"
                      className="w-20 text-xs"
                    />
                    <button className="btn btn-secondary text-xs px-2">OK</button>
                  </form>
                </td>
                <td className="font-medium">{money(c.total)}</td>
                <td>{money(c.saldoAnterior)}</td>
                <td>{money(c.totalPagado)}</td>
                <td className="font-bold text-brand-700">{money(c.saldoActual)}</td>
                <td className="space-y-1">
                  <a href={`/api/pdf/${c.id}`} className="text-brand-600 underline text-xs block">
                    Descargar PDF
                  </a>
                  <details>
                    <summary className="cursor-pointer text-xs text-gray-500">Registrar pago</summary>
                    <form action={registrarPagoAction} className="mt-1 space-y-1 w-36">
                      <input type="hidden" name="cargoId" value={c.id} />
                      <input name="monto" placeholder="Monto" inputMode="decimal" required className="text-xs" />
                      <input name="medio" placeholder="Medio (opcional)" className="text-xs" />
                      <button className="btn btn-primary w-full text-xs">Guardar</button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
