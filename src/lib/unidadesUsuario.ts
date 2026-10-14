import { prisma } from "@/lib/prisma";

export type UnidadDeUsuario = { id: string; label: string };

function etiqueta(u: { torre: "GRANDE" | "CHICA"; piso: string; depto: string }) {
  return (u.torre === "GRANDE" ? "Torre Grande" : "Torre Chica") + " · " + u.piso + "º " + u.depto;
}

// Todas las unidades a las que un usuario propietario tiene acceso: la unidad
// por defecto (Usuario.unidadId) mas las de UsuarioUnidad. Un mismo email puede
// tener varios departamentos.
export async function unidadesDeUsuario(usuarioId: string): Promise<UnidadDeUsuario[]> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      unidad: { select: { id: true, torre: true, piso: true, depto: true } },
      unidadesExtra: {
        select: { unidad: { select: { id: true, torre: true, piso: true, depto: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!usuario) return [];

  const todas = [usuario.unidad, ...usuario.unidadesExtra.map((x) => x.unidad)].filter(
    (u): u is NonNullable<typeof u> => !!u
  );
  const vistas = new Set<string>();
  const resultado: UnidadDeUsuario[] = [];
  for (const u of todas) {
    if (vistas.has(u.id)) continue;
    vistas.add(u.id);
    resultado.push({ id: u.id, label: etiqueta(u) });
  }
  return resultado;
}

export async function usuarioTieneUnidad(usuarioId: string, unidadId: string): Promise<boolean> {
  const unidades = await unidadesDeUsuario(usuarioId);
  return unidades.some((u) => u.id === unidadId);
}
