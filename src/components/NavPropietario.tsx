import Link from "next/link";
import SignOutButton from "./SignOutButton";
import { prisma } from "@/lib/prisma";

// Cantidad de reclamos/sugerencias de la unidad con una respuesta que todavía no vio.
export async function contarRespuestasNuevas(unidadId: string | null | undefined) {
  if (!unidadId) return 0;
  const filas = await prisma.reclamo.findMany({
    where: { unidadId, respondidoAt: { not: null } },
    select: { respondidoAt: true, respuestaVistaAt: true },
  });
  return filas.filter((r) => !r.respuestaVistaAt || r.respuestaVistaAt < r.respondidoAt!).length;
}

export default async function NavPropietario({ unidadId }: { unidadId?: string | null }) {
  const nuevas = await contarRespuestasNuevas(unidadId);
  const links = [
    { href: "/propietario", label: "Mi cuenta", badge: 0 },
    { href: "/propietario/reservas", label: "Reservar quincho", badge: 0 },
    { href: "/propietario/reclamos", label: "Reclamos/Sugerencias", badge: nuevas },
  ];
  return (
    <nav className="bg-brand-700 text-white">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="font-bold text-sm sm:text-base">Villa Grandas</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:underline inline-flex items-center gap-1">
              {l.label}
              {l.badge > 0 && (
                <span
                  className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center"
                  title={l.badge === 1 ? "1 respuesta nueva" : l.badge + " respuestas nuevas"}
                >
                  {l.badge}
                </span>
              )}
            </Link>
          ))}
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
