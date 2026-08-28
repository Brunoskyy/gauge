import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { EventDto } from '@/lib/serialize'

import { EventsTable } from '../events-table'

const dto = (id: number, name = 'shared'): EventDto => ({
  id: String(id),
  ts: new Date(1_700_000_000_000 + id).toISOString(),
  name,
  userId: 'u1',
  sessionId: 's1',
  plan: 'free',
  country: 'BR',
  props: { channel: 'link' },
})

beforeAll(() => {
  // jsdom has no layout, so the virtualizer sees a zero-height viewport; give it one.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 560 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 560 })
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

describe('EventsTable', () => {
  it('drops the old rows and cursor when the query changes', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    const props = { total: { count: 2, capped: false } }
    const { rerender } = render(
      <EventsTable {...props} initial={[dto(1), dto(2)]} nextCursor="1_2" query="?range=30d" />,
    )
    expect(screen.getByText(/2 loaded/)).toBeInTheDocument()
    const before = fetchSpy.mock.calls.length
    rerender(
      <EventsTable
        {...props}
        initial={[dto(9, 'signup')]}
        nextCursor={null}
        query="?range=7d"
        total={{ count: 1, capped: false }}
      />,
    )
    expect(screen.getByText(/1 loaded/)).toBeInTheDocument()
    expect(screen.queryByText('shared')).toBeNull()
    expect(screen.getByText('signup')).toBeInTheDocument()
    // No fetch with the 30d cursor went out for the 7d query.
    for (const call of fetchSpy.mock.calls.slice(before)) {
      expect(String(call[0])).not.toContain('cursor=1_2')
    }
    fetchSpy.mockRestore()
  })

  it('opens the details in a modal dialog and gives focus back to the row on close', async () => {
    const user = userEvent.setup()
    render(
      <EventsTable
        initial={[dto(1)]}
        nextCursor={null}
        query=""
        total={{ count: 1, capped: false }}
      />,
    )
    const row = screen.getByRole('row', { name: /shared/ })
    row.focus()
    await user.keyboard('{Enter}')
    const dialog = screen.getByRole('dialog', { name: /shared/ })
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(row).toHaveFocus()
  })
})
