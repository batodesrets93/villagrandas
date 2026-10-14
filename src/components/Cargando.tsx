// Pantalla de carga que Next muestra al instante mientras llega la pagina nueva
// (la usan los loading.tsx de cada seccion).
export default function Cargando() {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-brand-700" role="status" aria-live="polite">
      <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <span className="text-sm font-medium">Cargando…</span>
    </div>
  );
}
