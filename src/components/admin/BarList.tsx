/**
 * Horizontal bar list for one series of counts (e.g. leads per service).
 * Single hue, values printed beside every bar so nothing depends on color,
 * bars start from a shared baseline with a rounded data end.
 */
export function BarList({ items, label }: { items: { label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul aria-label={label} className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(8rem,12rem)_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate text-charcoal-800" title={i.label}>{i.label}</span>
          <span className="h-2 rounded-e-full bg-charcoal-100" aria-hidden="true">
            <span className="block h-2 rounded-e-full bg-charcoal-700" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="text-end font-semibold tabular-nums text-charcoal-900">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}
