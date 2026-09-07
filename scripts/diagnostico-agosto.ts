import { prisma } from "../src/lib/prisma";

async function main() {
  const periodo = await prisma.periodoExpensa.findFirst({
    where: { etiqueta: { contains: "gosto", mode: "insensitive" } },
    orderBy: { fechaInicio: "desc" },
    include: { gastos: { orderBy: { orden: "asc" } } },
  });

  if (!periodo) {
    console.log("No encontre ningun periodo con 'agosto' en la etiqueta.");
    return;
  }

  console.log(`Periodo: ${periodo.etiqueta} (id ${periodo.id})`);
  console.log(`totalGastos guardado: $ ${periodo.totalGastos.toFixed(2)}`);
  console.log(`facturaGasTorreGrande: ${periodo.facturaGasTorreGrande}`);
  console.log(`facturaGasTorreChica: ${periodo.facturaGasTorreChica}`);
  console.log("\nCategorias (GastoCategoria):");
  for (const g of periodo.gastos) {
    console.log(
      `  [${g.orden}] ${g.nombre.padEnd(35)} $ ${g.monto.toFixed(2).padStart(15)}  fondo=${g.esFondoReserva}  excluyeDesarrollador=${g.excluyeDesarrollador}`
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

  const lecturas = await prisma.lecturaGas.findMany({
    where: { periodoId: periodo.id },
    select: { unidadId: true, lecturaActual: true, consumo: true },
  });
  const lecturaPorUnidad = new Map(lecturas.map((l) => [l.unidadId, l]));

  console.log(
    "\nCSV (copiar y pegar tal cual):"
  );
  console.log(
    "torre,piso,depto,titular,coef_pct,esDesarrollador,m2GasPonderado,gastoComun,cochera,baulera,calefaccion,consumo,lecturaActual,quincho,ajuste,total"
  );
  let sumCalefaccion = 0;
  let sumGastoComun = 0;
  let sumCochera = 0;
  let sumBaulera = 0;
  let sumTotal = 0;
  for (const c of cargos) {
    const u = c.unidad;
    const lec = lecturaPorUnidad.get(u.id);
    sumCalefaccion += c.calefaccion;
    sumGastoComun += c.gastoComun;
    sumCochera += c.cochera;
    sumBaulera += c.baulera;
    sumTotal += c.total;
    console.log(
      [
        u.torre,
        u.piso,
        u.depto,
        u.titular.replace(/,/g, " "),
        (u.coeficiente * 100).toFixed(5),
        u.esDesarrollador,
        u.m2GasPonderado ?? "",
        c.gastoComun.toFixed(2),
        c.cochera.toFixed(2),
        c.baulera.toFixed(2),
        c.calefaccion.toFixed(2),
        lec?.consumo?.toFixed(4) ?? "",
        lec?.lecturaActual?.toFixed(4) ?? "",
        c.quincho.toFixed(2),
        c.ajuste.toFixed(2),
        c.total.toFixed(2),
      ].join(",")
    );
  }

  console.log(`\nSuma calefaccion: $ ${sumCalefaccion.toFixed(2)}`);
  console.log(`Suma gastoComun: $ ${sumGastoComun.toFixed(2)}`);
  console.log(`Suma cochera: $ ${sumCochera.toFixed(2)}`);
  console.log(`Suma baulera: $ ${sumBaulera.toFixed(2)}`);
  console.log(`Suma total: $ ${sumTotal.toFixed(2)}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
