import { prisma } from "../src/lib/prisma";

/**
 * Asigna bauleras a su propietario real segun la columna "BAULERA" de la
 * hoja EXPENSAS del excel del administrador ("Expensas 82026.xlsx",
 * version con la columna Y ya completa). Esa columna trae el numero de
 * "planta" de la baulera fisica (ej: "01-05") por unidad -- a veces dos,
 * separadas por " y ".
 *
 * Reglas de seguridad (esto factura plata real, no se pisa nada a lo loco):
 *  - Si la baulera esta SIN asignar (unidadId null) -> se asigna.
 *  - Si ya esta asignada A LA MISMA unidad -> no se toca (ya estaba bien).
 *  - Si ya esta asignada A OTRA unidad, o el "planta" no existe, o hay mas
 *    de una baulera con ese mismo "planta" (ambiguo) -> NO se toca, se
 *    reporta como conflicto para revisar a mano.
 *
 * Solo cambia asignaciones de Baulera (unidadId). No recalcula ningun
 * periodo -- despues de correr esto hay que volver a correr
 * aplicar-lecturas-anteriores-agosto.ts (o el recalculo que corresponda)
 * para que el monto de baulera de cada unidad se actualice.
 */
const ASIGNACIONES: { torre: "GRANDE" | "CHICA"; piso: string; depto: string; titular: string; plantas: string[] }[] = [
  { torre: "GRANDE", piso: "02", depto: "C", titular: "Tavolaro Pablo", plantas: ["01-38"] },
  { torre: "GRANDE", piso: "02", depto: "D", titular: "Hamer Kevin", plantas: ["02-19"] },
  { torre: "GRANDE", piso: "04", depto: "A", titular: "Dunda Maria Cristina", plantas: ["02-11"] },
  { torre: "GRANDE", piso: "04", depto: "B", titular: "Venturo Victoria", plantas: ["01-25"] },
  { torre: "GRANDE", piso: "04", depto: "C", titular: "Deluz Maria Alejandra", plantas: ["01-19"] },
  { torre: "GRANDE", piso: "06", depto: "C", titular: "Gustavo Rusconi", plantas: ["01-26"] },
  { torre: "GRANDE", piso: "07", depto: "C", titular: "Obregon Silvina", plantas: ["01-34"] },
  { torre: "GRANDE", piso: "07", depto: "D", titular: "Manfredini Raul", plantas: ["02-28"] },
  { torre: "GRANDE", piso: "08", depto: "C", titular: "Cannizzaro Nestor", plantas: ["01-04"] },
  { torre: "GRANDE", piso: "08", depto: "D", titular: "Gallego Marta", plantas: ["01-36"] },
  { torre: "GRANDE", piso: "09", depto: "A", titular: "Molina Julio", plantas: ["01-09"] },
  { torre: "GRANDE", piso: "09", depto: "B", titular: "Conde Julio", plantas: ["01-32"] },
  { torre: "GRANDE", piso: "09", depto: "D", titular: "Spinelli Ana Maria", plantas: ["01-28"] },
  { torre: "GRANDE", piso: "10", depto: "B", titular: "Damian Rojas / Crispin Rojas", plantas: ["01-02"] },
  { torre: "GRANDE", piso: "10", depto: "C", titular: "Sztrum Sergio", plantas: ["01-35"] },
  { torre: "GRANDE", piso: "10", depto: "D", titular: "Tout International", plantas: ["01-18"] },
  { torre: "GRANDE", piso: "12", depto: "A", titular: "Troyano Ana", plantas: ["01-11"] },
  { torre: "GRANDE", piso: "12", depto: "B", titular: "Lauro Carlos", plantas: ["01-12"] },
  { torre: "GRANDE", piso: "13", depto: "A", titular: "Palomba Alberto", plantas: ["01-07"] },
  { torre: "GRANDE", piso: "13", depto: "B", titular: "Abbraccio Miriam", plantas: ["01-06"] },
  { torre: "GRANDE", piso: "14", depto: "A", titular: "Diez Damian", plantas: ["02-25"] },
  { torre: "GRANDE", piso: "14", depto: "B", titular: "Ialonardi Hugo", plantas: ["01-15"] },
  { torre: "GRANDE", piso: "15", depto: "A", titular: "Carseller Ricardo", plantas: ["01-13"] },
  { torre: "GRANDE", piso: "15", depto: "B", titular: "Iriart Ignacio", plantas: ["02-22"] },
  { torre: "GRANDE", piso: "16", depto: "A", titular: "Pestaña Walter", plantas: ["01-33"] },
  { torre: "GRANDE", piso: "16", depto: "B", titular: "Pierpauli Luis", plantas: ["01-21"] },
  { torre: "GRANDE", piso: "19", depto: "A", titular: "Freindenberg Silvina", plantas: ["02-01", "02-02"] },
  { torre: "GRANDE", piso: "20", depto: "A", titular: "Gomez Gonzalo", plantas: ["01-29"] },
  { torre: "GRANDE", piso: "21", depto: "A", titular: "Daniel Rigueiro", plantas: ["01-23", "01-37"] },
  { torre: "CHICA", piso: "01", depto: "A", titular: "Stagno Jorge", plantas: ["02-23"] },
  { torre: "CHICA", piso: "01", depto: "B", titular: "Monzon Juan Manuel", plantas: ["02-24"] },
  { torre: "CHICA", piso: "02", depto: "A", titular: "Kuhn Guillermo", plantas: ["01-20"] },
  { torre: "CHICA", piso: "02", depto: "B", titular: "Schoijet Moises", plantas: ["01-16"] },
  { torre: "CHICA", piso: "03", depto: "A", titular: "Rosana D. Andrea", plantas: ["02-20", "02-21"] },
  { torre: "CHICA", piso: "03", depto: "B", titular: "Di Iorio Jorge", plantas: ["01-22"] },
  { torre: "CHICA", piso: "04", depto: "B", titular: "Altuna Eliana", plantas: ["01-17"] },
  { torre: "CHICA", piso: "05", depto: "B", titular: "Sack Ana Maria", plantas: ["02-13"] },
  { torre: "CHICA", piso: "06", depto: "B", titular: "Manuela Rigueiro", plantas: ["01-05"] },
  { torre: "CHICA", piso: "08", depto: "A", titular: "Peyre Edgardo Jorge", plantas: ["02-14"] },
  { torre: "CHICA", piso: "08", depto: "B", titular: "Gutierrez Leoncio", plantas: ["02-31"] },
  { torre: "CHICA", piso: "09", depto: "B", titular: "Riva Sandra", plantas: ["01-10"] },
  { torre: "CHICA", piso: "09", depto: "A", titular: "Gonza Fernando", plantas: ["02-12"] },
  { torre: "CHICA", piso: "10", depto: "B", titular: "Abdelhadi Leandro", plantas: ["01-14"] },
  { torre: "CHICA", piso: "10", depto: "A", titular: "Aducci Adriana", plantas: ["02-17"] },
  { torre: "CHICA", piso: "11", depto: "B", titular: "Delfino Graciela", plantas: ["02-18"] },
  { torre: "CHICA", piso: "11", depto: "A", titular: "Iriart Ignacio", plantas: ["02-20"] },
];

