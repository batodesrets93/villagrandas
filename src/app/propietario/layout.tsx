import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import NavPropietario from "@/components/NavPropietario";
import SessionProviderClient from "@/components/SessionProviderClient";
import { unidadesDeUsuario } from "@/lib/unidadesUsuario";

export default async function PropietarioLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (rol !== "PROPIETARIO") {
    redirect("/login");
  }

  const unidades = await unidadesDeUsuario((session!.user as any).id);

  return (
    <SessionProviderClient>
      <NavPropietario unidadId={(session?.user as any)?.unidadId} unidades={unidades} />
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </SessionProviderClient>
  );
}
