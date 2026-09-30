type Punto = { etiqueta: string; deuda: number; cobrado: number };

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

// Formato corto para el eje: $ 1,2 M / $ 850 k
function moneyCorto(n: number) {
  if (n >= 1_000_000) return "$ " + (n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " M";
  if (n >= 1_000) return "$ " + Math.round(n / 1_000).toLocaleString("es-AR") + " k";
  return "$ " + Math.round(n).toLocaleString("es-AR");
}

// Redondea el maximo del eje a un valor "lindo" (1, 2, 2.5, 5 x 10^n)
function techo(n: number) {
  if (n <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  for (const m of [1, 2, 2.5, 5, 10]) if (n <= m * exp) return m * exp;
  return 10 * exp;
}

const COLOR_DEUDA = "#b91c1c"; // rojo
const COLOR_COBRADO = "#2f6b52"; // brand-500

export default function MorosidadChart({ datos }: { datos: Punto[] }) {
  if (datos.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Todavía no hay suficientes períodos liquidados para mostrar la evolución.
      </p>
    );
  }

  const width = 640;
  const height = 260;
  const padLeft = 56;
  const padRight = 12;
  const padTop = 22;
  const padBottom = 36;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const max = techo(Math.max(...datos.map((d) => Math.max(d.deuda, d.cobrado)), 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const slot = plotW / datos.length;
  const barW = Math.min(44, (slot * 0.7) / 2);
  const gap = 6;
  const y = (v: number) => padTop + plotH - (plotH * v) / max;

  return (
    <div>
      <div className="flex gap-4 text-xs text-gray-600 mb-2">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: COLOR_DEUDA }} /> Deuda al cierre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: COLOR_COBRADO }} /> Cobrado en el período
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label="Deuda al cierre y cobranza por período"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padLeft} x2={width - padRight} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeDasharray={t === 0 ? undefined : "3 3"} />
            <text x={padLeft - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
              {moneyCorto(t)}
            </text>
          </g>
        ))}

        {datos.map((d, i) => {
          const cx = padLeft + slot * i + slot / 2;
          const barras = [
            { v: d.deuda, color: COLOR_DEUDA, x: cx - gap / 2 - barW, nombre: "Deuda" },
            { v: d.cobrado, color: COLOR_COBRADO, x: cx + gap / 2, nombre: "Cobrado" },
          ];
          return (
            <g key={d.etiqueta}>
              {barras.map((b) => {
                const h = Math.max(padTop + plotH - y(b.v), b.v > 0 ? 2 : 0);
                return (
                  <g key={b.nombre}>
                    <rect x={b.x} y={padTop + plotH - h} width={barW} height={h} rx={3} fill={b.color}>
                      <title>{`${d.etiqueta} · ${b.nombre}: ${money(b.v)}`}</title>
                    </rect>
                    <text x={b.x + barW / 2} y={padTop + plotH - h - 5} textAnchor="middle" fontSize="10" fill="#374151">
                      {moneyCorto(b.v)}
                    </text>
                  </g>
                );
              })}
              <text x={cx} y={height - padBottom + 18} textAnchor="middle" fontSize="11" fill="#6b7280">
                {d.etiqueta}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