async function main() {
  let asignadas = 0;
  let yaEstaban = 0;
  const conflictos: string[] = [];

  for (const a of ASIGNACIONES) {
    const unidad = await prisma.unidad.findUnique({
      where: { torre_piso_depto: { torre: a.torre, piso: a.piso, depto: a.depto } },
    });
    if (!unidad) {
      conflictos.push(`${a.torre} ${a.piso}${a.depto} (${a.titular}): no encontre la unidad en la base`);
      continue;
    }

    for (const planta of a.plantas) {
      const bauleras = await prisma.baulera.findMany({ where: { planta } });
      if (bauleras.length === 0) {
        conflictos.push(`${a.torre} ${a.piso}${a.depto} (${a.titular}): no existe ninguna baulera con planta="${planta}"`);
        continue;
      }
      if (bauleras.length > 1) {
        conflictos.push(
          `${a.torre} ${a.piso}${a.depto} (${a.titular}): hay ${bauleras.length} bauleras con planta="${planta}" (ambiguo, numeros: ${bauleras.map((b) => b.numero).join(", ")})`
        );
        continue;
      }
      const baulera = bauleras[0];
      if (baulera.unidadId === unidad.id) {
        yaEstaban++;
        continue;
      }
      if (baulera.unidadId !== null) {
        const otra = await prisma.unidad.findUnique({ where: { id: baulera.unidadId } });
        conflictos.push(
          `${a.torre} ${a.piso}${a.depto} (${a.titular}): la baulera planta="${planta}" numero="${baulera.numero}" ya esta asignada a otra unidad (${otra?.torre} ${otra?.piso}${otra?.depto} - ${otra?.titular}). NO se toco.`
        );
        continue;
      }
      await prisma.baulera.update({ where: { id: baulera.id }, data: { unidadId: unidad.id } });
      asignadas++;
      console.log(`Asignada: baulera ${planta}-${baulera.numero} -> ${a.torre} ${a.piso}${a.depto} (${a.titular})`);
    }
  }

  console.log(`\nAsignadas ahora: ${asignadas}`);
  console.log(`Ya estaban bien: ${yaEstaban}`);
  console.log(`Conflictos (no tocados, revisar a mano): ${conflictos.length}`);
  for (const c of conflictos) console.log("  - " + c);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
