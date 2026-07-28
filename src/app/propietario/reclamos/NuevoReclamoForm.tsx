"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { crearReclamoAction } from "@/lib/actions";

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
      <textarea name="descripcion" placeholder="Contanos qué pasó..." rows={3} required />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={cargando} className="btn btn-primary">
        {cargando ? "Enviando..." : "Enviar reclamo"}
      </button>
    </form>
  );
}
