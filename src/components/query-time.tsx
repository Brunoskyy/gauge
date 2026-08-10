/** Shown in development only: how long each widget's SQL took. */
export function QueryTime({ entries }: { entries: Array<[string, number]> }) {
  if (process.env.NODE_ENV === 'production') return null
  return (
    <p className="text-muted mt-3 font-mono text-[11px]">
      {entries.map(([name, ms]) => `${name} ${ms}ms`).join(' · ')}
    </p>
  )
}
