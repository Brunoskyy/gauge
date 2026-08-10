import type { EventRow } from './queries/events'

/** JSON has no bigint and no Date; the wire shape is strings for both. */
export interface EventDto {
  id: string
  name: string
  userId: string
  sessionId: string
  ts: string
  props: Record<string, unknown>
  plan: string
  country: string
}

export function toDto(r: EventRow): EventDto {
  return { ...r, id: r.id.toString(), ts: r.ts.toISOString() }
}
