type Punto = { etiqueta: string; deuda: number };

function money(n: number) {
  return "$ " + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export default function MorosidadChart({ datos }: { datos: Punto[] }) {
  if (datos.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Todavía no hay suficientes períodos liquidados para mostrar la evolución.
      </p>
    );
  }

  const width = 640;
  const height = 240;
  const paddingBottom = 42;
  const paddingTop = 24;
  const barGap = 18;
  const barWidth = (width - barGap * (datos.length + 1)) / datos.length;
  const max = Math.max(...datos.map((d) => d.deuda), 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto text-brand-600"
      role="img"
      aria-label="Evolución de la deuda total por período"
    >
      {datos.map((d, i) => {
        const barHeight = ((height - paddingBottom - paddingTop) * d.deuda) / max;
        const x = barGap + i * (barWidth + barGap);
        const y = height - paddingBottom - barHeight;
        return (
          <g key={d.etiqueta}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} rx={4} fill="currentColor" />
            <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="#374151">
              {money(d.deuda)}
            </text>
            <text x={x + barWidth / 2} y={height - paddingBottom + 16} textAnchor="middle" fontSize="11" fill="#6b7280">
              {d.etiqueta}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
