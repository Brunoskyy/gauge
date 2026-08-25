'use client'

import { useEffect } from 'react'

/**
 * One widget failing (a query the database refuses, a connection that
 * dropped) lands here instead of on Next's default page, with the URL kept
 * so the filters can be adjusted.
 */
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="border-line bg-surface mx-auto my-16 max-w-md rounded-xl border p-6 text-sm">
      <h1 className="text-lg font-semibold">This view could not be built.</h1>
      <p className="text-muted mt-2">
        The database refused one of the queries. Try a shorter range or different filters.
      </p>
      <p className="text-muted mt-2 font-mono text-xs break-words">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="border-line hover:bg-bg mt-4 rounded-md border px-3 py-1.5"
      >
        Try again
      </button>
    </div>
  )
}
