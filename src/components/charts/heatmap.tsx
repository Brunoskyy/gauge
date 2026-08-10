import { formatCount, formatPercent, formatUtcDay } from '@/lib/format'
import type { RetentionMatrix } from '@/lib/retention'

/** Sequential blue, light for low retention, dark for high; text flips to keep contrast. */
function cellStyle(ratio: number): { background: string; color: string } {
  const steps = [
    '--seq-100',
    '--seq-200',
    '--seq-300',
    '--seq-400',
    '--seq-500',
    '--seq-600',
    '--seq-700',
  ]
  const i = Math.min(steps.length - 1, Math.floor(ratio * steps.length))
  return { background: `var(${steps[i]})`, color: i >= 3 ? '#ffffff' : '#0d366b' }
}

/**
 * The retention grid is a real table: cohorts as rows, weeks since signup as
 * columns, a percentage in every cell. Color is a second reading of the
 * same number, not the only one.
 */
export function Heatmap({ matrix }: { matrix: RetentionMatrix }) {
  if (matrix.cohorts.length === 0) {
    return <p className="text-muted py-10 text-center text-sm">No signups in this range.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full border-separate border-spacing-0.5 text-xs">
        <caption className="sr-only">Weekly retention by signup cohort</caption>
        <thead>
          <tr>
            <th scope="col" className="text-muted py-1 pr-3 text-left font-normal">
              Cohort
            </th>
            <th scope="col" className="text-muted py-1 pr-3 text-right font-normal">
              Users
            </th>
            {Array.from({ length: matrix.weeks }, (_, w) => (
              <th key={w} scope="col" className="text-muted min-w-12 py-1 text-center font-normal">
                {w === 0 ? 'Week 0' : `+${w}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.cohorts.map((c) => (
            <tr key={+c.cohort}>
              <th scope="row" className="py-1 pr-3 text-left font-normal whitespace-nowrap">
                {formatUtcDay(c.cohort)}
              </th>
              <td className="text-muted py-1 pr-3 text-right">{formatCount(c.size)}</td>
              {c.cells.map((cell, w) =>
                cell ? (
                  <td
                    key={w}
                    className="rounded-sm px-1 py-1.5 text-center"
                    style={cellStyle(cell.ratio)}
                    title={`${cell.users} of ${c.size} users active ${w === 0 ? 'in week 0' : `${w} week${w === 1 ? '' : 's'} later`}`}
                  >
                    {formatPercent(cell.ratio, 0)}
                  </td>
                ) : (
                  <td key={w} className="bg-line/40 rounded-sm" aria-label="Not yet" />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
