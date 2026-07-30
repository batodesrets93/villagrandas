import { prisma } from "@/lib/prisma";
import CocherasBaulerasTables from "./CocherasBaulerasTables";

function unidadLabel(u: { torre: "GRANDE" | "CHICA"; piso: string; depto: string; titular: string }) {
  return `${u.torre === "GRANDE" ? "TG" : "TC"} ${u.piso}º${u.depto} — ${u.titular}`;
}

export default async function CocherasBaulerasPage() {
  const [cocheras, bauleras, unidades] = await Promise.all([
    prisma.cochera.findMany({
      orderBy: [{ planta: "asc" }, { numero: "asc" }],
      include: { unidad: true },
    }),
    prisma.baulera.findMany({
      orderBy: [{ planta: "asc" }, { numero: "asc" }],
      include: { unidad: true },
    }),
    // La cuenta consolidada no es una opción para "asignar": para
    // desasignar un espacio se elige "Sin asignar" en el select, que ya
    // la deja cayendo ahí automáticamente.
    prisma.unidad.findMany({
      where: { esConsolidadaCocheraBaulera: false },
      orderBy: [{ torre: "asc" }, { piso: "asc" }, { depto: "asc" }],
    }),
  ]);

  const unidadesOpciones = unidades.map((u) => ({ id: u.id, label: unidadLabel(u) }));

  const cocherasRows = cocheras.map((c) => ({
    id: c.id,
    planta: c.planta,
    numero: c.numero,
    m2: c.m2,
    caracteristica: c.caracteristica,
    unidadId: c.unidadId,
    unidadLabel: c.unidad ? unidadLabel(c.unidad) : null,
  }));

  const baulerasRows = bauleras.map((b) => ({
    id: b.id,
    planta: b.planta,
    numero: b.numero,
    m2: b.m2,
    unidadId: b.unidadId,
    unidadLabel: b.unidad ? unidadLabel(b.unidad) : null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Cocheras y bauleras</h1>
      <p className="text-sm text-gray-600">
        Cada cochera y cada baulera se liquida individualmente por su propio m² (igual que en el excel), y esa parte
        del gasto se le suma al total de la unidad que la tenga asignada. Las que todavía no tienen propietario
        asignado se le cobran a la cuenta consolidada de Costa Tranvial, para que esa parte del gasto común nunca
        quede sin cobrarse a nadie. Reasignar un espacio acá solo afecta los períodos que se generen de ahora en
        adelante — no recalcula liquidaciones ya cerradas de meses anteriores.
      </p>
      <CocherasBaulerasTables cocheras={cocherasRows} bauleras={baulerasRows} unidades={unidadesOpciones} />
    </div>
  );
}
