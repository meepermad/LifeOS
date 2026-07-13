type BarChartProps = {
  data: Array<{ label: string; value: number }>;
  valueFormatter?: (value: number) => string;
  ariaLabel: string;
};

export function SimpleBarChart({
  data,
  valueFormatter = (v) => String(v),
  ariaLabel,
}: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div>
      <div
        className="flex items-end gap-2"
        role="img"
        aria-label={ariaLabel}
      >
        {data.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-accent/70"
              style={{ height: `${Math.max(4, (item.value / max) * 120)}px` }}
              title={`${item.label}: ${valueFormatter(item.value)}`}
            />
            <span className="truncate text-[10px] text-muted">{item.label}</span>
          </div>
        ))}
      </div>
      <table className="mt-3 w-full text-xs">
        <caption className="sr-only">{ariaLabel} data table</caption>
        <thead>
          <tr className="text-left text-muted">
            <th scope="col">Label</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{valueFormatter(item.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
