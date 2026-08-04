const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('en-US')

export function formatCount(n: number): string {
  return n >= 10_000 ? compact.format(n) : plain.format(n)
}

export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return '–'
  return `${(ratio * 100).toFixed(digits)}%`
}

/** Change between two values as a ratio; null when there is nothing to compare against. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return (current - previous) / previous
}

export function formatDelta(d: number | null): string {
  if (d === null) return 'new'
  const sign = d > 0 ? '+' : ''
  return `${sign}${(d * 100).toFixed(1)}%`
}

export function formatUtcDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function formatDateTime(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}
