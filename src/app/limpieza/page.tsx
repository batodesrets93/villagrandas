import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, parse, parseISO, isValid } from "date-fns";
import CalendarioReservas, { ReservaCalendario } from "@/components/CalendarioReservas";
import MarcarVistoLimpieza from "@/components/MarcarVistoLimpieza";

export default async function ReservasLimpiezaPage({
  searchParams,
}: {
  searchParams: { mes?: string; dia?: string };
}) {
  const mes = searchParams.mes ? parse(searchParams.mes, "yyyy-MM", new Date()) : new Date();
  const mesValido = isValid(mes) ? mes : new Date();

  const diaSeleccionado =
    searchParams.dia && isValid(parseISO(searchParams.dia)) ? parseISO(searchParams.dia) : undefined;

  const reservas = await prisma.reserva.findMany({
    where: {
      estado: "CONFIRMADA",
      fecha: { gte: startOfMonth(mesValido), lte: endOfMonth(mesValido) },
    },
    orderBy: { fecha: "asc" },
    include: { unidad: true, quincho: true },
  });

  const reservasCalendario: ReservaCalendario[] = reservas.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    turno: r.turno,
    quinchoNombre: r.quincho.nombre,
    unidadLabel: `${r.unidad.torre === "GRANDE" ? "TG" : "TC"} ${r.unidad.piso}º${r.unidad.depto}`,
    facturada: true,
    puedeCancelar: false,
  }));

  return (
    <div className="space-y-6">
      {/* Con solo abrir el calendario se da por vista la ultima tanda de
          reservas nuevas (limpia el badge de notificaciones del nav). */}
      <MarcarVistoLimpieza />

      <h1 className="text-2xl font-bold text-brand-700">Reservas de quincho</h1>

      <CalendarioReservas
        mes={mesValido}
        reservas={reservasCalendario}
        diaSeleccionado={diaSeleccionado}
        basePath="/limpieza"
      />
    </div>
  );
}
