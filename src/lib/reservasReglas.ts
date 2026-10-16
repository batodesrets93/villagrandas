// Reglas de reserva de quincho para MOSTRAR en pantalla qué turnos se pueden
// reservar. La autoridad sigue siendo crearReservaAction (actions.ts), que
// vuelve a validar todo del lado del servidor: si se cambia una regla allá,
// hay que cambiarla también acá.

export type TurnoReserva = "MEDIODIA" | "NOCHE";

const HORA_INICIO_TURNO: Record<TurnoReserva, { hora: number; minuto: number }> = {
  MEDIODIA: { hora: 9, minuto: 0 },
  NOCHE: { hora: 18, minuto: 30 },
};
const OFFSET_ARGENTINA_HORAS = 3;

/**
 * Fechas que los propietarios NO pueden reservar por su cuenta: las asigna la
 * administración (formulario de reserva de admin) para repartirlas con
 * criterio de equidad entre los propietarios. Formato "YYYY-MM-DD".
 * Para otro año, actualizar esta lista.
 */
export const FECHAS_SOLO_ADMIN: readonly string[] = ["2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"];

export const MOTIVO_SOLO_ADMIN = "Reserva por administración";

export function esFechaSoloAdmin(diaISO: string): boolean {
  return FECHAS_SOLO_ADMIN.includes(diaISO);
}

/**
 * Devuelve el motivo por el que un turno NO se puede reservar, o null si se
 * puede. `diaISO` es "YYYY-MM-DD" (la fecha se guarda a medianoche UTC).
 */
export function motivoNoReservable(diaISO: string, turno: TurnoReserva, ahora: Date = new Date()): string | null {
  const fecha = new Date(diaISO);
  if (isNaN(fecha.getTime())) return "Fecha inválida";

  if (esFechaSoloAdmin(diaISO)) return MOTIVO_SOLO_ADMIN;

  const { hora, minuto } = HORA_INICIO_TURNO[turno];
  const inicioEvento = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), hora + OFFSET_ARGENTINA_HORAS, minuto)
  );
  const horasHastaEvento = (inicioEvento.getTime() - ahora.getTime()) / (1000 * 60 * 60);
  if (horasHastaEvento < 24) {
    return horasHastaEvento < 0 ? "Ya pasó" : "Menos de 24 hs";
  }

  const ahoraArgentina = new Date(ahora.getTime() - OFFSET_ARGENTINA_HORAS * 60 * 60 * 1000);
  const inicioMesActual = Date.UTC(ahoraArgentina.getUTCFullYear(), ahoraArgentina.getUTCMonth(), 1);
  const inicioMesLuegoDelSiguiente = Date.UTC(ahoraArgentina.getUTCFullYear(), ahoraArgentina.getUTCMonth() + 2, 1);
  if (fecha.getTime() < inicioMesActual || fecha.getTime() >= inicioMesLuegoDelSiguiente) {
    return "Solo mes actual o siguiente";
  }

  return null;
}
