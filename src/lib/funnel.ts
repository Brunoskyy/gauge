export interface FunnelStep {
  name: string
  users: number
  /** Share of the first step. */
  ofFirst: number
  /** Share of the previous step. */
  ofPrevious: number
}

export function shapeFunnel(steps: string[], counts: number[]): FunnelStep[] {
  const first = counts[0] ?? 0
  return steps.map((name, i) => {
    const users = counts[i] ?? 0
    const prev = i === 0 ? users : (counts[i - 1] ?? 0)
    return {
      name,
      users,
      ofFirst: first === 0 ? 0 : users / first,
      ofPrevious: i === 0 ? 1 : prev === 0 ? 0 : users / prev,
    }
  })
}
