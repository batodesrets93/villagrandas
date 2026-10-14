"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { restablecerPasswordAction } from "@/lib/actions";

export default function RestablecerForm() {
  const token = useSearchParams().get("token") ?? "";
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordNuevaRepetida, setPasswordNuevaRepetida] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    const fd = new FormData();
    fd.set("token", token);
    fd.set("passwordNueva", passwordNueva);
    fd.set("passwordNuevaRepetida", passwordNuevaRepetida);
    const res = await restablecerPasswordAction(fd);
    setCargando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setListo(true);
  }

  return (
    <div
      className="relative min-h-[100dvh] w-full flex flex-col items-center bg-cover bg-center"
      style={{ backgroundImage: "url(/hero-pool.jpg)" }}
    >
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 mt-[30vh] text-center px-4">
        <p
          className="text-xs tracking-[0.35em] text-white/90 uppercase mb-1"
          style={{ textShadow: "0 2px 6px rgba(0,0,0,0.7)" }}
        >
          Torres
        </p>
        <h1
          className="text-4xl font-bold text-white uppercase tracking-wide"
          style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
        >
          Villa Grandas
        </h1>
      </div>

      <div className="relative z-10 w-full max-w-sm px-4 mt-8 pb-12">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl p-6">
          {listo ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-700">Listo, ya cambiaste tu contraseña. Ingresá con la nueva.</p>
              <Link href="/login" className="btn btn-primary w-full inline-block text-center">
                Ingresar
              </Link>
            </div>
          ) : !token ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-700">
                El link no es válido. Pedí uno nuevo desde &quot;Olvidé mi contraseña&quot;.
              </p>
              <Link href="/recuperar" className="btn btn-primary w-full inline-block text-center">
                Pedir un link nuevo
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-6 text-center">Elegí tu contraseña nueva (mínimo 6 caracteres).</p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Contraseña nueva</label>
                  <input
                    type={mostrarPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={passwordNueva}
                    onChange={(e) => setPasswordNueva(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Repetir contraseña</label>
                  <input
                    type={mostrarPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={passwordNuevaRepetida}
                    onChange={(e) => setPasswordNuevaRepetida(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    className="!w-auto"
                    checked={mostrarPassword}
                    onChange={(e) => setMostrarPassword(e.target.checked)}
                  />
                  Mostrar contraseña
                </label>
                {error && (
                  <p className="text-sm text-red-600">
                    {error}{" "}
                    <Link href="/recuperar" className="underline">
                      Pedir link nuevo
                    </Link>
                  </p>
                )}
                <button type="submit" disabled={cargando} className="btn btn-primary w-full">
                  {cargando ? "Guardando..." : "Cambiar contraseña"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
