'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, useState } from 'react'

import { formatCount, formatDateTime } from '@/lib/format'
import type { EventDto } from '@/lib/serialize'

interface Props {
  initial: EventDto[]
  nextCursor: string | null
  /** The current query string, without the cursor; appended to the API call. */
  query: string
  total: { count: number; capped: boolean }
}

const ROW = 40
const COLS = 'grid-cols-[10rem_9rem_1fr_6rem_4rem_4rem]'

/**
 * Only the rows in view are in the DOM. The list grows by fetching the next
 * keyset page when the last rendered row comes into view, so scrolling
 * through fifty thousand events costs the same per row as the first.
 */
export function EventsTable({ initial, nextCursor, query, total }: Props) {
  'use no memo'
  const [rows, setRows] = useState(initial)
  const [cursor, setCursor] = useState(nextCursor)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<EventDto | null>(null)
  const parent = useRef<HTMLDivElement>(null)
  /** The row that opened the drawer, so focus can go back to it. */
  const trigger = useRef<HTMLElement | null>(null)
  // The page keys this component on the query, so a new query remounts it.
  // This is the belt to that suspender: if it is ever rendered without the
  // key, a changed query still resets rows, cursor and selection.
  const [seenQuery, setSeenQuery] = useState(query)
  if (query !== seenQuery) {
    setSeenQuery(query)
    setRows(initial)
    setCursor(nextCursor)
    setError(null)
    setSelected(null)
  }

  // The React Compiler cannot memoize TanStack Virtual's instance; the directive above opts out.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length + (cursor ? 1 : 0),
    getScrollElement: () => parent.current,
    estimateSize: () => ROW,
    overscan: 10,
  })
  const items = virtualizer.getVirtualItems()
  const lastVisible = items[items.length - 1]?.index ?? -1

  // One request in flight at a time, tracked in a ref: the effect re-runs on
  // every scroll, and cancelling in its cleanup would drop the page that was
  // already on its way.
  const inflight = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    if (!cursor || inflight.current || lastVisible < rows.length - 1) return
    inflight.current = true
    fetch(`/api/events${query}${query ? '&' : '?'}cursor=${cursor}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`The server answered ${r.status}.`)
        return (await r.json()) as { rows: EventDto[]; nextCursor: string | null }
      })
      .then((page) => {
        if (!alive.current) return
        setRows((prev) => [...prev, ...page.rows])
        setCursor(page.nextCursor)
      })
      .catch((e: unknown) => {
        if (alive.current) setError(e instanceof Error ? e.message : 'Could not load more.')
      })
      .finally(() => {
        inflight.current = false
      })
  }, [cursor, lastVisible, rows.length, query])

  return (
    <div className="border-line bg-surface rounded-xl border">
      <div className="text-muted flex items-center justify-between px-4 py-2 text-xs">
        <span aria-live="polite">
          {formatCount(total.count)}
          {total.capped ? '+' : ''} matching · {formatCount(rows.length)} loaded
        </span>
        <a href={`/api/events/export${query}`} className="text-ink underline underline-offset-2">
          Export CSV
        </a>
      </div>
      <div role="grid" aria-rowcount={total.count} aria-label="Events" className="overflow-x-auto">
        <div className="min-w-[44rem]">
          <div
            role="row"
            className={`border-line text-muted grid ${COLS} border-y px-4 py-2 text-xs`}
          >
            {['Time', 'Event', 'Props', 'User', 'Plan', 'Country'].map((h) => (
              <span role="columnheader" key={h}>
                {h}
              </span>
            ))}
          </div>
          <div ref={parent} tabIndex={-1} className="overflow-auto" style={{ height: 560 }}>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {items.map((item) => {
                const row = rows[item.index]
                const style = {
                  position: 'absolute' as const,
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: item.size,
                  transform: `translateY(${item.start}px)`,
                }
                if (!row) {
                  return (
                    <div
                      key="more"
                      style={style}
                      role="row"
                      className="text-muted flex items-center px-4 text-xs"
                    >
                      {error ?? 'Loading more…'}
                    </div>
                  )
                }
                return (
                  <button
                    key={row.id}
                    type="button"
                    role="row"
                    aria-rowindex={item.index + 1}
                    style={style}
                    onClick={(e) => {
                      trigger.current = e.currentTarget
                      setSelected(row)
                    }}
                    className={`hover:bg-bg focus-visible:bg-bg grid ${COLS} items-center px-4 text-left text-sm`}
                  >
                    <span role="gridcell" className="tabular text-muted font-mono text-xs">
                      {formatDateTime(new Date(row.ts)).slice(0, 19)}
                    </span>
                    <span role="gridcell" className="font-mono text-xs">
                      {row.name}
                    </span>
                    <span role="gridcell" className="text-muted truncate font-mono text-xs">
                      {Object.entries(row.props)
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(' ')}
                    </span>
                    <span role="gridcell" className="text-muted truncate font-mono text-xs">
                      {row.userId}
                    </span>
                    <span role="gridcell" className="text-xs">
                      {row.plan}
                    </span>
                    <span role="gridcell" className="text-xs">
                      {row.country}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {selected && (
        <RowDrawer
          row={selected}
          onClose={() => {
            setSelected(null)
            // The row may have been virtualized away; fall back to the grid.
            const target = trigger.current?.isConnected ? trigger.current : parent.current
            target?.focus()
          }}
        />
      )}
    </div>
  )
}

/**
 * A native dialog: `showModal()` makes everything behind it inert, keeps Tab
 * inside, and closes on Escape on its own. The parent restores focus.
 */
function RowDrawer({ row, onClose }: { row: EventDto; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Depends on nothing that changes while open: focus is taken once, on open.
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (!el.open) el.showModal()
    closeRef.current?.focus()
  }, [])
  return (
    <dialog
      ref={dialog}
      aria-labelledby="row-title"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === dialog.current) onClose()
      }}
      className="bg-surface border-line text-ink fixed inset-y-0 right-0 left-auto m-0 flex h-dvh max-h-none w-full max-w-md flex-col gap-4 overflow-auto border-l p-5 shadow-2xl backdrop:bg-black/30"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="row-title" className="font-mono text-sm font-medium">
          {row.name} <span className="text-muted">#{row.id}</span>
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="text-muted hover:text-ink rounded px-2 text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
        <dt className="text-muted">Time</dt>
        <dd className="font-mono text-xs">{formatDateTime(new Date(row.ts))}</dd>
        <dt className="text-muted">User</dt>
        <dd className="font-mono text-xs">{row.userId}</dd>
        <dt className="text-muted">Session</dt>
        <dd className="font-mono text-xs">{row.sessionId}</dd>
        <dt className="text-muted">Plan</dt>
        <dd>{row.plan}</dd>
        <dt className="text-muted">Country</dt>
        <dd>{row.country}</dd>
      </dl>
      <div>
        <h3 className="text-muted mb-1 text-xs">Props</h3>
        <pre className="bg-bg overflow-auto rounded-md p-3 font-mono text-xs">
          {JSON.stringify(row.props, null, 2)}
        </pre>
      </div>
    </dialog>
  )
}
