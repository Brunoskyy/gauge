export interface Timed<T> {
  data: T
  /** Wall-clock milliseconds the query took, shown in development. */
  ms: number
}

export async function timed<T>(run: () => Promise<T>): Promise<Timed<T>> {
  const started = performance.now()
  const data = await run()
  return { data, ms: Math.round(performance.now() - started) }
}
