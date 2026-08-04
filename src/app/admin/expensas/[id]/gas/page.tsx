import { prisma } from "@/lib/prisma";
import CalcularGasForm from "./CalcularGasForm";

export default async function GasPeriodoPage({ params }: { params: { id: string } }) {
  const periodo = await prisma.periodoExpensa.findUniqueOrThrow({
    where: { id: params.id },
  });

  const unidades = await prisma.unidad.findMany({
    where: { m2GasPonderado: { not: null } },
    select: { id: true, torre: true, piso: true, depto: true, titular: true, esEspacioComun: true },
    orderBy: [{ torre: "asc" }, { piso: "asc" }, { depto: "asc" }],
  });

  // Lectura anterior de cada unidad: la lecturaActual del período más
  // reciente con fechaInicio anterior a este (mismo mecanismo que usa
  // calcularGasPeriodo en calculo.ts para no duplicar la lógica acá).
  const lecturasPrevias = await prisma.lecturaGas.findMany({
    where: { periodo: { fechaInicio: { lt: periodo.fechaInicio } } },
    orderBy: { periodo: { fechaInicio: "desc" } },
    select: { unidadId: true, lecturaActual: true },
  });
  const lecturaAnteriorPorUnidad = new Map<string, number>();
  for (const l of lecturasPrevias) {
    if (!lecturaAnteriorPorUnidad.has(l.unidadId)) lecturaAnteriorPorUnidad.set(l.unidadId, l.lecturaActual);
  }

  // Si este período ya tiene lecturas cargadas (se está recalculando en vez
  // de calcular por primera vez), las usamos como valor inicial del input.
  const lecturasDeEstePeriodo = await prisma.lecturaGas.findMany({
    where: { periodoId: periodo.id },
    select: { unidadId: true, lecturaActual: true },
  });
  const lecturaActualPorUnidad = new Map(lecturasDeEstePeriodo.map((l) => [l.unidadId, l.lecturaActual]));

  const unidadesConLecturas = unidades.map((u) => ({
    id: u.id,
    torre: u.torre,
    piso: u.piso,
    depto: u.depto,
    titular: u.titular,
    esEspacioComun: u.esEspacioComun,
    lecturaAnterior: lecturaAnteriorPorUnidad.get(u.id) ?? 0,
    lecturaAnteriorTieneHistorial: lecturaAnteriorPorUnidad.has(u.id),
    lecturaActualPrevia: lecturaActualPorUnidad.get(u.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">Gas / calefacción — {periodo.etiqueta}</h1>
        <p className="text-sm text-gray-500">
          Cargá las dos facturas de gas del período y la lectura actual del medidor de cada unidad (podés hacerlo
          acá o exportar a Excel, completarlo y volver a importarlo). El sistema calcula el consumo (lectura actual
          − lectura anterior) y reparte cada factura 45% fijo / 55% variable por consumo, separando Torre Grande de
          Torre Chica. Si es la primera vez que se le toma lectura a una unidad, vas a poder cargar también su
          lectura anterior. La pileta entra al cálculo pero su costo se suma como gasto común, no se le factura a
          nadie directamente.
        </p>
      </div>

      <CalcularGasForm
        periodoId={periodo.id}
        facturaGasTorreGrandeInicial={periodo.facturaGasTorreGrande ?? undefined}
        facturaGasTorreChicaInicial={periodo.facturaGasTorreChica ?? undefined}
        unidades={unidadesConLecturas}
      />
    </div>
  );
}
