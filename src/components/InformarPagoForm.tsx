"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { informarPagoAction } from "@/lib/actions";

const MEDIOS = ["Transferencia", "Depósito", "Efectivo", "Otro"];

// Formatea lo que el usuario va tipeando como monto en pesos argentinos:
// punto como separador de miles, coma como separador decimal (máx. 2 dígitos).
// Acepta que el usuario tipee "," O "." para marcar los decimales: el primer
// separador que aparezca (sea cual sea) se toma como el decimal, y cualquier
// otro punto/coma posterior se descarta. El valor resultante (sin el "$ ")
// sigue siendo compatible con parseMonto en actions.ts.
function formatearMontoInput(valor: string): string {
  let limpio = valor.replace(/[^\d.,]/g, "");

  const primerSeparador = limpio.search(/[.,]/);
  if (primerSeparador !== -1) {
    const entero = limpio.slice(0, primerSeparador).replace(/[.,]/g, "");
    const decimales = limpio.slice(primerSeparador + 1).replace(/[.,]/g, "");
    limpio = `${entero},${decimales}`;
  }

  const [enteroRaw, decimalRaw] = limpio.split(",");
  const entero = enteroRaw.replace(/^0+(?=\d)/, "");
  const decimal = decimalRaw !== undefined ? decimalRaw.slice(0, 2) : undefined;

  const enteroFormateado = entero ? entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";

  if (decimal !== undefined) return `${enteroFormateado},${decimal}`;
  return enteroFormateado;
}

export default function InformarPagoForm({ cargoId }: { cargoId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [monto, setMonto] = useState("");

  async function onSubmit(formData: FormData) {
    setError("");
    setOk(false);
    setCargando(true);
    const res = await informarPagoAction(formData);
    setCargando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOk(true);
    setMonto("");
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-2 mt-2 w-56">
      <input type="hidden" name="cargoId" value={cargoId} />
      <div className="relative w-full">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
        <input
          name="monto"
          placeholder="0"
          inputMode="decimal"
          required
          className="text-xs w-full pl-5"
          value={monto}
          onChange={(e) => setMonto(formatearMontoInput(e.target.value))}
        />
      </div>
      <input
        type="date"
        name="fecha"
        defaultValue={new Date().toISOString().slice(0, 10)}
        required
        className="text-xs w-full"
      />
      <select name="medio" defaultValue="Transferencia" className="text-xs w-full">
        {MEDIOS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <input name="nota" placeholder="Nota (opcional)" className="text-xs w-full" />
      <div>
        <label className="text-xs text-gray-500 block mb-1">
          Comprobante/s (foto o PDF, hasta 5, 8&nbsp;MB c/u)
        </label>
        <input
          type="file"
          name="archivos"
          multiple
          required
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="text-xs w-full"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {ok && <p className="text-xs text-brand-600">Pago informado. La administración lo va a revisar.</p>}
      <button type="submit" disabled={cargando} className="btn btn-primary text-xs w-full">
        {cargando ? "Enviando..." : "Informar pago"}
      </button>
    </form>
  );
}
