import Link from "next/link";
import { prisma } from "@/lib/prisma";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function DetalleUnidadPage({ params }: { params: { id: string } }) {
  const unidad = await prisma.unidad.findUniqueOrThrow({
    where: { id: params.id },
    include: { usuarios: true },
  });

  const pagos = await prisma.pago.findMany({
    where: { cargo: { unidadId: unidad.id } },
    include: { cargo: { include: { periodo: true } } },
    orderBy: { fecha: "desc" },
  });

  const totalPagado = pagos.reduce((acc, p) => acc + p.monto, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/unidades" className="text-sm text-brand-600 underline">
          ← Volver a unidades
        </Link>
        <h1 className="text-2xl font-bold text-brand-700 mt-1">
          {unidad.torre === "GRANDE" ? "Torre Grande" : "Torre Chica"} · Piso {unidad.piso} - Depto {unidad.depto}
        </h1>
        <p className="text-sm text-gray-500">{unidad.titular}</p>
      </div>

      <div className="card">
        <p className="text-sm text-gray-500">Total pagado (histórico)</p>
        <p className="text-3xl font-bold text-brand-700">{money(totalPagado)}</p>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Historial de pagos ({pagos.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Período</th>
              <th>Monto</th>
              <th>Medio</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id}>
                <td>{p.fecha.toLocaleDateString("es-AR")}</td>
                <td>{p.cargo.periodo.etiqueta}</td>
                <td className="font-medium">{money(p.monto)}</td>
                <td>{p.medio || "-"}</td>
                <td>{p.nota || "-"}</td>
              </tr>
            ))}
            {pagos.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-6">
                  Todavía no se registraron pagos para esta unidad.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
