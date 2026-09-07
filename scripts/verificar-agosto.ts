/**
 * Script de verificación puntual: compara, para el período de Agosto 2026,
 * el gasto común calculado por la app contra lo que dice el PDF del
 * administrador externo, ahora que "Honorarios administración" está
 * marcada como excluyeDesarrollador = true.
 *
 * Uso: npx tsx scripts/verificar-agosto.ts
 *
 * No modifica nada: solo lee y muestra una tabla para comparar a ojo
 * contra "Expensas periodo agosto 2026.pdf".
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const periodo = await prisma.periodoExpensa.findFirst({
    where: { etiqueta: { contains: "gosto", mode: "insensitive" } },
    orderBy: { fechaInicio: "desc" },
    include: { gastos: { orderBy: { orden: "asc" } } },
  });

  if (!periodo) {
    console.log("No encontré ningún período con 'agosto' en la etiqueta.");
    return;
  }

  console.log(`Período: ${periodo.etiqueta} (id ${periodo.id})`);
  console.log(`Total gastos (categorías, sin calefacción): $ ${periodo.totalGastos.toFixed(2)}`);
  console.log("\nCategorías:");
  for (const g of periodo.gastos) {
    console.log(
      `  ${g.nombre.padEnd(30)} $ ${g.monto.toFixed(2).padStart(15)}  excluyeDesarrollador=${g.excluyeDesarrollador}`
    );
  }

  const honorarios = periodo.gastos.find((g) => g.nombre.toLowerCase().includes("honorarios"));
  if (!honorarios) {
    console.log("\n⚠️  No encontré una categoría 'Honorarios...' en este período.");
  } else if (!honorarios.excluyeDesarrollador) {
    console.log(
      "\n⚠️  La categoría de Honorarios NO está marcada como excluyeDesarrollador=true todavía. " +
        "Andá a Editar el período y tildá 'No aplica a Costa Tranvial' en Honorarios, guardá, y volvé a correr este script."
    );
  }

  const cargos = await prisma.cargoUnidadPeriodo.findMany({
    where: { periodoId: periodo.id },
    include: { unidad: true },
  });

  cargos.sort((a, b) => {
    if (a.unidad.torre !== b.unidad.torre) return a.unidad.torre.localeCompare(b.unidad.torre);
    if (a.unidad.piso !== b.unidad.piso) return a.unidad.piso.localeCompare(b.unidad.piso, undefined, { numeric: true });
    return a.unidad.depto.localeCompare(b.unidad.depto);
  });

  console.log(
    "\nTorre     Piso Depto Titular                    Coef%      Desarrollador  GastoComun"
  );
  let totalGastoComun = 0;
  let honorariosCobradoEfectivo = 0;
  for (const c of cargos) {
    const u = c.unidad;
    totalGastoComun += c.gastoComun;
    if (honorarios && !u.esDesarrollador) {
      honorariosCobradoEfectivo += honorarios.monto * u.coeficiente;
    }
    console.log(
      `${u.torre.padEnd(9)} ${u.piso.padEnd(4)} ${u.depto.padEnd(5)} ${u.titular.slice(0, 26).padEnd(26)} ` +
        `${(u.coeficiente * 100).toFixed(5).padStart(9)}%  ${String(u.esDesarrollador).padEnd(13)} ` +
        `$ ${c.gastoComun.toFixed(2).padStart(12)}`
    );
  }

  console.log(`\nSuma de gastoComun de las ${cargos.length} unidades: $ ${totalGastoComun.toFixed(2)}`);
  if (honorarios) {
    console.log(
      `Honorarios: nominal $ ${honorarios.monto.toFixed(2)} — efectivamente cobrado (sin Costa Tranvial) $ ${honorariosCobradoEfectivo.toFixed(2)} ` +
        `— diferencia (lo que Costa Tranvial no paga) $ ${(honorarios.monto - honorariosCobradoEfectivo).toFixed(2)}`
    );
  }

  console.log(
    "\nComparar renglón por renglón contra 'Expensas periodo agosto 2026.pdf' (columna TOTAL DEPTO). " +
      "Si coincide al centavo en Costa Tranvial y en propietarios nombrados, quedó igual al PDF."
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
