import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default function NavPropietario() {
  const links = [
    { href: "/propietario", label: "Mi cuenta" },
    { href: "/propietario/reservas", label: "Reservar quincho" },
    { href: "/propietario/reclamos", label: "Reclamos" },
  ];
  return (
    <nav className="bg-brand-700 text-white">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="font-bold">Villa Grandas</span>
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
