import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default function NavPropietario() {
  const links = [
    { href: "/propietario", label: "Mi cuenta" },
    { href: "/propietario/reservas", label: "Reservar quincho" },
    { href: "/propietario/reclamos", label: "Reclamos" },
  ];
  return (
    <nav className="bg-brand-700 text-white overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-bold text-sm sm:text-base whitespace-nowrap">Villa Grandas</span>
        <div className="flex gap-3 sm:gap-4 items-center text-xs sm:text-sm overflow-x-auto whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:underline flex-shrink-0">
              {l.label}
            </Link>
          ))}
          <span className="flex-shrink-0">
            <SignOutButton />
          </span>
        </div>
      </div>
    </nav>
  );
}
