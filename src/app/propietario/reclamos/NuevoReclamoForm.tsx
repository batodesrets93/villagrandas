"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { crearReclamoAction } from "@/lib/actions";

const CATEGORIAS: { value: string; label: string }[] = [
  { value: "RUIDO", label: "Ruido" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
  { value: "SEGURIDAD", label: "Seguridad" },
  { value: "CONVIVENCIA", label: "Convivencia" },
  { value: "ASCENSOR", label: "Ascensor" },
  { value: "PLOMERIA", label: "Plomería" },
  { value: "ELECTRICIDAD", label: "Electricidad" },
  { value: "LIMPIEZA", label: "Limpieza" },
  { value: "OTRO", label: "Otro" },
];

export default function NuevoReclamoForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onSubmit(formData: FormData) {
    setError("");
    setCargando(true);
    try {
      await crearReclamoAction(formData);
      formRef.current?.reset();
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "No se pudo enviar el reclamo");
    } finally {
      setCargando(false);
    }
  }

  return (
    <form ref={formRef} action={onSubmit} className="card space-y-3">
      <h2 className="font-semibold">Nuevo reclamo</h2>
      <input name="titulo" placeholder="Título (ej: Ruido molesto, Ascensor, etc.)" required />
      <select name="categoria" defaultValue="OTRO" required>
        {CATEGORIAS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <textarea name="descripcion" placeholder="Contanos qué pasó..." rows={3} required />
      <div>
        <label className="text-xs text-gray-500 block mb-1">
          Adjuntar fotos o PDF (opcional, hasta 5 archivos, 8 MB c/u)
        </label>
        <input
          type="file"
          name="archivos"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="text-xs"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={cargando} className="btn btn-primary">
        {cargando ? "Enviando..." : "Enviar reclamo"}
      </button>
    </form>
  );
}
