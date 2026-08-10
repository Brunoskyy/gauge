'use client'

import { max } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { useId, useState } from 'react'

import { formatCount } from '@/lib/format'

import { useMeasure } from './use-measure'

export interface Bar {
  key: string
  value: number
  /** A second number for the tooltip, e.g. distinct users. */
  secondary?: number
}

interface Props {
  bars: Bar[]
  label: string
  secondaryLabel?: string
  rowHeight?: number
}

const LABEL_W = 88

/**
 * Horizontal bars, longest first, values written at the end of each bar so
 * nobody has to read a scale. One hue, because these are all the same
 * measure across categories.
 */
export function BarChart({ bars, label, secondaryLabel, rowHeight = 28 }: Props) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const id = useId()
  const innerW = Math.max(0, width - LABEL_W - 64)
  const x = scaleLinear()
    .domain([0, Math.max(1, max(bars, (b) => b.value) ?? 1)])
    .range([0, innerW])
  const height = bars.length * rowHeight

  if (bars.length === 0) {
    return (
      <div ref={ref} className="text-muted py-10 text-center text-sm">
        No data in this range.
      </div>
    )
  }

  return (
    <div ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-labelledby={`${id}-title`}
        className="block"
      >
        <title id={`${id}-title`}>{`${label} by category`}</title>
        {bars.map((b, i) => {
          const y = i * rowHeight
          const w = Math.max(2, x(b.value))
          return (
            <g
              key={b.key}
              transform={`translate(0,${y})`}
              tabIndex={0}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              className="outline-none"
            >
              <title>{`${b.key}: ${formatCount(b.value)} ${label}${b.secondary !== undefined ? `, ${formatCount(b.secondary)} ${secondaryLabel ?? ''}` : ''}`}</title>
              <rect
                x={0}
                y={0}
                width={width}
                height={rowHeight}
                fill={active === i ? 'var(--line)' : 'transparent'}
                rx={4}
              />
              <text
                x={LABEL_W - 10}
                y={rowHeight / 2}
                dy="0.32em"
                textAnchor="end"
                fontSize={12}
                fill="var(--ink)"
              >
                {b.key}
              </text>
              <rect
                x={LABEL_W}
                y={rowHeight / 2 - 7}
                width={w}
                height={14}
                rx={3}
                fill="var(--series-1)"
              />
              <text
                x={LABEL_W + w + 8}
                y={rowHeight / 2}
                dy="0.32em"
                fontSize={12}
                fill="var(--muted)"
                className="tabular"
              >
                {formatCount(b.value)}
              </text>
            </g>
          )
        })}
      </svg>
      <table className="sr-only">
        <caption>{label} by category</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">{label}</th>
            {secondaryLabel && <th scope="col">{secondaryLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <td>{b.key}</td>
              <td>{b.value}</td>
              {secondaryLabel && <td>{b.secondary}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
