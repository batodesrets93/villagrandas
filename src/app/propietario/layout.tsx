import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import NavPropietario from "@/components/NavPropietario";

export default async function PropietarioLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (rol !== "PROPIETARIO") {
    redirect("/login");
  }

  return (
    <div>
      <NavPropietario />
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
