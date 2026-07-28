import { prisma } from "@/lib/prisma";
import { cancelarReservaAction } from "@/lib/actions";

export default async function ReservasAdminPage() {
  const reservas = await prisma.reserva.findMany({
    where: { estado: "CONFIRMADA" },
    orderBy: { fecha: "asc" },
    include: { unidad: true, quincho: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Reservas de quincho</h1>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Turno</th>
              <th>Quincho</th>
              <th>Unidad</th>
              <th>Facturado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((r) => (
              <tr key={r.id}>
                <td>{r.fecha.toLocaleDateString("es-AR")}</td>
                <td>{r.turno === "MEDIODIA" ? "Mediodía" : "Noche"}</td>
                <td>{r.quincho.nombre}</td>
                <td>
                  {r.unidad.torre === "GRANDE" ? "TG" : "TC"} {r.unidad.piso}º{r.unidad.depto}
                </td>
                <td>{r.cargoId ? "Sí" : "Pendiente"}</td>
                <td>
                  {!r.cargoId && (
                    <form action={cancelarReservaAction}>
                      <input type="hidden" name="reservaId" value={r.id} />
                      <button className="btn btn-danger text-xs">Cancelar</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {reservas.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-6">
                  No hay reservas confirmadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
