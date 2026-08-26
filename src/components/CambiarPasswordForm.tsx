"use client";

import { useState, useRef } from "react";
import { cambiarPasswordAction } from "@/lib/actions";

export default function CambiarPasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(formData: FormData) {
    setError("");
    setOk(false);
    setCargando(true);
    try {
      const resultado = await cambiarPasswordAction(formData);
      if (resultado.ok) {
        setOk(true);
        formRef.current?.reset();
      } else {
        setError(resultado.error);
      }
    } catch (e: any) {
      setError(e.message ?? "No se pudo cambiar la contraseña");
    } finally {
      setCargando(false);
    }
  }

  if (!abierto) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="text-xs text-gray-400 hover:text-brand-600 underline underline-offset-2"
        >
          Actualizar contraseña
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={onSubmit} className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Cambiar contraseña</h2>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError("");
            setOk(false);
          }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancelar
        </button>
      </div>
      <input
        name="passwordActual"
        type="password"
        placeholder="Contraseña actual"
        autoComplete="current-password"
        required
      />
      <input
        name="passwordNueva"
        type="password"
        placeholder="Contraseña nueva (mínimo 6 caracteres)"
        autoComplete="new-password"
        required
      />
      <input
        name="passwordNuevaRepetida"
        type="password"
        placeholder="Repetir contraseña nueva"
        autoComplete="new-password"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-brand-600">Contraseña actualizada correctamente.</p>}
      <button type="submit" disabled={cargando} className="btn btn-primary">
        {cargando ? "Guardando..." : "Guardar nueva contraseña"}
      </button>
    </form>
  );
}
