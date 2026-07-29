import { PrismaClient, Torre } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Datos reales tomados de "EXPENSAS TORRES VILLA GRANDAS - Junio 2026"
// coeficiente esta guardado como fraccion (0.0189484 = 1,89484%)
//
// cochera/baulera abajo son los MONTOS que le tocaron a cada unidad en la
// liquidacion de junio 2026 (no son m2, son el resultado ya calculado). En
// esa liquidacion, el excel calcula esos montos con la misma logica que el
// gasto comun: coeficiente_cochera = m2_cochera / m2TotalEdificio, monto =
// coeficiente_cochera * totalGastosDelPeriodo. Como m2TotalEdificio y el
// totalGastos de junio son conocidos, se puede despejar el m2 real de cada
// cochera/baulera a partir de ese monto: m2 = monto * (m2TotalEdificio /
// totalGastosJunio). Eso es lo que hace FACTOR_MONTO_A_M2 mas abajo, y es
// lo que permite cargar cocheraM2/bauleraM2 reales (no un monto fijo) para
// que la app calcule cochera/baulera dinamicamente en cada periodo, igual
// que hace con el gasto comun.
const M2_TOTAL_EDIFICIO_JUNIO = 7899.01 + 1476.22 + 314.53; // deptos + cocheras + baulera
const TOTAL_GASTOS_JUNIO_2026 = 36293697.34;
const FACTOR_MONTO_A_M2 = M2_TOTAL_EDIFICIO_JUNIO / TOTAL_GASTOS_JUNIO_2026;

type UnidadSeed = {
  torre: Torre;
  piso: string;
  depto: string;
  titular: string;
  ambientes: string;
  m2: number;
  coeficiente: number;
  cochera?: number;
  baulera?: number;
};

