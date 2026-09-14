import { prisma } from "../src/lib/prisma";

async function main() {
  const etiqueta = process.argv[2] || "gosto";
  const periodo = await prisma.periodoExpensa.findFirst({
    where: { etiqueta: { contains: etiqueta, mode: "insensitive" } },
    orderBy: { fechaInicio: "desc" },
  });
  if (!periodo) {
    console.error("No period found for", etiqueta);
    process.exit(1);
  }
  const cargos = await prisma.cargoUnidadPeriodo.findMany({
    where: { periodoId: periodo.id },
    include: { unidad: true },
  });
  const out = {
    periodo: { id: periodo.id, etiqueta: periodo.etiqueta, totalGastos: periodo.totalGastos },
    cargos: cargos.map((c) => ({
      torre: c.unidad.torre,
      piso: c.unidad.piso,
      depto: c.unidad.depto,
      titular: c.unidad.titular,
      gastoComun: c.gastoComun,
      cochera: c.cochera,
      baulera: c.baulera,
      quincho: c.quincho,
      calefaccion: c.calefaccion,
      ajuste: c.ajuste,
      ajusteConcepto: c.ajusteConcepto,
      total: c.total,
      saldoAnterior: c.saldoAnterior,
      totalPagado: c.totalPagado,
      saldoActual: c.saldoActual,
    })),
  };
  console.log(JSON.stringify(out));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
