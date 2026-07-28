import { prisma } from "@/lib/prisma";
import { crearAccesoPropietarioAction } from "@/lib/actions";

function money(n: number) {
  return n ? "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2 }) : "-";
}

export default async function UnidadesPage() {
  const unidades = await prisma.unidad.findMany({
    orderBy: [{ torre: "asc" }, { piso: "asc" }, { depto: "asc" }],
    include: { usuarios: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Unidades</h1>
      <p className="text-sm text-gray-600">
        79 unidades cargadas (Torre Grande: 57 · Torre Chica: 22). Asigná un email y contraseña a cada propietario
        para que pueda entrar a ver su cuenta corriente, reservar quincho y hacer reclamos.
      </p>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Torre</th>
              <th>Piso</th>
              <th>Depto</th>
              <th>Titular</th>
              <th>m²</th>
              <th>Cochera</th>
              <th>Baulera</th>
              <th>Acceso</th>
            </tr>
          </thead>
          <tbody>
            {unidades.map((u) => (
              <tr key={u.id}>
                <td>{u.torre === "GRANDE" ? "Grande" : "Chica"}</td>
                <td>{u.piso}</td>
                <td>{u.depto}</td>
                <td>{u.titular}</td>
                <td>{u.m2}</td>
                <td>{money(u.cocheraMonto)}</td>
                <td>{money(u.bauleraMonto)}</td>
                <td>
                  {u.usuarios.length > 0 ? (
                    <span className="text-brand-600 font-medium">{u.usuarios[0].email}</span>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-sm text-brand-600 underline">Crear acceso</summary>
                      <form action={crearAccesoPropietarioAction} className="mt-2 space-y-2 w-56">
                        <input type="hidden" name="unidadId" value={u.id} />
                        <input name="nombre" placeholder="Nombre" defaultValue={u.titular} required />
                        <input name="email" type="email" placeholder="Email" required />
                        <input name="password" type="password" placeholder="Contraseña (mín. 6)" required />
                        <button type="submit" className="btn btn-primary w-full">
                          Guardar
                        </button>
                      </form>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
