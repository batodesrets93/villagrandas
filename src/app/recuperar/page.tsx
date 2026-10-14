"use client";

import { useState } from "react";
import Link from "next/link";
import { solicitarRecuperoPasswordAction } from "@/lib/actions";

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    const fd = new FormData();
    fd.set("email", email);
    const res = await solicitarRecuperoPasswordAction(fd);
    setCargando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEnviado(true);
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
          {enviado ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-700">
                Si el email <strong>{email}</strong> tiene una cuenta, te enviamos un link para elegir una contraseña nueva.
                Vale por 1 hora. Revisá también la carpeta de spam.
              </p>
              <Link href="/login" className="btn btn-primary w-full inline-block text-center">
                Volver a ingresar
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-6 text-center">
                Ingresá tu email y te mandamos un link para restablecer la contraseña.
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={cargando} className="btn btn-primary w-full">
                  {cargando ? "Enviando..." : "Enviar link"}
                </button>
                <p className="text-center text-sm">
                  <Link href="/login" className="text-gray-600 underline">
                    Volver
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
