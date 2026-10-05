// Se corre UNA vez después de `npm run db:push`: marca como ya vistas las respuestas
// de reclamos que existían antes del aviso de "respuesta nueva", para que los
// propietarios no vean todo el historial como novedad.
// Uso: npx tsx scripts/backfill-respuestas-vistas.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const n = await prisma.$executeRaw`UPDATE "Reclamo" SET "respuestaVistaAt" = NOW() WHERE "respondidoAt" IS NOT NULL AND "respuestaVistaAt" IS NULL`;
  console.log("Respuestas marcadas como vistas:", n);
}

main().finally(() => prisma.$disconnect());
