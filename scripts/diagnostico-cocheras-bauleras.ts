import { prisma } from "../src/lib/prisma";

/**
 * Lista el estado real de asignacion de cocheras y bauleras: cuantas
 * estan asignadas a un propietario real vs. sin asignar (facturando a la
 * cuenta consolidada de Costa Tranvial), y el detalle completo por unidad.
 */
async function main() {
  const cocheras = await prisma.cochera.findMany({
    include: { unidad: { select: { torre: true, piso: true, depto: true, titular: true } } },
    orderBy: [{ planta: "asc" }, { numero: "asc" }],
  });
  const bauleras = await prisma.baulera.findMany({
    include: { unidad: { select: { torre: true, piso: true, depto: true, titular: true } } },
    orderBy: [{ planta: "asc" }, { numero: "asc" }],
  });

  const cocherasSinAsignar = cocheras.filter((c) => !c.unidadId);
  const baulerasSinAsignar = bauleras.filter((b) => !b.unidadId);

  console.log(`Cocheras: ${cocheras.length} total, ${cocheras.length - cocherasSinAsignar.length} asignadas, ${cocherasSinAsignar.length} SIN asignar`);
  console.log(`Bauleras: ${bauleras.length} total, ${bauleras.length - baulerasSinAsignar.length} asignadas, ${baulerasSinAsignar.length} SIN asignar`);

  console.log("\n--- Cocheras SIN asignar (planta-numero) ---");
  console.log(cocherasSinAsignar.map((c) => `${c.planta}-${c.numero}`).join(", ") || "(ninguna)");

  console.log("\n--- Bauleras SIN asignar (planta-numero) ---");
  console.log(baulerasSinAsignar.map((b) => `${b.planta}-${b.numero}`).join(", ") || "(ninguna)");

  console.log("\n--- Detalle por unidad (torre/piso/depto -> cocheras y bauleras asignadas) ---");
  const porUnidad = new Map<string, { titular: string; cocheras: string[]; bauleras: string[] }>();
  for (const c of cocheras) {
    if (!c.unidad) continue;
    const key = `${c.unidad.torre}-${c.unidad.piso}-${c.unidad.depto}`;
    if (!porUnidad.has(key)) porUnidad.set(key, { titular: c.unidad.titular, cocheras: [], bauleras: [] });
    porUnidad.get(key)!.cocheras.push(`${c.planta}-${c.numero} (${c.m2}m2)`);
  }
  for (const b of bauleras) {
    if (!b.unidad) continue;
    const key = `${b.unidad.torre}-${b.unidad.piso}-${b.unidad.depto}`;
    if (!porUnidad.has(key)) porUnidad.set(key, { titular: b.unidad.titular, cocheras: [], bauleras: [] });
    porUnidad.get(key)!.bauleras.push(`${b.planta}-${b.numero} (${b.m2}m2)`);
  }
  for (const [key, info] of porUnidad) {
    console.log(`${key} (${info.titular}): cocheras=[${info.cocheras.join(", ")}]  bauleras=[${info.bauleras.join(", ")}]`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
