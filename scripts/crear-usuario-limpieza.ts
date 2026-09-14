// Crea (o actualiza la contraseña de) el usuario del rol LIMPIEZA.
// Correr una vez con: npx tsx scripts/crear-usuario-limpieza.ts
//
// Podes sobreescribir el email/contraseña con las env vars
// LIMPIEZA_EMAIL / LIMPIEZA_PASSWORD antes de correrlo.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.LIMPIEZA_EMAIL || "limpieza@villagrandas.com";
  const password = process.env.LIMPIEZA_PASSWORD || "123456";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.usuario.upsert({
    where: { email },
    update: { passwordHash, rol: "LIMPIEZA", activo: true },
    create: {
      email,
      passwordHash,
      nombre: "Limpieza",
      rol: "LIMPIEZA",
    },
  });

  console.log(`Usuario limpieza listo: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
