import type { ReactNode } from 'react'

export function Card({
  title,
  children,
  aside,
}: {
  title: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="border-line bg-surface rounded-xl border p-4 sm:p-5" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Skeleton({ height = 240 }: { height?: number }) {
  return (
    <div aria-hidden="true" className="bg-line/50 animate-pulse rounded-md" style={{ height }} />
  )
}
