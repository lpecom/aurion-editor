interface DataPoint {
  label: string;
  values: number[];
}

interface ChartProps {
  data: DataPoint[];
  series: { name: string; color: string }[];
  height?: number;
}

export default function AnalyticsChart({ data, series, height = 200 }: ChartProps) {
  if (!data.length) return <div className="text-gray-400 text-sm text-center py-8">Sem dados para o período</div>;

  const W = 600;
  const H = height;
  const PAD = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allValues = data.flatMap(d => d.values);
  const maxVal = Math.max(...allValues, 1);

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;

  function toPath(seriesIdx: number) {
    return data.map((d, i) => {
      const x = PAD.left + (data.length > 1 ? i * xStep : chartW / 2);
      const y = PAD.top + chartH - (d.values[seriesIdx] / maxVal) * chartH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  }

  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round(maxVal * (1 - i / 4)));
  const step = Math.max(1, Math.floor(data.length / 7));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 400 }}>
        {yTicks.map((v, i) => {
          const y = PAD.top + (i / 4) * chartH;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize={11}>{v}</text>
            </g>
          );
        })}
        {series.map((s, si) => (
          <path key={si} d={toPath(si)} fill="none" stroke={s.color} strokeWidth={2} />
        ))}
        {series.map((s, si) =>
          data.map((d, i) => {
            const x = PAD.left + (data.length > 1 ? i * xStep : chartW / 2);
            const y = PAD.top + chartH - (d.values[si] / maxVal) * chartH;
            return <circle key={`${si}-${i}`} cx={x} cy={y} r={3} fill={s.color} />;
          })
        )}
        {xLabels.map((d) => {
          const origIdx = data.indexOf(d);
          const x = PAD.left + (data.length > 1 ? origIdx * xStep : chartW / 2);
          return (
            <text key={origIdx} x={x} y={H - 5} textAnchor="middle" fill="#9ca3af" fontSize={10}>
              {d.label}
            </text>
          );
        })}
      </svg>
      <div className="flex gap-4 justify-center mt-2">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-1 text-xs text-gray-500">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
