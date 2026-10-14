import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelarReservaAction } from "@/lib/actions";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, parse, parseISO, isValid, format } from "date-fns";
import { es } from "date-fns/locale";
import CalendarioReservas, { ReservaCalendario } from "@/components/CalendarioReservas";
import { motivoNoReservable } from "@/lib/reservasReglas";
import NuevaReservaForm from "./NuevaReservaForm";
import UnidadActivaAviso from "@/components/UnidadActivaAviso";
import DisponibilidadDia, { QuinchoDia, SlotDia } from "./DisponibilidadDia";

const INFO_QUINCHO: Record<string, string> = {
  Amparo: "Capacidad 12 personas · sin acceso a piscina",
  Eva: "Capacidad 24 personas · sin acceso a piscina",
  Amado: "Capacidad 18 personas · sin acceso a piscina",
};

export default async function ReservasPropietarioPage({
  searchParams,
}: {
  searchParams: { mes?: string; dia?: string };
}) {
  const session = await getServerSession(authOptions);
  const quinchos = await prisma.quincho.findMany({ orderBy: { nombre: "asc" } });

  const mes = searchParams.mes ? parse(searchParams.mes, "yyyy-MM", new Date()) : new Date();
  const mesValido = isValid(mes) ? mes : new Date();

  const diaSeleccionado =
    searchParams.dia && isValid(parseISO(searchParams.dia)) ? parseISO(searchParams.dia) : undefined;

  // Se trae todo lo que muestra la grilla (incluye los días sueltos de los meses
  // vecinos), así al tocar uno de esos días no aparece "no hay reservas" por error.
  const ocupadas = await prisma.reserva.findMany({
    where: {
      estado: "CONFIRMADA",
      fecha: {
        gte: startOfWeek(startOfMonth(mesValido), { weekStartsOn: 0 }),
        lte: endOfWeek(endOfMonth(mesValido), { weekStartsOn: 0 }),
      },
    },
    include: { unidad: true, quincho: true },
    orderBy: { fecha: "asc" },
  });

  const misReservas = await prisma.reserva.findMany({
    where: { unidadId: session!.user.unidadId!, estado: "CONFIRMADA" },
    include: { quincho: true },
    orderBy: { fecha: "asc" },
  });

  // Corte: inicio del día de hoy en Argentina (las fechas de reserva se guardan a medianoche UTC)
  const hoyAR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const corteHoy = new Date(`${hoyAR}T00:00:00Z`);
  const proximasReservas = misReservas.filter((r) => r.fecha >= corteHoy);
  const reservasAnteriores = misReservas.filter((r) => r.fecha < corteHoy).reverse();

  const reservasCalendario: ReservaCalendario[] = ocupadas.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    turno: r.turno,
    quinchoNombre: r.quincho.nombre,
    unidadLabel: `${r.unidad.torre === "GRANDE" ? "TG" : "TC"} ${r.unidad.piso}º${r.unidad.depto}`,
    facturada: !!r.cargoId,
    puedeCancelar: r.unidadId === session!.user.unidadId && !r.cargoId,
  }));

  // Disponibilidad por quincho y turno del día elegido en el calendario.
  const diaISO = diaSeleccionado ? format(diaSeleccionado, "yyyy-MM-dd") : null;
  let quinchosDia: QuinchoDia[] = [];
  if (diaISO) {
    const slotDe = (quinchoId: string, turno: "MEDIODIA" | "NOCHE"): SlotDia => {
      const r = ocupadas.find(
        (o) => o.quinchoId === quinchoId && o.turno === turno && o.fecha.toISOString().slice(0, 10) === diaISO
      );
      if (r) {
        if (r.unidadId === session!.user.unidadId) return { tipo: "propia" };
        return { tipo: "ocupado", unidad: `${r.unidad.torre === "GRANDE" ? "TG" : "TC"} ${r.unidad.piso}º${r.unidad.depto}` };
      }
      const motivo = motivoNoReservable(diaISO, turno);
      return motivo ? { tipo: "no", motivo } : { tipo: "libre" };
    };
    quinchosDia = quinchos.map((q) => ({
      id: q.id,
      nombre: q.nombre,
      info: INFO_QUINCHO[q.nombre] ?? "",
      mediodia: slotDe(q.id, "MEDIODIA"),
      noche: slotDe(q.id, "NOCHE"),
    }));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Reservar quincho</h1>
      <UnidadActivaAviso />

      <div className="card">
        <p className="text-sm text-gray-700 mb-2">
          Costo por uso: <strong>$ 50.000</strong>, se suma automáticamente a tu próxima liquidación de expensas.
        </p>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
          <li>Reservar con mínimo 24 horas de anticipación.</li>
          <li>Turno mediodía: 9:00 a 15:30 (hasta 16:30 si no se usa el turno siguiente).</li>
          <li>Turno noche: 18:30 a 0:30 (2:00 am viernes, sábados y vísperas de feriado).</li>
          <li>No se pueden usar equipos de música ni parlantes (solo auriculares).</li>
          <li>Ningún quincho tiene acceso a la piscina.</li>
        </ul>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500">
          {quinchos.map((q) => (
            <div key={q.id} className="bg-gray-50 rounded-lg p-2">
              <strong>{q.nombre}</strong>: {INFO_QUINCHO[q.nombre]}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-1 text-brand-700">Elegí un día en el calendario</h2>
        <p className="text-sm text-gray-500 mb-3">
          Tocá un día para ver qué quincho y turno están libres, y reservar ahí mismo.
        </p>
        <CalendarioReservas
          mes={mesValido}
          reservas={reservasCalendario}
          diaSeleccionado={diaSeleccionado}
          basePath="/propietario/reservas"
        />
      </div>

      {diaISO && diaSeleccionado && (
        <DisponibilidadDia
          key={diaISO}
          diaISO={diaISO}
          diaTexto={format(diaSeleccionado, "EEEE d 'de' MMMM", { locale: es })}
          quinchos={quinchosDia}
        />
      )}

      <NuevaReservaForm quinchos={quinchos.map((q) => ({ id: q.id, nombre: q.nombre }))} />

      <div className="card">
        <h2 className="font-semibold mb-3">Mis próximas reservas</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Turno</th>
              <th>Quincho</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {proximasReservas.map((r) => (
              <tr key={r.id}>
                <td>{r.fecha.toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                <td>{r.turno === "MEDIODIA" ? "Mediodía" : "Noche"}</td>
                <td>{r.quincho.nombre}</td>
                <td>
                  {!r.cargoId && (
                    <form action={cancelarReservaAction}>
                      <input type="hidden" name="reservaId" value={r.id} />
                      <button className="btn btn-danger text-xs">Cancelar</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {proximasReservas.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 py-4">
                  No tenés próximas reservas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reservasAnteriores.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3 text-gray-600">Reservas anteriores</h2>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Turno</th>
                <th>Quincho</th>
              </tr>
            </thead>
            <tbody>
              {reservasAnteriores.map((r) => (
                <tr key={r.id} className="text-gray-500">
                  <td>{r.fecha.toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td>{r.turno === "MEDIODIA" ? "Mediodía" : "Noche"}</td>
                  <td>{r.quincho.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
