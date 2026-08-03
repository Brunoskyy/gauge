import { makeRng, type Rng } from './random'

export type Plan = 'free' | 'team' | 'business'

export interface SeedUser {
  id: string
  plan: Plan
  country: string
  signedUpAt: Date
}

export interface SeedEvent {
  name: string
  userId: string
  sessionId: string
  ts: Date
  props: Record<string, string | number | boolean>
}

export interface GenerateOptions {
  seed?: number
  users?: number
  /** The window ends here; events span the `days` before it. */
  now?: Date
  days?: number
}

export const EVENT_NAMES = [
  'signup',
  'app_opened',
  'project_created',
  'note_created',
  'note_edited',
  'shared',
  'search',
  'export',
  'invite_sent',
  'upgrade_viewed',
] as const

/** Country, weight, and the UTC offset used to shape the hour-of-day curve. */
const COUNTRIES: Array<[string, number, number]> = [
  ['BR', 30, -3],
  ['US', 25, -5],
  ['DE', 10, 1],
  ['PT', 8, 0],
  ['MX', 7, -6],
  ['IN', 7, 5.5],
  ['GB', 7, 0],
  ['CA', 6, -5],
]

const PLANS: Array<[Plan, number]> = [
  ['free', 70],
  ['team', 22],
  ['business', 8],
]

const DAY = 86_400_000

/**
 * Deterministic demo data with the shape real product data has: signups
 * that grow over the window, weekday and daytime peaks in the user's zone,
 * a funnel (signup, project_created, note_created, shared) that leaks at each
 * step, paying plans that stay around longer, and users who churn.
 *
 * Around 5,000 users and 300,000 events for the defaults.
 */
export function generate(options: GenerateOptions = {}): {
  users: SeedUser[]
  events: SeedEvent[]
} {
  const rng = makeRng(options.seed ?? 20260930)
  const userCount = options.users ?? 5000
  const days = options.days ?? 90
  const now = options.now ?? new Date()
  const end = now.getTime()
  const start = end - days * DAY

  const users: SeedUser[] = []
  const events: SeedEvent[] = []

  for (let i = 0; i < userCount; i += 1) {
    const country = rng.weighted(COUNTRIES.map(([c, w]) => [c, w] as [string, number]))
    const offset = COUNTRIES.find(([c]) => c === country)![2]
    const plan = rng.weighted(PLANS)
    // Signups ramp up: later days get more of them.
    const dayOffset = Math.floor(days * Math.sqrt(rng.next()))
    const signupDay = start + dayOffset * DAY
    const signedUpAt = new Date(
      signupDay + hourInZone(rng, offset) * 3_600_000 + rng.int(0, 3_599_999),
    )
    if (signedUpAt.getTime() >= end) continue
    const user: SeedUser = { id: `u_${rng.id(10)}`, plan, country, signedUpAt }
    users.push(user)
    generateJourney(rng, user, offset, end, events)
  }

  events.sort((a, b) => a.ts.getTime() - b.ts.getTime())
  return { users, events }
}

/** Hour of day in UTC for a person in `offset`, peaking in their working day. */
function hourInZone(rng: Rng, offset: number): number {
  const local = Math.min(23, Math.max(0, Math.round(rng.normal(14, 4))))
  return (((local - offset) % 24) + 24) % 24
}

function generateJourney(
  rng: Rng,
  user: SeedUser,
  offset: number,
  end: number,
  out: SeedEvent[],
): void {
  const stickiness = user.plan === 'business' ? 0.7 : user.plan === 'team' ? 0.55 : 0.3
  const churnAfterDays = user.plan === 'free' ? rng.int(1, 40) : rng.int(20, 200)
  const source = rng.weighted([
    ['web', 70],
    ['mobile', 25],
    ['api', 5],
  ] as Array<[string, number]>)

  const first = user.signedUpAt.getTime()
  const firstSession = `s_${rng.id(10)}`
  out.push({
    name: 'signup',
    userId: user.id,
    sessionId: firstSession,
    ts: new Date(first),
    props: { source, plan: user.plan },
  })
  out.push({
    name: 'app_opened',
    userId: user.id,
    sessionId: firstSession,
    ts: new Date(first + rng.int(1000, 60_000)),
    props: { source },
  })

  // The funnel, mostly inside the first session.
  const madeProject = rng.chance(user.plan === 'free' ? 0.62 : 0.85)
  let t = first + rng.int(60_000, 900_000)
  if (madeProject) {
    out.push({
      name: 'project_created',
      userId: user.id,
      sessionId: firstSession,
      ts: new Date(t),
      props: { source, template: rng.pick(['blank', 'meeting', 'roadmap', 'wiki']) },
    })
    t += rng.int(30_000, 600_000)
    if (rng.chance(0.8)) {
      out.push({
        name: 'note_created',
        userId: user.id,
        sessionId: firstSession,
        ts: new Date(t),
        props: { source, words: rng.int(20, 800) },
      })
      t += rng.int(30_000, 900_000)
      if (rng.chance(user.plan === 'free' ? 0.3 : 0.55)) {
        out.push({
          name: 'shared',
          userId: user.id,
          sessionId: firstSession,
          ts: new Date(t),
          props: { source, channel: rng.pick(['link', 'email', 'slack']) },
        })
      }
    }
  }

  // Later days: come back with a probability that decays after churn.
  const lastDay = Math.min(end, first + churnAfterDays * DAY)
  for (let day = first + DAY; day < lastDay; day += DAY) {
    const weekday = new Date(day).getUTCDay()
    const weekend = weekday === 0 || weekday === 6
    const p = stickiness * (weekend ? 0.35 : 1)
    if (!rng.chance(p)) continue
    const sessions = rng.chance(0.25) ? 2 : 1
    for (let s = 0; s < sessions; s += 1) {
      const sessionId = `s_${rng.id(10)}`
      let ts = day + hourInZone(rng, offset) * 3_600_000 + rng.int(0, 3_599_999)
      if (ts >= end) break
      out.push({
        name: 'app_opened',
        userId: user.id,
        sessionId,
        ts: new Date(ts),
        props: { source },
      })
      const actions = rng.int(2, user.plan === 'free' ? 7 : 12)
      for (let a = 0; a < actions; a += 1) {
        ts += rng.int(15_000, 400_000)
        if (ts >= end) break
        const name = rng.weighted([
          ['note_created', 30],
          ['note_edited', 35],
          ['search', 15],
          ['shared', user.plan === 'free' ? 5 : 12],
          ['export', 4],
          ['invite_sent', user.plan === 'free' ? 1 : 5],
          ['upgrade_viewed', user.plan === 'free' ? 6 : 1],
          ['project_created', 3],
        ] as Array<[string, number]>)
        const props: SeedEvent['props'] = { source }
        if (name === 'note_created') props.words = rng.int(10, 1200)
        if (name === 'shared') props.channel = rng.pick(['link', 'email', 'slack'])
        if (name === 'search') props.results = rng.int(0, 40)
        if (name === 'export') props.format = rng.pick(['pdf', 'md'])
        if (name === 'project_created')
          props.template = rng.pick(['blank', 'meeting', 'roadmap', 'wiki'])
        out.push({ name, userId: user.id, sessionId, ts: new Date(ts), props })
      }
    }
  }
}
