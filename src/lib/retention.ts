export interface RetentionRow {
  cohort: Date
  weekNo: number
  users: number
}

export interface CohortSize {
  cohort: Date
  size: number
}

export interface RetentionMatrix {
  cohorts: Array<{
    cohort: Date
    size: number
    /**
     * Index = weeks since signup; null where the week has not happened yet.
     * `partial` marks the week that contains now: its ratio is still moving.
     */
    cells: Array<{ users: number; ratio: number; partial: boolean } | null>
  }>
  weeks: number
}

/**
 * Turns the long rows the SQL returns into a matrix: one line per signup
 * week, one cell per week since. A cell is null once it lies in the future
 * (a cohort from last week has no week-3 yet), which the heatmap renders as
 * empty rather than as zero retention.
 */
export function shapeRetention(
  rows: RetentionRow[],
  sizes: CohortSize[],
  now: Date,
): RetentionMatrix {
  const WEEK = 7 * 86_400_000
  const byCohort = new Map<number, Map<number, number>>()
  for (const r of rows) {
    const key = r.cohort.getTime()
    const m = byCohort.get(key) ?? new Map<number, number>()
    m.set(r.weekNo, r.users)
    byCohort.set(key, m)
  }
  const sorted = [...sizes].sort((a, b) => a.cohort.getTime() - b.cohort.getTime())
  const first = sorted[0]
  const weeks = first ? Math.floor((now.getTime() - first.cohort.getTime()) / WEEK) + 1 : 0
  const cohorts = sorted.map(({ cohort, size }) => {
    const m = byCohort.get(cohort.getTime())
    const elapsed = Math.floor((now.getTime() - cohort.getTime()) / WEEK)
    const cells: RetentionMatrix['cohorts'][number]['cells'] = []
    for (let w = 0; w < weeks; w += 1) {
      if (w > elapsed || size === 0) cells.push(null)
      else {
        const users = w === 0 ? size : (m?.get(w) ?? 0)
        cells.push({ users, ratio: users / size, partial: w === elapsed })
      }
    }
    return { cohort, size, cells }
  })
  return { cohorts, weeks }
}
