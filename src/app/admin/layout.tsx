import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import NavAdmin from "@/components/NavAdmin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const rol = (session?.user as any)?.rol;

  if (rol !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div>
      <NavAdmin />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
