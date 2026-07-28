import NavPropietario from "@/components/NavPropietario";

export default function PropietarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <NavPropietario />
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
