import CopyText from "./CopyText";
import { getDatosPago, datosPagoCompletos } from "@/lib/datosPago";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Tarjeta con los datos bancarios del consorcio (alias, CVU, titular) para
// que el propietario transfiera facil.
// El QR de conveniencia se saco (no era un QR interoperable estandar
// "Transferencias 3.0" del BCRA, solo texto plano). Cuando se implemente
// un QR que redirija a un lugar real para transferir, se agrega aca.
export default async function DatosPagoCard({
  monto,
  referencia,
}: {
  monto: number;
  referencia: string;
}) {
  const datos = getDatosPago();
  if (!datosPagoCompletos(datos)) return null;

  return (
    <div className="card">
      <h2 className="font-semibold mb-1">Pagar por transferencia</h2>
      <p className="text-xs text-gray-400 mb-3">
        Transferi {money(monto)} a esta cuenta y despues informa el pago con el comprobante en
        &quot;Informar pago&quot;, abajo, en el periodo correspondiente.
      </p>

      <div className="space-y-2">
        {datos.alias && <CopyText label="Alias" value={datos.alias} />}
        {datos.cvu && <CopyText label="CVU" value={datos.cvu} />}
        {datos.titular && (
          <p className="px-1">
            <span className="block text-xs text-gray-400">Titular</span>
            <span className="font-medium text-gray-800 break-all">{datos.titular}</span>
          </p>
        )}
        {datos.cuit && (
          <p className="px-1">
            <span className="block text-xs text-gray-400">CUIT</span>
            <span className="font-medium text-gray-800 break-all">{datos.cuit}</span>
          </p>
        )}
        {datos.banco && <p className="px-1 text-xs text-gray-400">Banco: {datos.banco}</p>}
      </div>
    </div>
  );
}
