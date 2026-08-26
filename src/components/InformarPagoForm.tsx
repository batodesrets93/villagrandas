"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { informarPagoAction } from "@/lib/actions";

const MEDIOS = ["Transferencia", "Depósito", "Efectivo", "Otro"];

export default function InformarPagoForm({ cargoId }: { cargoId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [cargando, setCargando] = useState(false);

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
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-2 mt-2 w-56">
      <input type="hidden" name="cargoId" value={cargoId} />
      <input name="monto" placeholder="Monto pagado" inputMode="decimal" required className="text-xs w-full" />
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
