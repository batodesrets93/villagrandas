"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// Solo se muestra si el email tiene mas de una unidad. Al cambiar, se actualiza
// la unidad activa de la sesion y se recarga la pantalla.
export default function SelectorUnidad({
  unidades,
  unidadIdActual,
}: {
  unidades: { id: string; label: string }[];
  unidadIdActual: string;
}) {
  const { update } = useSession();
  const router = useRouter();
  const [cambiando, setCambiando] = useState(false);

  if (unidades.length < 2) return null;

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setCambiando(true);
    await update({ unidadId: e.target.value });
    router.refresh();
    setCambiando(false);
  }

  return (
    <select
      value={unidadIdActual}
      onChange={onChange}
      disabled={cambiando}
      aria-label="Unidad"
      className="text-xs sm:text-sm text-gray-900 rounded px-2 py-1"
    >
      {unidades.map((u) => (
        <option key={u.id} value={u.id}>
          {u.label}
        </option>
      ))}
    </select>
  );
}
