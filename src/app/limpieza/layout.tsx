import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { contarReservasNuevasLimpiezaAction } from "@/lib/actions";
import NavLimpieza from "@/components/NavLimpieza";

export default async function LimpiezaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (rol !== "LIMPIEZA") {
    redirect("/login");
  }

  const nuevas = await contarReservasNuevasLimpiezaAction();

  return (
    <div>
      <NavLimpieza initialCount={nuevas} />
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
