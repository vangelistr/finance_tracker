import { allocate } from '@/lib/money';

/** Percentages (one decimal) that always add up to exactly 100.0 (largest remainder). */
export function percentages(values: number[]): string[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => '0');
  return allocate(1000, values).map((p) => (p / 10).toFixed(1));
}

/**
 * A visually hidden table with the chart's numbers, for screen readers and for tests. The wrapper carries `sr-only`:
 * a table grows to fit its rows whatever height it is given, so hiding the table itself would stretch the page.
 */
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A rounded axis maximum (1, 2, 2.5, 5 × 10^n) at or above the largest value. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  for (const step of [1, 2, 2.5, 5, 10]) if (step * base >= value) return step * base;
  return 10 * base;
}
