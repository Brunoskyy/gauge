import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BarChart } from '../bar-chart'
import { FunnelChart } from '../funnel-chart'
import { Heatmap } from '../heatmap'
import { LineChart } from '../line-chart'

// jsdom has no layout; give the charts a width to draw with.
class RO {
  observe() {}
  disconnect() {}
}
globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver
Element.prototype.getBoundingClientRect = () => ({
  width: 600,
  height: 240,
  top: 0,
  left: 0,
  right: 600,
  bottom: 240,
  x: 0,
  y: 0,
  toJSON: () => ({}),
})

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n))

describe('LineChart', () => {
  const points = [
    { t: day(0), value: 10 },
    { t: day(1), value: 30 },
    { t: day(2), value: 20 },
  ]

  it('says so when there is nothing to draw', () => {
    render(<LineChart points={[]} label="events" bucket="day" />)
    expect(screen.getByText('No data in this range.')).toBeInTheDocument()
  })

  it('has a title, a description and a table for screen readers', () => {
    render(<LineChart points={points} label="events" bucket="day" />)
    const svg = screen.getByRole('img', { name: 'events over time' })
    expect(svg).toHaveAccessibleDescription(/60 events across 3 days/)
    const table = screen.getByRole('table', { name: 'events per day' })
    expect(table).toHaveClass('sr-only')
    expect(screen.getAllByRole('row')).toHaveLength(4)
  })

  it('moves the tooltip with the arrow keys and clears it on Escape', () => {
    render(<LineChart points={points} label="events" bucket="day" />)
    const svg = screen.getByRole('img', { name: 'events over time' })
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.keyDown(svg, { key: 'ArrowRight' })
    expect(screen.getByRole('status')).toHaveTextContent('10 events')
    fireEvent.keyDown(svg, { key: 'ArrowRight' })
    expect(screen.getByRole('status')).toHaveTextContent('30 events')
    fireEvent.keyDown(svg, { key: 'End' })
    expect(screen.getByRole('status')).toHaveTextContent('20 events')
    fireEvent.keyDown(svg, { key: 'ArrowRight' })
    expect(screen.getByRole('status')).toHaveTextContent('20 events')
    fireEvent.keyDown(svg, { key: 'Escape' })
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('BarChart', () => {
  it('renders one labeled bar per row and a hidden table', () => {
    render(
      <BarChart
        bars={[
          { key: 'BR', value: 1200, secondary: 40 },
          { key: 'US', value: 300 },
        ]}
        label="events"
        secondaryLabel="users"
      />,
    )
    expect(screen.getByRole('img', { name: 'events by category' })).toBeInTheDocument()
    expect(
      screen.getByText('BR: 1,200 events, 40 users', { selector: 'title' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'events by category' })).toBeInTheDocument()
  })

  it('handles an empty list', () => {
    render(<BarChart bars={[]} label="events" />)
    expect(screen.getByText('No data in this range.')).toBeInTheDocument()
  })
})

describe('Heatmap', () => {
  it('is a table with a percentage per known cell and an empty cell for the future', () => {
    render(
      <Heatmap
        matrix={{
          weeks: 3,
          cohorts: [
            {
              cohort: day(0),
              size: 50,
              cells: [
                { users: 50, ratio: 1, partial: false },
                { users: 20, ratio: 0.4, partial: false },
                null,
              ],
            },
          ],
        }}
      />,
    )
    expect(screen.getByRole('table', { name: /retention/i })).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByLabelText('Not yet')).toBeInTheDocument()
    expect(screen.getByTitle('20 of 50 users active 1 week later')).toBeInTheDocument()
  })

  it('marks the week in progress as partial, in the title and for screen readers', () => {
    render(
      <Heatmap
        matrix={{
          weeks: 2,
          cohorts: [
            {
              cohort: day(0),
              size: 50,
              cells: [
                { users: 50, ratio: 1, partial: false },
                { users: 5, ratio: 0.1, partial: true },
              ],
            },
          ],
        }}
      />,
    )
    expect(screen.getByTitle(/week still in progress/)).toHaveTextContent('10%')
    expect(screen.getByText(/week in progress/)).toBeInTheDocument()
  })

  it('handles no cohorts', () => {
    render(<Heatmap matrix={{ weeks: 0, cohorts: [] }} />)
    expect(screen.getByText('No signups in this range.')).toBeInTheDocument()
  })
})

describe('FunnelChart', () => {
  it('labels each step with users, share and drop-off', () => {
    render(
      <FunnelChart
        steps={[
          { name: 'signup', users: 1000, ofFirst: 1, ofPrevious: 1 },
          { name: 'shared', users: 250, ofFirst: 0.25, ofPrevious: 0.25 },
        ]}
      />,
    )
    expect(
      screen.getByRole('img', { name: '250 users, 25.0% of the first step' }),
    ).toBeInTheDocument()
    expect(screen.getByText('−75% from previous')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
