import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  actualizarTitularAction,
  crearAccesoPropietarioAction,
  editarAccesoAction,
  cambiarEstadoAccesoAction,
} from "@/lib/actions";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function DetalleUnidadPage({ params }: { params: { id: string } }) {
  const unidad = await prisma.unidad.findUniqueOrThrow({
    where: { id: params.id },
    include: { usuarios: { orderBy: { createdAt: "asc" } } },
  });

  const pagos = await prisma.pago.findMany({
    where: { cargo: { unidadId: unidad.id } },
    include: { cargo: { include: { periodo: true } } },
    orderBy: { fecha: "desc" },
  });

  const totalPagado = pagos.reduce((acc, p) => acc + p.monto, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/unidades" className="text-sm text-brand-600 underline">
          ← Volver a unidades
        </Link>
        <h1 className="text-2xl font-bold text-brand-700 mt-1">
          {unidad.torre === "GRANDE" ? "Torre Grande" : "Torre Chica"} · Piso {unidad.piso} - Depto {unidad.depto}
        </h1>
        <p className="text-sm text-gray-500">{unidad.titular}</p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Titular</h2>
        <form action={actualizarTitularAction} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <input type="hidden" name="unidadId" value={unidad.id} />
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Nombre del titular actual</label>
            <input type="text" name="titular" defaultValue={unidad.titular} required />
          </div>
          <button type="submit" className="btn btn-primary whitespace-nowrap">
            Guardar
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2">
          Cambiar este campo no afecta los accesos ya otorgados — hacelo aparte, más abajo, si vendió el depto.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Accesos ({unidad.usuarios.length})</h2>

        {unidad.usuarios.length === 0 && (
          <p className="text-sm text-gray-400 mb-3">Esta unidad todavía no tiene ningún acceso creado.</p>
        )}

        <div className="space-y-2">
          {unidad.usuarios.map((u) => (
            <div
              key={u.id}
              className="border rounded-lg p-3"
              style={{ borderColor: "#eee", background: u.activo ? "white" : "#fafafa", opacity: u.activo ? 1 : 0.8 }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  <span className="font-semibold text-brand-700">{u.nombre}</span>
                  <span
                    className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={
                      u.activo
                        ? { background: "#dfeae4", color: "#1c4534" }
                        : { background: "#fee2e2", color: "#991b1b" }
                    }
                  >
                    {u.activo ? "Activo" : "Revocado"}
                  </span>
                  <div className="text-gray-500">{u.email}</div>
                </div>
                <div className="flex gap-2">
                  <details>
                    <summary className="btn btn-secondary text-xs cursor-pointer">Editar</summary>
                    <form action={editarAccesoAction} className="mt-2 space-y-2 w-64">
                      <input type="hidden" name="usuarioId" value={u.id} />
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Nombre</label>
                        <input type="text" name="nombre" defaultValue={u.nombre} required />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Email</label>
                        <input type="email" name="email" defaultValue={u.email} required />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Nueva contraseña (dejar vacío para no cambiarla)
                        </label>
                        <input type="password" name="password" placeholder="••••••••" />
                      </div>
                      <button type="submit" className="btn btn-primary text-xs w-full">
                        Guardar cambios
                      </button>
                    </form>
                  </details>

                  <form action={cambiarEstadoAccesoAction}>
                    <input type="hidden" name="usuarioId" value={u.id} />
                    <input type="hidden" name="activo" value={u.activo ? "false" : "true"} />
                    <button type="submit" className={`btn text-xs ${u.activo ? "btn-danger" : "btn-secondary"}`}>
                      {u.activo ? "Revocar" : "Reactivar"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-brand-600 underline">+ Agregar acceso nuevo</summary>
          <form action={crearAccesoPropietarioAction} className="mt-2 space-y-2 w-64">
            <input type="hidden" name="unidadId" value={unidad.id} />
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nombre</label>
              <input name="nombre" placeholder="Nombre y apellido" defaultValue={unidad.titular} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Email</label>
              <input name="email" type="email" placeholder="email@ejemplo.com" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Contraseña (mín. 6)</label>
              <input name="password" type="password" placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Crear acceso
            </button>
          </form>
        </details>

        <p className="text-xs text-gray-400 mt-3">
          Una unidad puede tener más de un acceso activo a la vez (por ejemplo, ambos cónyuges, o el dueño viejo y el
          nuevo durante la transición). &quot;Revocar&quot; bloquea el login sin borrar su historial de reclamos y
          reservas.
        </p>
      </div>

      <div className="card">
        <p className="text-sm text-gray-500">Total pagado (histórico)</p>
        <p className="text-3xl font-bold text-brand-700">{money(totalPagado)}</p>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Historial de pagos ({pagos.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Período</th>
              <th>Monto</th>
              <th>Medio</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id}>
                <td>{p.fecha.toLocaleDateString("es-AR")}</td>
                <td>{p.cargo.periodo.etiqueta}</td>
                <td className="font-medium">{money(p.monto)}</td>
                <td>{p.medio || "-"}</td>
                <td>{p.nota || "-"}</td>
              </tr>
            ))}
            {pagos.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-6">
                  Todavía no se registraron pagos para esta unidad.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
