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
    <nav className="bg-brand-700 text-white overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-bold text-sm sm:text-base whitespace-nowrap">Villa Grandas · Admin</span>
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
