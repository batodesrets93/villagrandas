import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { QUINCHO_COLORES, COLOR_DEFAULT } from "@/lib/quinchoColors";
import { cancelarReservaAction } from "@/lib/actions";

export type ReservaCalendario = {
  id: string;
  fecha: Date;
  turno: "MEDIODIA" | "NOCHE";
  quinchoNombre: string;
  unidadLabel: string;
  facturada: boolean;
  puedeCancelar: boolean;
};

export default function CalendarioReservas({
  mes,
  reservas,
  diaSeleccionado,
  basePath,
}: {
  mes: Date;
  reservas: ReservaCalendario[];
  diaSeleccionado?: Date;
  basePath: string;
}) {
  const inicioMes = startOfMonth(mes);
  const finMes = endOfMonth(mes);
  const dias = eachDayOfInterval({
    start: startOfWeek(inicioMes, { weekStartsOn: 0 }),
    end: endOfWeek(finMes, { weekStartsOn: 0 }),
  });

  const porDia = new Map<string, ReservaCalendario[]>();
  for (const r of reservas) {
    const key = format(r.fecha, "yyyy-MM-dd");
    if (!porDia.has(key)) porDia.set(key, []);
    porDia.get(key)!.push(r);
  }

  const mesParam = format(mes, "yyyy-MM");
  const hrefMes = (m: Date) => `${basePath}?mes=${format(m, "yyyy-MM")}`;
  const hrefDia = (d: Date) => `${basePath}?mes=${mesParam}&dia=${format(d, "yyyy-MM-dd")}`;

  const reservasDelDiaSeleccionado = diaSeleccionado
    ? porDia.get(format(diaSeleccionado, "yyyy-MM-dd")) ?? []
    : [];

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <Link href={hrefMes(subMonths(mes, 1))} className="btn btn-secondary text-sm">
            ‹
          </Link>
          <h2 className="font-semibold capitalize text-brand-700">
            {format(mes, "MMMM yyyy", { locale: es })}
          </h2>
          <Link href={hrefMes(addMonths(mes, 1))} className="btn btn-secondary text-sm">
            ›
          </Link>
        </div>

        <div className="flex gap-3 text-xs text-gray-500 mb-2">
          {Object.entries(QUINCHO_COLORES).map(([nombre, c]) => (
            <span key={nombre} className="flex items-center gap-1">
              <span style={{ background: c.dot }} className="w-2 h-2 rounded-full inline-block" />
              {nombre}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dias.map((dia) => {
            const key = format(dia, "yyyy-MM-dd");
            const delDia = porDia.get(key) ?? [];
            const enMes = isSameMonth(dia, mes);
            const seleccionado = !!diaSeleccionado && isSameDay(dia, diaSeleccionado);

            return (
              <Link
                key={key}
                href={hrefDia(dia)}
                className="rounded-lg p-1 text-xs block"
                style={{
                  background: enMes ? "white" : "#f7f8f7",
                  border: seleccionado ? "2px solid #255943" : "1px solid #eee",
                  minHeight: "64px",
                  opacity: enMes ? 1 : 0.5,
                }}
              >
                <div className="font-semibold text-gray-700 mb-1">{format(dia, "d")}</div>
                {delDia.slice(0, 3).map((r) => {
                  const c = QUINCHO_COLORES[r.quinchoNombre] ?? COLOR_DEFAULT;
                  return (
                    <div
                      key={r.id}
                      className="rounded px-1 mb-0.5 truncate"
                      style={{ background: c.bg, color: c.text }}
                    >
                      {r.quinchoNombre} · {r.turno === "MEDIODIA" ? "Mediodía" : "Noche"}
                    </div>
                  );
                })}
                {delDia.length > 3 && <div className="text-gray-400">+{delDia.length - 3} más</div>}
              </Link>
            );
          })}
        </div>
      </div>

      {diaSeleccionado && (
        <div className="card">
          <p className="text-sm text-gray-500 mb-3">
            Reservas del {format(diaSeleccionado, "d 'de' MMMM", { locale: es })}
          </p>
          {reservasDelDiaSeleccionado.length === 0 && (
            <p className="text-sm text-gray-400">No hay reservas ese día.</p>
          )}
          <div className="space-y-2">
            {reservasDelDiaSeleccionado.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
                <span>
                  <strong className="text-brand-700">{r.quinchoNombre}</strong> ·{" "}
                  {r.turno === "MEDIODIA" ? "Mediodía" : "Noche"} · {r.unidadLabel}
                  {!r.facturada && <span className="text-gray-400"> · pendiente de facturar</span>}
                </span>
                {r.puedeCancelar && (
                  <form action={cancelarReservaAction}>
                    <input type="hidden" name="reservaId" value={r.id} />
                    <button className="btn btn-danger text-xs">Cancelar</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
