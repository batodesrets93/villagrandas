"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setCargando(false);
    if (res?.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative bg-cover bg-center"
      style={{ backgroundImage: "url(/hero-pool.jpg)" }}
    >
      {/* Overlay oscuro para que el texto quede legible sobre la foto */}
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-6">
          <p
            className="text-xs tracking-[0.3em] text-white/90 uppercase mb-1"
            style={{ textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}
          >
            Torres
          </p>
          <h1
            className="text-3xl font-bold text-white uppercase tracking-wide"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}
          >
            Villa Grandas
          </h1>
        </div>

        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl p-6">
          <p className="text-sm text-gray-500 mb-6 text-center">Ingresá con tu email y contraseña</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Contraseña</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={cargando} className="btn btn-primary w-full">
              {cargando ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
