import { formatCount, formatPercent } from '@/lib/format'
import type { FunnelStep } from '@/lib/funnel'

/**
 * Each step is a bar sized to its share of the first step, with the drop-off
 * from the previous step written between them. Plain HTML: it reads in
 * order, wraps on a phone, and needs no measuring.
 */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={s.name} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-3 text-sm">
          <span className="font-mono text-xs">{s.name}</span>
          <div className="bg-line/50 relative h-8 rounded-md">
            <div
              className="h-full rounded-md"
              style={{ width: `${Math.max(0.5, s.ofFirst * 100)}%`, background: 'var(--series-1)' }}
              role="img"
              aria-label={`${formatCount(s.users)} users, ${formatPercent(s.ofFirst)} of the first step`}
            />
            {i > 0 && s.ofPrevious < 1 && (
              <span className="text-muted absolute top-1/2 right-2 -translate-y-1/2 text-xs">
                −{formatPercent(1 - s.ofPrevious, 0)} from previous
              </span>
            )}
          </div>
          <span className="tabular text-right">
            <span className="font-medium">{formatCount(s.users)}</span>
            <span className="text-muted block text-xs">{formatPercent(s.ofFirst)}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
