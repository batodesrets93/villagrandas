import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default function NavAdmin() {
  const links = [
    { href: "/admin", label: "Panel" },
    { href: "/admin/unidades", label: "Unidades" },
    { href: "/admin/expensas", label: "Expensas" },
    { href: "/admin/reservas", label: "Reservas" },
    { href: "/admin/reclamos", label: "Reclamos" },
  ];
  return (
    <nav className="bg-brand-700 text-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="font-bold">Villa Grandas · Admin</span>
        <div className="flex gap-4 items-center text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:underline">
              {l.label}
            </Link>
          ))}
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