const TORRE_GRANDE: UnidadSeed[] = [
  { torre: "GRANDE", piso: "01", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 184, coeficiente: 0.0189484 },
  { torre: "GRANDE", piso: "01", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "01", depto: "C", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "01", depto: "D", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 184, coeficiente: 0.0189484 },
  { torre: "GRANDE", piso: "02", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "02", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "02", depto: "C", titular: "Tavolaro Pablo", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 47288.01, baulera: 13417.61 },
  { torre: "GRANDE", piso: "02", depto: "D", titular: "Hamer Kevin", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 47288.01, baulera: 22388.72 },
  { torre: "GRANDE", piso: "03", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "03", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "03", depto: "C", titular: "Tajan Carlos", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, baulera: 40181.51 },
  { torre: "GRANDE", piso: "03", depto: "D", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "04", depto: "A", titular: "Dunda Maria Cristina", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, baulera: 22569.28 },
  { torre: "GRANDE", piso: "04", depto: "B", titular: "Venturo Victoria", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 50243.51, baulera: 11822.0 },
  { torre: "GRANDE", piso: "04", depto: "C", titular: "Deluz Maria Alejandra", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 49440.33, baulera: 23407.75 },
  { torre: "GRANDE", piso: "04", depto: "D", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "05", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "05", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "05", depto: "C", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "05", depto: "D", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "06", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "06", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "06", depto: "C", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "06", depto: "D", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "07", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "07", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "07", depto: "C", titular: "Obregon Silvina", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 47288.01, baulera: 13199.09 },
  { torre: "GRANDE", piso: "07", depto: "D", titular: "Manfredini Raul", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 55563.41, baulera: 10779.52 },
  { torre: "GRANDE", piso: "08", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "08", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "08", depto: "C", titular: "Cannizzaro Nestor", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 91050.91, baulera: 14738.1 },
  { torre: "GRANDE", piso: "08", depto: "D", titular: "Gallego Marta", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 49440.33, baulera: 14028.32 },
  { torre: "GRANDE", piso: "09", depto: "A", titular: "Molina Julio", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 47288.01, baulera: 18055.42 },
  { torre: "GRANDE", piso: "09", depto: "B", titular: "Conde Julio", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 47288.01, baulera: 10399.06 },
  { torre: "GRANDE", piso: "09", depto: "C", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244 },
  { torre: "GRANDE", piso: "09", depto: "D", titular: "Spinelli Ana Maria", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 55563.41, baulera: 23072.15 },
  { torre: "GRANDE", piso: "10", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666 },
  { torre: "GRANDE", piso: "10", depto: "B", titular: "Crispin Rojas", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 91050.91, baulera: 14738.1 },
  { torre: "GRANDE", piso: "10", depto: "C", titular: "Sztrum Sergio", ambientes: "2 Ambientes", m2: 74, coeficiente: 0.0076244, cochera: 49440.33, baulera: 13799.85 },
  { torre: "GRANDE", piso: "10", depto: "D", titular: "Tout International", ambientes: "2 Ambientes", m2: 83, coeficiente: 0.0085666, cochera: 49440.33, baulera: 12809.54 },
  { torre: "GRANDE", piso: "11", depto: "A", titular: "Costa Tranvial", ambientes: "3 Ambientes", m2: 169, coeficiente: 0.0174582 },
  { torre: "GRANDE", piso: "11", depto: "B", titular: "Costa Tranvial", ambientes: "3 Ambientes", m2: 169, coeficiente: 0.0174582 },
  { torre: "GRANDE", piso: "12", depto: "A", titular: "Troyano Ana", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 91050.91, baulera: 18055.42 },
  { torre: "GRANDE", piso: "12", depto: "B", titular: "Lauro Carlos", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 47288.01, baulera: 23596.52 },
  { torre: "GRANDE", piso: "13", depto: "A", titular: "Palomba Alberto", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 91050.91, baulera: 14738.1 },
  { torre: "GRANDE", piso: "13", depto: "B", titular: "Abbraccio Miriam", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 95195.11, baulera: 15408.9 },
  { torre: "GRANDE", piso: "14", depto: "A", titular: "Diez Damian", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 75834.73, baulera: 12360.08 },
  { torre: "GRANDE", piso: "14", depto: "B", titular: "Ialonardi Hugo", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 118993.89, baulera: 16386.47 },
  { torre: "GRANDE", piso: "15", depto: "A", titular: "Carseller Ricardo", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 46350.31, baulera: 16377.11 },
  { torre: "GRANDE", piso: "15", depto: "B", titular: "Iriart Ignacio", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 40181.51, baulera: 16255.38 },
  { torre: "GRANDE", piso: "16", depto: "A", titular: "Pestaña Walter", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 160641.75, baulera: 13053.0 },
  { torre: "GRANDE", piso: "16", depto: "B", titular: "Pierpauli Luis", ambientes: "3 Ambientes", m2: 126, coeficiente: 0.0130495, cochera: 49440.33, baulera: 13817.07 },
  { torre: "GRANDE", piso: "17", depto: "A", titular: "Costa Tranvial", ambientes: "4 Ambientes", m2: 258, coeficiente: 0.0266357 },
  { torre: "GRANDE", piso: "18", depto: "A", titular: "Costa Tranvial", ambientes: "4 Ambientes", m2: 181, coeficiente: 0.0186739 },
  { torre: "GRANDE", piso: "19", depto: "A", titular: "Freindenberg Silvina", ambientes: "4 Ambientes", m2: 181, coeficiente: 0.0186739, cochera: 94576.02, baulera: 27024.38 },
  { torre: "GRANDE", piso: "20", depto: "A", titular: "Gomez Gonzalo", ambientes: "4 Ambientes", m2: 181, coeficiente: 0.0186739, cochera: 259522.41, baulera: 13436.91 },
  { torre: "GRANDE", piso: "21", depto: "A", titular: "Daniel Rigueiro", ambientes: "4 Ambientes", m2: 261, coeficiente: 0.0269298, cochera: 129238.85, baulera: 28728.9 },
];

