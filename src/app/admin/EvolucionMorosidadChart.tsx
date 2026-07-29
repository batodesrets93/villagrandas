import type { PuntoEvolucion } from "@/lib/dashboard";

function moneyCorto(n: number) {
  if (n >= 1_000_000) return "$ " + (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return "$ " + Math.round(n / 1000) + "k";
  return "$ " + Math.round(n);
}

/**
 * Gráfico de línea en SVG puro (sin librerías) con el total de deuda por
 * período. Server component: no necesita interactividad en el cliente.
 */
export default function EvolucionMorosidadChart({ datos }: { datos: PuntoEvolucion[] }) {
  if (datos.length < 2) {
    return (
      <p className="text-sm text-gray-500">
        Todavía no hay suficientes períodos liquidados para graficar una evolución.
      </p>
    );
  }

  const width = 560;
  const height = 240;
  const padLeft = 46;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const max = Math.max(...datos.map((d) => d.deudaTotal), 1);
  const min = 0; // siempre arranca en 0 para no exagerar visualmente las variaciones

  const x = (i: number) => padLeft + (i / (datos.length - 1)) * plotW;
  const y = (v: number) => padTop + plotH - ((v - min) / (max - min)) * plotH;

  const puntos = datos.map((d, i) => ({ ...d, cx: x(i), cy: y(d.deudaTotal) }));
  const linea = puntos.map((p) => `${p.cx},${p.cy}`).join(" ");
  const area = `${puntos[0].cx},${padTop + plotH} ${linea} ${puntos[puntos.length - 1].cx},${padTop + plotH}`;

  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => padTop + plotH * (1 - f));

  const primero = datos[0].deudaTotal;
  const ultimo = datos[datos.length - 1].deudaTotal;
  const variacion = primero > 0 ? Math.round(((ultimo - primero) / primero) * 100) : null;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Evolución de morosidad">
        {gridLines.map((gy, i) => (
          <line key={i} x1={padLeft} y1={gy} x2={width - padRight} y2={gy} stroke="#f3f4f6" strokeWidth={1} />
        ))}

        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <text key={i} x={padLeft - 6} y={gridLines[i] + 4} fontSize="10" fill="#9ca3af" textAnchor="end">
            {moneyCorto(max * f)}
          </text>
        ))}

        <polygon points={area} fill="#2f6b52" opacity={0.12} />
        <polyline points={linea} fill="none" stroke="#255943" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

        {puntos.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={i === puntos.length - 1 ? 5 : 4}
            fill="#1c4534"
            stroke={i === puntos.length - 1 ? "#fff" : "none"}
            strokeWidth={2}
          />
        ))}

        {puntos.map((p, i) => (
          <text
            key={i}
            x={p.cx}
            y={height - 10}
            fontSize="10"
            fill={i === puntos.length - 1 ? "#1c4534" : "#9ca3af"}
            fontWeight={i === puntos.length - 1 ? 700 : 400}
            textAnchor="middle"
          >
            {p.etiqueta}
          </text>
        ))}
      </svg>

      <div className="flex gap-6 mt-2 pt-3 border-t border-gray-100">
        {variacion !== null && (
          <div>
            <p className={`text-lg font-extrabold ${variacion > 0 ? "text-red-700" : "text-brand-700"}`}>
              {variacion > 0 ? "+" : ""}
              {variacion}%
            </p>
            <p className="text-xs text-gray-500">Variación vs. hace {datos.length - 1} períodos</p>
          </div>
        )}
        <div>
          <p className="text-lg font-extrabold text-brand-700">{moneyCorto(ultimo)}</p>
          <p className="text-xs text-gray-500">Deuda total, último período</p>
        </div>
      </div>
    </div>
  );
}
