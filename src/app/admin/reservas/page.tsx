import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, parse, parseISO, isValid } from "date-fns";
import CalendarioReservas, { ReservaCalendario } from "@/components/CalendarioReservas";
import NuevaReservaAdminForm from "./NuevaReservaAdminForm";

export default async function ReservasAdminPage({
  searchParams,
}: {
  searchParams: { mes?: string; dia?: string };
}) {
  const mes = searchParams.mes ? parse(searchParams.mes, "yyyy-MM", new Date()) : new Date();
  const mesValido = isValid(mes) ? mes : new Date();

  const diaSeleccionado =
    searchParams.dia && isValid(parseISO(searchParams.dia)) ? parseISO(searchParams.dia) : undefined;

  const [reservas, quinchos, unidades] = await Promise.all([
    prisma.reserva.findMany({
      where: {
        estado: "CONFIRMADA",
        fecha: { gte: startOfMonth(mesValido), lte: endOfMonth(mesValido) },
      },
      orderBy: { fecha: "asc" },
      include: { unidad: true, quincho: true },
    }),
    prisma.quincho.findMany({ orderBy: { nombre: "asc" } }),
    prisma.unidad.findMany({
      where: { esConsolidadaCocheraBaulera: false, esEspacioComun: false },
      orderBy: [{ torre: "asc" }, { piso: "asc" }, { depto: "asc" }],
    }),
  ]);

  const reservasCalendario: ReservaCalendario[] = reservas.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    turno: r.turno,
    quinchoNombre: r.quincho.nombre,
    unidadLabel: `${r.unidad.torre === "GRANDE" ? "TG" : "TC"} ${r.unidad.piso}º${r.unidad.depto}`,
    facturada: !!r.cargoId,
    puedeCancelar: !r.cargoId,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Reservas de quincho</h1>

      <NuevaReservaAdminForm
        quinchos={quinchos.map((q) => ({ id: q.id, nombre: q.nombre }))}
        unidades={unidades.map((u) => ({
          id: u.id,
          label: `${u.torre === "GRANDE" ? "TG" : "TC"} ${u.piso}º${u.depto} - ${u.titular}`,
        }))}
      />

      <CalendarioReservas
        mes={mesValido}
        reservas={reservasCalendario}
        diaSeleccionado={diaSeleccionado}
        basePath="/admin/reservas"
      />
    </div>
  );
}
