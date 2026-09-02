import QRCode from "qrcode";
import CopyText from "./CopyText";
import { getDatosPago, datosPagoCompletos } from "@/lib/datosPago";

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Tarjeta con los datos bancarios del consorcio (alias, CVU, titular) para
// que el propietario transfiera facil, mas un QR de conveniencia con el
// mismo texto (no es el estandar "Transferencias 3.0" del BCRA que
// autocompleta en todas las apps de banco: sirve para escanear con el
// celular y tener los datos a mano/copiarlos rapido, no para autocompletar
// en cualquier home banking).
export default async function DatosPagoCard({
  monto,
  referencia,
}: {
  monto: number;
  referencia: string;
}) {
  const datos = getDatosPago();
  if (!datosPagoCompletos(datos)) return null;

  const textoQr = [
    datos.alias ? `Alias: ${datos.alias}` : null,
    datos.cvu ? `CVU: ${datos.cvu}` : null,
    datos.titular ? `Titular: ${datos.titular}` : null,
    `Monto: ${money(monto)}`,
    `Ref: ${referencia}`,
  ]
    .filter(Boolean)
    .join("\n");

  const qrDataUrl = await QRCode.toDataURL(textoQr, { margin: 1, width: 220 });

  return (
    <div className="card">
      <h2 className="font-semibold mb-1">Pagar por transferencia</h2>
      <p className="text-xs text-gray-400 mb-3">
        Transferi {money(monto)} a esta cuenta y despues informa el pago con el comprobante en
        &quot;Informar pago&quot;, abajo, en el periodo correspondiente.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-2">
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

        <div className="flex flex-col items-center gap-1 self-center sm:self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="Codigo QR con los datos de la cuenta del consorcio para transferir"
            width={140}
            height={140}
            className="rounded-lg border border-gray-100"
          />
          <p className="w-32 text-center text-[10px] text-gray-400">
            Solo de referencia: no funciona para pagar desde Mercado Pago u otras apps. Escanealo para tener los datos a mano.
          </p>
        </div>
      </div>
    </div>
  );
}