const TORRE_CHICA: UnidadSeed[] = [
  { torre: "CHICA", piso: "01", depto: "A", titular: "Stagno Jorge", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 45844.67, baulera: 13053.0 },
  { torre: "CHICA", piso: "01", depto: "B", titular: "Monzon Juan Manuel", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 105844.67, baulera: 11461.17 },
  { torre: "CHICA", piso: "02", depto: "A", titular: "Kuhn Guillermo", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49440.33, baulera: 23407.75 },
  { torre: "CHICA", piso: "02", depto: "B", titular: "Schoijet Moises", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49131.33, baulera: 15935.14 },
  { torre: "CHICA", piso: "03", depto: "A", titular: "Rosana D. Andrea", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49440.33, baulera: 13817.07 },
  { torre: "CHICA", piso: "03", depto: "B", titular: "Di Iorio Jorge", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49440.33, baulera: 16255.38 },
  { torre: "CHICA", piso: "04", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544 },
  { torre: "CHICA", piso: "04", depto: "B", titular: "Altuna Eliana", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49440.33, baulera: 10562.25 },
  { torre: "CHICA", piso: "05", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544 },
  { torre: "CHICA", piso: "05", depto: "B", titular: "Sack Ana Maria", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49131.33, baulera: 14279.64 },
  { torre: "CHICA", piso: "06", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544 },
  { torre: "CHICA", piso: "06", depto: "B", titular: "Manuela Rigueiro", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 91050.91 },
  { torre: "CHICA", piso: "07", depto: "A", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544 },
  { torre: "CHICA", piso: "07", depto: "B", titular: "Costa Tranvial", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544 },
  { torre: "CHICA", piso: "08", depto: "A", titular: "Peyre Edgardo Jorge", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 49131.33, baulera: 15684.2 },
  { torre: "CHICA", piso: "08", depto: "B", titular: "Gutierrez Leoncio", ambientes: "2 Ambientes", m2: 85, coeficiente: 0.0087544, cochera: 66616.73, baulera: 11011.71 },
  { torre: "CHICA", piso: "09", depto: "A", titular: "Gonza Fernando", ambientes: "2 Ambientes", m2: 82, coeficiente: 0.0084623, cochera: 51500.34, baulera: 16476.36 },
  { torre: "CHICA", piso: "09", depto: "B", titular: "Riva Sandra", ambientes: "3 Ambientes", m2: 97, coeficiente: 0.0100444, cochera: 91050.91, baulera: 18055.42 },
  { torre: "CHICA", piso: "10", depto: "A", titular: "Aducci Adriana", ambientes: "2 Ambientes", m2: 82, coeficiente: 0.0084623, cochera: 109440.33, baulera: 12809.54 },
  { torre: "CHICA", piso: "10", depto: "B", titular: "Abdelhadi Leandro", ambientes: "3 Ambientes", m2: 97, coeficiente: 0.0100444, cochera: 49131.33, baulera: 15079.3 },
  { torre: "CHICA", piso: "11", depto: "A", titular: "Iriart Ignacio", ambientes: "2 Ambientes", m2: 82, coeficiente: 0.0084623, cochera: 47288.01, baulera: 22388.72 },
  { torre: "CHICA", piso: "11", depto: "B", titular: "Delfino Graciela", ambientes: "3 Ambientes", m2: 97, coeficiente: 0.0100444, cochera: 52530.35, baulera: 11461.17 },
];

async function main() {
  console.log("Creando quinchos...");
  await prisma.quincho.upsert({
    where: { nombre: "Amparo" },
    update: {},
    create: { nombre: "Amparo", capacidad: 12, permitePiscina: false },
  });
  await prisma.quincho.upsert({
    where: { nombre: "Eva" },
    update: {},
    create: { nombre: "Eva", capacidad: 24, permitePiscina: true },
  });
  await prisma.quincho.upsert({
    where: { nombre: "Amado" },
    update: {},
    create: { nombre: "Amado", capacidad: 18, permitePiscina: false },
  });

  console.log("Creando unidades (Torre Grande + Torre Chica)...");
  const todas = [...TORRE_GRANDE, ...TORRE_CHICA];
  for (const u of todas) {
    await prisma.unidad.upsert({
      where: { torre_piso_depto: { torre: u.torre, piso: u.piso, depto: u.depto } },
      update: {
        cocheraM2: (u.cochera ?? 0) * FACTOR_MONTO_A_M2,
        bauleraM2: (u.baulera ?? 0) * FACTOR_MONTO_A_M2,
      },
      create: {
        torre: u.torre,
        piso: u.piso,
        depto: u.depto,
        titular: u.titular,
        ambientes: u.ambientes,
        m2: u.m2,
        coeficiente: u.coeficiente,
        cocheraM2: (u.cochera ?? 0) * FACTOR_MONTO_A_M2,
        bauleraM2: (u.baulera ?? 0) * FACTOR_MONTO_A_M2,
      },
    });
  }
  console.log(`${todas.length} unidades creadas/actualizadas.`);

  const adminEmail = process.env.ADMIN_EMAIL || "admin@villagrandas.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "cambiar1234";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      nombre: "Administración Rigueiro",
      rol: "ADMIN",
    },
  });
  console.log(`Usuario admin: ${adminEmail} / ${adminPassword} (cambiar despues del primer login)`);

  console.log("Seed completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
