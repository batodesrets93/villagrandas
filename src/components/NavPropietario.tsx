import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default function NavPropietario() {
  const links = [
    { href: "/propietario", label: "Mi cuenta" },
    { href: "/propietario/reservas", label: "Reservar quincho" },
    { href: "/propietario/reclamos", label: "Reclamos/Sugerencias" },
  ];
  return (
    <nav className="bg-brand-700 text-white">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="font-bold text-sm sm:text-base">Villa Grandas</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
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
