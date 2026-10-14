"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearReservaAction } from "@/lib/actions";
import CartelResultado, { CartelData } from "@/components/CartelResultado";

export type SlotDia =
  | { tipo: "libre" }
  | { tipo: "ocupado"; unidad: string }
  | { tipo: "propia" }
  | { tipo: "no"; motivo: string };

export type QuinchoDia = {
  id: string;
  nombre: string;
  info: string;
  mediodia: SlotDia;
  noche: SlotDia;
};

type Turno = "MEDIODIA" | "NOCHE";
const TURNOS: { clave: Turno; campo: "mediodia" | "noche"; nombre: string; horario: string }[] = [
  { clave: "MEDIODIA", campo: "mediodia", nombre: "Mediodía", horario: "9:00 a 15:30" },
  { clave: "NOCHE", campo: "noche", nombre: "Noche", horario: "18:30 a 0:30" },
];

function SlotCelda({ slot, onReservar }: { slot: SlotDia; onReservar: () => void }) {
  if (slot.tipo === "libre") {
    return (
      <button type="button" onClick={onReservar} className="btn btn-primary text-xs w-full">
        Libre · Reservar
      </button>
    );
  }
  if (slot.tipo === "propia") {
    return (
      <div className="rounded-lg bg-green-50 text-green-700 text-xs text-center py-2 px-1 font-medium">
        ✓ Es tu reserva
      </div>
    );
  }
  if (slot.tipo === "ocupado") {
    return (
      <div className="rounded-lg bg-gray-100 text-gray-500 text-xs text-center py-2 px-1">
        Ocupado · {slot.unidad}
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-gray-50 text-gray-400 text-xs text-center py-2 px-1">{slot.motivo}</div>
  );
}

/**
 * Muestra, para el día elegido en el calendario, qué quincho y turno están
 * libres u ocupados, y permite reservar directo desde ahí. Como cada reserva
 * suma $ 50.000 a la liquidación, antes de reservar pide una confirmación.
 */
export default function DisponibilidadDia({
  diaISO,
  diaTexto,
  quinchos,
}: {
  diaISO: string;
  diaTexto: string;
  quinchos: QuinchoDia[];
}) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<{ quinchoId: string; nombre: string; turno: Turno } | null>(null);
  const [error, setError] = useState("");
  const [cartel, setCartel] = useState<CartelData | null>(null);
  const [cargando, setCargando] = useState(false);
  // Evita un segundo envío si se toca dos veces antes de que React deshabilite el botón.
  const enviando = useRef(false);

  async function confirmar() {
    if (!seleccion || enviando.current) return;
    enviando.current = true;
    setError("");
    setCargando(true);
    const formData = new FormData();
    formData.set("quinchoId", seleccion.quinchoId);
    formData.set("fecha", diaISO);
    formData.set("turno", seleccion.turno);
    const [y, m, d] = diaISO.split("-");
    try {
      const resultado = await crearReservaAction(formData);
      if (resultado.ok) {
        const yaExistia = !!resultado.data?.yaExistia;
        setCartel({
          tipo: yaExistia ? "aviso" : "ok",
          titulo: yaExistia ? "Esta reserva ya estaba confirmada" : "¡Reserva confirmada!",
          mensaje: yaExistia
            ? "Ya tenías reservado este quincho para ese día y turno. No hace falta reservar de nuevo ni se cobra dos veces."
            : "Tu reserva quedó registrada y te mandamos un email de confirmación. No hace falta reservar de nuevo.",
          detalles: [
            { etiqueta: "Quincho", valor: seleccion.nombre },
            { etiqueta: "Fecha", valor: `${d}/${m}/${y}` },
            { etiqueta: "Turno", valor: seleccion.turno === "NOCHE" ? "Noche" : "Mediodía" },
          ],
        });
        setSeleccion(null);
        router.refresh();
      } else {
        setError(resultado.error);
      }
    } catch {
      setError("No pudimos confirmar si la reserva se hizo. Mirá en «Mis próximas reservas» antes de volver a intentar.");
    } finally {
      setCargando(false);
      enviando.current = false;
    }
  }

  const turnoSel = seleccion ? TURNOS.find((t) => t.clave === seleccion.turno)! : null;

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-brand-700">Disponibilidad del {diaTexto}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {quinchos.map((q) => (
          <div key={q.id} className="rounded-xl border border-gray-100 p-3 space-y-2">
            <div>
              <p className="font-semibold text-gray-800">{q.nombre}</p>
              <p className="text-xs text-gray-400">{q.info}</p>
            </div>
            {TURNOS.map((t) => (
              <div key={t.clave}>
                <p className="text-xs text-gray-500 mb-1">
                  {t.nombre} <span className="text-gray-400">({t.horario})</span>
                </p>
                <SlotCelda
                  slot={q[t.campo]}
                  onReservar={() => {
                    setError("");
                    setSeleccion({ quinchoId: q.id, nombre: q.nombre, turno: t.clave });
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {seleccion && turnoSel && (
        <div className="rounded-xl border-2 border-brand-600 bg-brand-50/40 p-3 space-y-2" role="group" aria-label="Confirmar reserva">
          <p className="text-sm text-gray-800">
            ¿Reservar <strong>{seleccion.nombre}</strong> el <strong>{diaTexto}</strong>, turno{" "}
            <strong>{turnoSel.nombre.toLowerCase()}</strong> ({turnoSel.horario})?
          </p>
          <p className="text-xs text-gray-500">
            Cuesta <strong>$ 50.000</strong> y se suma a tu próxima liquidación de expensas.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={confirmar} disabled={cargando} className="btn btn-primary text-sm">
              {cargando ? "Reservando... no cierres esta pantalla" : "Confirmar reserva"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSeleccion(null);
                setError("");
              }}
              disabled={cargando}
              className="btn btn-secondary text-sm"
            >
              Volver
            </button>
          </div>
        </div>
      )}

      <CartelResultado cartel={cartel} onCerrar={() => setCartel(null)} />
    </div>
  );
}
