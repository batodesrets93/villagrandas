import { prisma } from "@/lib/prisma";
import UnidadesTable from "./UnidadesTable";

export default async function UnidadesPage() {
  const unidades = await prisma.unidad.findMany({
    orderBy: [{ torre: "asc" }, { piso: "asc" }, { depto: "asc" }],
    include: { usuarios: true },
  });

  const filas = unidades.map((u) => ({
    id: u.id,
    torre: u.torre,
    piso: u.piso,
    depto: u.depto,
    titular: u.titular,
    m2: u.m2,
    cocheraM2: u.cocheraM2,
    bauleraM2: u.bauleraM2,
    esDesarrollador: u.esDesarrollador,
    email: u.usuarios[0]?.email ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Unidades</h1>
      <p className="text-sm text-gray-600">
        79 unidades cargadas (Torre Grande: 57 · Torre Chica: 22). Asigná un email y contraseña a cada propietario
        para que pueda entrar a ver su cuenta corriente, reservar quincho y hacer reclamos. Tildá &quot;Edificio&quot;
       en las unidades que son del desarrollador (no de un propietario real): quedan excluidas del ranking de
        deudores del dashboard. Las columnas Cochera/Baulera muestran los m² asignados a cada unidad (dato fijo);
        el monto en pesos se calcula automáticamente en cada período de expensas, igual que el gasto común.
      </p>

      <UnidadesTable unidades={filas} />
    </div>
  );
}
