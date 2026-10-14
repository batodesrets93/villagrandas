import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unidadesDeUsuario } from "@/lib/unidadesUsuario";

// Recordatorio de en nombre de que unidad se esta operando. Solo aparece si el
// propietario tiene mas de una unidad, para que no reserve o reclame en el
// departamento equivocado.
export default async function UnidadActivaAviso() {
  const session = await getServerSession(authOptions);
  const usuarioId = (session?.user as any)?.id as string | undefined;
  const unidadId = (session?.user as any)?.unidadId as string | undefined;
  if (!usuarioId || !unidadId) return null;

  const unidades = await unidadesDeUsuario(usuarioId);
  if (unidades.length < 2) return null;
  const actual = unidades.find((u) => u.id === unidadId);
  if (!actual) return null;

  return (
    <div className="bg-brand-50 border border-brand-100 text-brand-700 rounded-lg px-3 py-2 text-sm">
      Estás operando como: <strong>{actual.label}</strong>
      <span className="text-gray-500"> · Para cambiar de departamento, usá el selector de arriba.</span>
    </div>
  );
}
