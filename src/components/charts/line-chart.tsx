'use client'

import { bisector, max } from 'd3-array'
import { scaleLinear, scaleTime } from 'd3-scale'
import { area as d3Area, line as d3Line } from 'd3-shape'
import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { formatCount } from '@/lib/format'

import { useMeasure } from './use-measure'

export interface LinePoint {
  t: Date
  value: number
}

interface Props {
  points: LinePoint[]
  /** What one point is, for the tooltip and the table: "events", "users". */
  label: string
  bucket: 'hour' | 'day'
  height?: number
}

const M = { top: 12, right: 12, bottom: 28, left: 44 }

function formatTick(d: Date, bucket: 'hour' | 'day'): string {
  return bucket === 'hour'
    ? d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        timeZone: 'UTC',
      })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * One series over time: a thin line, a faint area, recessive grid, and a
 * crosshair tooltip you can reach with the pointer or the arrow keys. The
 * data is also in a visually hidden table for screen readers.
 */
export function LineChart({ points, label, bucket, height = 240 }: Props) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const id = useId()

  const innerW = Math.max(0, width - M.left - M.right)
  const innerH = height - M.top - M.bottom
  const first = points[0]
  const last = points[points.length - 1]
  const x = scaleTime()
    .domain([first?.t ?? new Date(0), last?.t ?? new Date(1)])
    .range([0, innerW])
  const y = scaleLinear()
    .domain([0, Math.max(1, max(points, (p) => p.value) ?? 1)])
    .nice()
    .range([innerH, 0])

  const path = d3Line<LinePoint>()
    .x((p) => x(p.t))
    .y((p) => y(p.value))
  const areaPath = d3Area<LinePoint>()
    .x((p) => x(p.t))
    .y0(innerH)
    .y1((p) => y(p.value))

  const bisect = bisector<LinePoint, Date>((p) => p.t).center
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left - M.left
    setActive(bisect(points, x.invert(px)))
  }
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (points.length === 0) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const delta = e.key === 'ArrowRight' ? 1 : -1
      setActive((a) =>
        Math.min(points.length - 1, Math.max(0, (a ?? (delta > 0 ? -1 : points.length)) + delta)),
      )
    }
    if (e.key === 'Home') setActive(0)
    if (e.key === 'End') setActive(points.length - 1)
    if (e.key === 'Escape') setActive(null)
  }

  const ticks = x.ticks(Math.max(2, Math.min(8, Math.floor(innerW / 90))))
  const yTicks = y.ticks(4)
  const current = active !== null ? points[active] : undefined
  const total = points.reduce((s, p) => s + p.value, 0)

  if (points.length === 0) {
    return (
      <div
        ref={ref}
        className="text-muted flex items-center justify-center text-sm"
        style={{ height }}
      >
        No data in this range.
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        tabIndex={0}
        className="block touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <title id={`${id}-title`}>{`${label} over time`}</title>
        <desc
          id={`${id}-desc`}
        >{`${formatCount(total)} ${label} across ${points.length} ${bucket}s. Use the arrow keys to move between points.`}</desc>
        <g transform={`translate(${M.left},${M.top})`}>
          {yTicks.map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line x1={0} x2={innerW} stroke="var(--line)" />
              <text
                x={-8}
                dy="0.32em"
                textAnchor="end"
                fontSize={11}
                fill="var(--muted)"
                className="tabular"
              >
                {formatCount(t)}
              </text>
            </g>
          ))}
          {ticks.map((t) => (
            <text
              key={+t}
              x={x(t)}
              y={innerH + 18}
              textAnchor="middle"
              fontSize={11}
              fill="var(--muted)"
            >
              {formatTick(t, bucket)}
            </text>
          ))}
          <path d={areaPath(points) ?? ''} fill="var(--series-1)" fillOpacity={0.12} />
          <path
            d={path(points) ?? ''}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {current && (
            <g transform={`translate(${x(current.t)},0)`}>
              <line y1={0} y2={innerH} stroke="var(--muted)" strokeDasharray="3 3" />
              <circle
                cy={y(current.value)}
                r={4.5}
                fill="var(--series-1)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          )}
        </g>
      </svg>
      {current && (
        <div
          role="status"
          className="bg-ink text-bg pointer-events-none absolute top-2 rounded-md px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: Math.min(Math.max(0, M.left + x(current.t) - 60), Math.max(0, width - 140)),
          }}
        >
          <div className="opacity-70">{formatTick(current.t, bucket)}</div>
          <div className="tabular font-medium">
            {formatCount(current.value)} {label}
          </div>
        </div>
      )}
      <table className="sr-only">
        <caption>{`${label} per ${bucket}`}</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">{label}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={+p.t}>
              <td>{formatTick(p.t, bucket)}</td>
              <td>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
