import { prisma } from "@/lib/prisma";
import EditarPeriodoForm from "./EditarPeriodoForm";

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function EditarPeriodoPage({ params }: { params: { id: string } }) {
  const periodo = await prisma.periodoExpensa.findUniqueOrThrow({
    where: { id: params.id },
    include: { gastos: { orderBy: { orden: "asc" } } },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">Editar período: {periodo.etiqueta}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Corregí las categorías de gasto o los montos. El sistema vuelve a calcular el gasto común de las 79
          unidades, respetando la cochera, baulera, quincho, calefacción, saldo anterior y los pagos que ya se
          hubieran registrado.
        </p>
      </div>

      <EditarPeriodoForm
        periodoId={periodo.id}
        etiqueta={periodo.etiqueta}
        fechaInicio={toInputDate(periodo.fechaInicio)}
        fechaFin={toInputDate(periodo.fechaFin)}
        vencimiento={toInputDate(periodo.vencimiento)}
        categoriasIniciales={periodo.gastos.map((g) => ({
          nombre: g.nombre,
          monto: g.monto.toString(),
          fondo: g.esFondoReserva,
        }))}
      />
    </div>
  );
}