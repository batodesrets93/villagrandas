"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearReservaAction } from "@/lib/actions";
import CartelResultado, { CartelData } from "@/components/CartelResultado";

export default function NuevaReservaForm({ quinchos }: { quinchos: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [cartel, setCartel] = useState<CartelData | null>(null);
  const [cargando, setCargando] = useState(false);
  // Evita un segundo envío si se toca dos veces antes de que React deshabilite el botón.
  const enviando = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const hoy = new Date();
  const formatFecha = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const fechaMinima = formatFecha(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMesSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0);
  const fechaMaxima = formatFecha(
    finMesSiguiente.getFullYear(),
    finMesSiguiente.getMonth(),
    finMesSiguiente.getDate()
  );

  async function onSubmit(formData: FormData) {
    if (enviando.current) return;
    enviando.current = true;
    setError("");
    setCargando(true);
    const quinchoNombre = quinchos.find((q) => q.id === String(formData.get("quinchoId")))?.nombre ?? "";
    const [y, m, d] = String(formData.get("fecha") ?? "").split("-");
    const turnoTxt = String(formData.get("turno")) === "NOCHE" ? "Noche" : "Mediodía";
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
            { etiqueta: "Quincho", valor: quinchoNombre },
            ...(y && m && d ? [{ etiqueta: "Fecha", valor: `${d}/${m}/${y}` }] : []),
            { etiqueta: "Turno", valor: turnoTxt },
          ],
        });
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(resultado.error);
      }
    } catch (e: any) {
      setError(
        "No pudimos confirmar si la reserva se hizo. Mirá en «Mis próximas reservas» antes de volver a intentar."
      );
    } finally {
      setCargando(false);
      enviando.current = false;
    }
  }

  return (
    <form ref={formRef} action={onSubmit} className="card space-y-3">
      <h2 className="font-semibold">Nueva reserva</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">Quincho</label>
          <select name="quinchoId" required>
            {quinchos.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Fecha</label>
          <input name="fecha" type="date" required min={fechaMinima} max={fechaMaxima} />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Turno</label>
          <select name="turno" required>
            <option value="MEDIODIA">Mediodía (9:00 a 15:30)</option>
            <option value="NOCHE">Noche (18:30 a 0:30 / 2:00)</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={cargando} className="btn btn-primary">
        {cargando ? "Reservando... no cierres esta pantalla" : "Reservar ($ 50.000)"}
      </button>
      <CartelResultado cartel={cartel} onCerrar={() => setCartel(null)} />
    </form>
  );
}
