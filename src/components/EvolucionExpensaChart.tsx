import type { EvolucionExpensa } from "@/lib/evolucionExpensa";

function moneyCorto(n: number) {
  if (n >= 1_000_000) return "$ " + (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return "$ " + Math.round(n / 1000) + "k";
  return "$ " + Math.round(n);
}

function moneyEntero(n: number) {
  return "$ " + Math.round(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

/** 4.26 -> "+4,3%"; -2 -> "-2,0%"; ~0 -> "0%". */
function porcentajeConSigno(v: number) {
  if (Math.abs(v) < 0.05) return "0%";
  return (v > 0 ? "+" : "-") + Math.abs(v).toFixed(1).replace(".", ",") + "%";
}

/** "Septiembre/2026" -> "Sep/26". Si la etiqueta tiene otro formato, la deja como está. */
function etiquetaCorta(etiqueta: string) {
  const m = etiqueta.trim().match(/^(\p{L}+)\D*(\d{2}|\d{4})$/u);
  if (!m) return etiqueta;
  return `${m[1].slice(0, 3)}/${m[2].slice(-2)}`;
}

/**
 * Gráfico de línea (SVG puro, sin librerías) con lo que le liquidaron a la
 * unidad cada mes, la variación porcentual respecto del mes anterior debajo de
 * cada mes, y una explicación corta cuando el último mes subió.
 * Server component: no necesita interactividad en el cliente.
 */
export default function EvolucionExpensaChart({ evolucion }: { evolucion: EvolucionExpensa }) {
  const { puntos: datos, explicacion } = evolucion;
  if (datos.length < 2) return null;

  const width = 560;
  const height = 256;
  const padLeft = 46;
  const padRight = 24;
  const padTop = 28;
  const padBottom = 50;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Siempre arranca en 0 para no exagerar visualmente las variaciones; el 10%
  // de aire arriba deja lugar para la etiqueta del último punto.
  const max = Math.max(...datos.map((d) => d.total), 1) * 1.1;

  const x = (i: number) => padLeft + (i / (datos.length - 1)) * plotW;
  const y = (v: number) => padTop + plotH - (v / max) * plotH;

  const puntos = datos.map((d, i) => {
    const anterior = i > 0 ? datos[i - 1].total : 0;
    const variacion = i > 0 && anterior > 0 ? ((d.total - anterior) / anterior) * 100 : null;
    return { ...d, cx: x(i), cy: y(d.total), variacion };
  });
  const linea = puntos.map((p) => `${p.cx},${p.cy}`).join(" ");
  const area = `${puntos[0].cx},${padTop + plotH} ${linea} ${puntos[puntos.length - 1].cx},${padTop + plotH}`;

  const fracciones = [0.25, 0.5, 0.75, 1];
  const gridLines = fracciones.map((f) => padTop + plotH * (1 - f));

  // Con muchos meses se muestra una etiqueta de por medio (siempre la última).
  const paso = datos.length > 6 ? 2 : 1;
  const mostrarEtiqueta = (i: number) => (datos.length - 1 - i) % paso === 0;

  const colorVariacion = (v: number) => (Math.abs(v) < 0.05 ? "#6b7280" : v > 0 ? "#b91c1c" : "#15803d");

  const ultimo = puntos[puntos.length - 1];
  const primero = datos[0].total;
  const variacionTotal = primero > 0 ? Math.round(((ultimo.total - primero) / primero) * 100) : null;

  return (
    <div className="card">
      <h2 className="font-semibold">Evolución de tu expensa</h2>
      <p className="text-xs text-gray-400 mb-3">
        Lo que se te liquidó en cada uno de los últimos {datos.length} meses. Debajo de cada mes, la variación
        respecto del mes anterior.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Evolución de tu expensa en los últimos ${datos.length} meses, con la variación respecto del mes anterior`}
      >
        {gridLines.map((gy, i) => (
          <line key={i} x1={padLeft} y1={gy} x2={width - padRight} y2={gy} stroke="#f3f4f6" strokeWidth={1} />
        ))}

        {fracciones.map((f, i) => (
          <text key={i} x={padLeft - 6} y={gridLines[i] + 4} fontSize="10" fill="#9ca3af" textAnchor="end">
            {moneyCorto(max * f)}
          </text>
        ))}

        <polygon points={area} fill="#2f6b52" opacity={0.12} />
        <polyline points={linea} fill="none" stroke="#255943" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

        {puntos.map((p, i) => (
          <circle
            key={p.cargoId}
            cx={p.cx}
            cy={p.cy}
            r={i === puntos.length - 1 ? 5 : 4}
            fill="#1c4534"
            stroke={i === puntos.length - 1 ? "#fff" : "none"}
            strokeWidth={2}
          >
            <title>
              {`${p.etiqueta}: ${moneyEntero(p.total)}` +
                (p.variacion !== null ? ` (${porcentajeConSigno(p.variacion)} vs. mes anterior)` : "")}
            </title>
          </circle>
        ))}

        {/* Monto de cada mes arriba del punto (con muchos meses, uno de por medio y siempre el último). */}
        {puntos.map((p, i) =>
          mostrarEtiqueta(i) ? (
            <text
              key={`monto-${p.cargoId}`}
              x={p.cx}
              y={p.cy - 11}
              fontSize="11"
              fontWeight={i === puntos.length - 1 ? 700 : 500}
              fill={i === puntos.length - 1 ? "#1c4534" : "#4b5563"}
              textAnchor={i === 0 ? "start" : i === puntos.length - 1 ? "end" : "middle"}
            >
              {moneyEntero(p.total)}
            </text>
          ) : null
        )}

        {puntos.map((p, i) =>
          mostrarEtiqueta(i) ? (
            <text
              key={p.cargoId}
              x={p.cx}
              y={height - 27}
              fontSize="10"
              fill={i === puntos.length - 1 ? "#1c4534" : "#9ca3af"}
              fontWeight={i === puntos.length - 1 ? 700 : 400}
              textAnchor="middle"
            >
              {etiquetaCorta(p.etiqueta)}
            </text>
          ) : null
        )}

        {/* Variación respecto del mes anterior, en todos los meses menos el primero. */}
        {puntos.map((p) =>
          p.variacion !== null ? (
            <text
              key={`var-${p.cargoId}`}
              x={p.cx}
              y={height - 10}
              fontSize="10"
              fontWeight={700}
              fill={colorVariacion(p.variacion)}
              textAnchor="middle"
            >
              {porcentajeConSigno(p.variacion)}
            </text>
          ) : null
        )}
      </svg>

      {variacionTotal !== null && (
        <div className="flex gap-6 mt-2 pt-3 border-t border-gray-100">
          <div>
            <p className={`text-lg font-extrabold ${variacionTotal > 0 ? "text-red-700" : "text-brand-700"}`}>
              {variacionTotal > 0 ? "+" : ""}
              {variacionTotal}%
            </p>
            <p className="text-xs text-gray-500">
              Variación en {datos.length - 1} {datos.length - 1 === 1 ? "mes" : "meses"}
            </p>
          </div>
          <div>
            <p className="text-lg font-extrabold text-brand-700">{moneyEntero(ultimo.total)}</p>
            <p className="text-xs text-gray-500">Última liquidación</p>
          </div>
        </div>
      )}

      {explicacion && (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-800">
            Tu expensa de {explicacion.etiquetaActual} subió {Math.round(explicacion.porcentaje)}% (
            {moneyEntero(explicacion.diferencia)} más) respecto de {explicacion.etiquetaAnterior}.
          </p>
          {explicacion.motivos.length > 0 && (
            <>
              <p className="text-xs text-amber-700 mt-1.5">Lo que más pesó:</p>
              <ul className="mt-1 space-y-0.5 text-gray-700">
                {explicacion.motivos.map((m) => (
                  <li key={m.concepto} className="flex items-start justify-between gap-3">
                    <span>
                      {m.concepto}
                      {m.detalle && <span className="block text-xs text-gray-500">{m.detalle}</span>}
                    </span>
                    <span className="whitespace-nowrap">+{moneyEntero(m.importe)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
