'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const LINKS = [
  ['/', 'Overview'],
  ['/events', 'Events'],
  ['/retention', 'Retention'],
  ['/funnels', 'Funnels'],
] as const

/** The date range travels between pages; the page-specific filters do not. */
export function Nav() {
  const pathname = usePathname()
  const params = useSearchParams()
  const keep = new URLSearchParams()
  for (const k of ['range', 'from', 'to']) {
    const v = params.get(k)
    if (v) keep.set(k, v)
  }
  const qs = keep.toString() ? `?${keep}` : ''

  return (
    <header className="border-line bg-surface border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href={`/${qs}`} className="flex items-center gap-2 font-semibold">
          <span aria-hidden="true" className="bg-accent inline-block h-3 w-3 rounded-sm" />
          Gauge
        </Link>
        <nav aria-label="Pages">
          <ul className="flex flex-wrap gap-1 text-sm">
            {LINKS.map(([href, label]) => {
              const active = pathname === href
              return (
                <li key={href}>
                  <Link
                    href={`${href}${qs}`}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-md px-2.5 py-1.5 ${active ? 'bg-bg text-ink font-medium' : 'text-muted hover:text-ink'}`}
                  >
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <span className="text-muted ml-auto hidden font-mono text-xs sm:block">
          Northwind Notes
        </span>
      </div>
    </header>
  )
}
