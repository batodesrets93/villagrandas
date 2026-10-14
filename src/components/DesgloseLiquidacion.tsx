function money(n: number) {
  const abs = Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "-" : "") + "$ " + abs;
}

export type ReservaDesglose = {
  fecha: Date;
  turno: "MEDIODIA" | "NOCHE";
  quinchoNombre: string;
};

export type DesgloseCargo = {
  gastoComun: number;
  cochera: number;
  baulera: number;
  calefaccion: number;
  quincho: number;
  ajuste: number;
  ajusteConcepto: string | null;
  total: number;
  saldoAnterior: number;
  totalPagado: number;
  saldoActual: number;
};

/**
 * Detalle en pantalla de cómo se compone una liquidación: es lo mismo que
 * muestra el PDF, para que el propietario entienda qué le cobraron sin
 * tener que bajarlo. Solo muestra los renglones que tienen importe.
 */
export default function DesgloseLiquidacion({
  cargo,
  reservas,
  totalMesAnterior,
}: {
  cargo: DesgloseCargo;
  reservas: ReservaDesglose[];
  totalMesAnterior: number | null;
}) {
  const detalleQuincho = reservas
    .map(
      (r) =>
        `${r.quinchoNombre} ${r.fecha.toLocaleDateString("es-AR", {
          timeZone: "UTC",
          day: "2-digit",
          month: "2-digit",
        })} ${r.turno === "MEDIODIA" ? "mediodía" : "noche"}`
    )
    .join(" · ");

  const renglones: { concepto: string; nota?: string; importe: number }[] = [
    { concepto: "Expensas comunes", nota: "Tu parte de los gastos del edificio", importe: cargo.gastoComun },
  ];
  if (cargo.cochera !== 0) renglones.push({ concepto: "Cochera", importe: cargo.cochera });
  if (cargo.baulera !== 0) renglones.push({ concepto: "Baulera", importe: cargo.baulera });
  if (cargo.calefaccion !== 0) {
    renglones.push({ concepto: "Calefacción / agua caliente", nota: "Según tu consumo", importe: cargo.calefaccion });
  }
  if (cargo.quincho !== 0) {
    renglones.push({ concepto: "Uso de quincho", nota: detalleQuincho || undefined, importe: cargo.quincho });
  }
  if (cargo.ajuste !== 0) {
    renglones.push({
      concepto: cargo.ajusteConcepto ? `Ajuste: ${cargo.ajusteConcepto}` : "Ajuste",
      importe: cargo.ajuste,
    });
  }

  let variacion: string | null = null;
  if (totalMesAnterior !== null && totalMesAnterior > 0) {
    const pct = ((cargo.total - totalMesAnterior) / totalMesAnterior) * 100;
    if (Math.abs(pct) < 0.5) variacion = "Similar al mes anterior";
    else variacion = `${pct > 0 ? "+" : "-"}${Math.abs(pct).toFixed(0)}% respecto del mes anterior`;
  }

  return (
    <div className="mt-3 text-sm">
      <table className="w-full">
        <tbody>
          {renglones.map((r) => (
            <tr key={r.concepto} className="align-top">
              <td className="py-1 pr-3">
                <span className="text-gray-700">{r.concepto}</span>
                {r.nota && <span className="block text-xs text-gray-400">{r.nota}</span>}
              </td>
              <td className="py-1 text-right whitespace-nowrap text-gray-700">{money(r.importe)}</td>
            </tr>
          ))}
          <tr className="border-t border-gray-200 align-top">
            <td className="py-1.5 pr-3 font-semibold text-gray-800">
              Total del mes
              {variacion && <span className="block text-xs font-normal text-gray-400">{variacion}</span>}
            </td>
            <td className="py-1.5 text-right whitespace-nowrap font-semibold text-gray-800">{money(cargo.total)}</td>
          </tr>
          <tr>
            <td className="py-1 pr-3 text-gray-500">
              {cargo.saldoAnterior < 0 ? "Saldo a favor anterior" : "Saldo anterior"}
            </td>
            <td className="py-1 text-right whitespace-nowrap text-gray-500">{money(cargo.saldoAnterior)}</td>
          </tr>
          <tr>
            <td className="py-1 pr-3 text-gray-500">Pagos recibidos</td>
            <td className="py-1 text-right whitespace-nowrap text-gray-500">
              {cargo.totalPagado > 0 ? money(-cargo.totalPagado) : money(0)}
            </td>
          </tr>
          <tr className="border-t border-gray-200">
            <td className="py-1.5 pr-3 font-semibold text-gray-800">Saldo a pagar</td>
            <td
              className={`py-1.5 text-right whitespace-nowrap font-bold ${
                cargo.saldoActual > 0 ? "text-red-600" : "text-brand-700"
              }`}
            >
              {money(cargo.saldoActual)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
