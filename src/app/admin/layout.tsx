import NavAdmin from "@/components/NavAdmin";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <NavAdmin />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
