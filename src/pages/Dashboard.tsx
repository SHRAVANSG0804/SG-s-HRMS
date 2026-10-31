import { CalendarCheck2, CalendarClock, CalendarDays, CheckCircle2, Clock, PartyPopper, UserCheck, Users, Wallet } from 'lucide-react'
import { Legend, HBars, Ring, StackedBars, type SeriesKey, type StackDatum } from '../components/charts'
import { Avatar, Badge, Button, Card, Empty, PageHeader, StatCard, useToast } from '../components/ui'
import type { Page } from '../lib/chatbot'
import { addDays, fmtDate, fmtDay, fmtMonth, monthOf, todayIST } from '../lib/date'
import { LEAVE_NAMES, STATUS_META, allBalances, attendanceSummary, inr, isWorkingDay, monthRange, payslip, scopeEmployees } from '../lib/rules'
import { useStore } from '../lib/store'
import type { Employee, HRMSData } from '../lib/types'

const KEYS: SeriesKey[] = ['present', 'wfh', 'half_day', 'absent', 'leave']

export function trendData(pool: Employee[], data: HRMSData, today: string, n = 14): StackDatum[] {
  const days: string[] = []
  for (let d = today; days.length < n; d = addDays(d, -1)) if (isWorkingDay(d, data.holidays)) days.unshift(d)
  const ids = new Set(pool.map((e) => e.id))
  return days.map((d) => {
    const values: StackDatum['values'] = {}
    for (const a of data.attendance) {
      if (a.date !== d || !ids.has(a.employeeId) || a.status === 'holiday') continue
      const k = a.status as SeriesKey
      values[k] = (values[k] ?? 0) + 1
    }
    return { label: fmtDate(d, { day: 'numeric', month: 'short' }).replace(' ', ' '), sub: fmtDay(d), values }
  })
}

function PendingList({ setPage }: { setPage: (p: Page) => void }) {
  const { data, session, decideLeave } = useStore()
  const toast = useToast()
  const pool = new Set(scopeEmployees(session!, data.employees).map((e) => e.id))
  const pending = data.leaves.filter((l) => l.status === 'pending' && pool.has(l.employeeId) && l.employeeId !== session!.employeeId)
  const name = (id: string) => data.employees.find((e) => e.id === id)!
  return (
    <Card title="Pending approvals" subtitle={`${pending.length} waiting for you`} action={<Button size="sm" variant="secondary" onClick={() => setPage('leave')}>View all</Button>}>
      {pending.length === 0 ? (
        <Empty icon={<CheckCircle2 size={22} />} title="All caught up" text="No leave requests are waiting for approval." />
      ) : (
        <ul className="divide-y divide-line">
          {pending.slice(0, 5).map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-5 py-3.5">
              <Avatar name={name(l.employeeId).name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{name(l.employeeId).name}</p>
                <p className="truncate text-xs text-muted">
                  {l.type} · {fmtDate(l.from, { day: 'numeric', month: 'short' })}
                  {l.to !== l.from && ` – ${fmtDate(l.to, { day: 'numeric', month: 'short' })}`} · {l.days}d · {l.reason}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => { const r = decideLeave(l.id, 'rejected'); toast(r.ok ? 'Leave rejected' : r.error, r.ok ? 'ok' : 'bad') }}>Reject</Button>
                <Button size="sm" variant="success" onClick={() => { const r = decideLeave(l.id, 'approved'); toast(r.ok ? 'Leave approved' : r.error, r.ok ? 'ok' : 'bad') }}>Approve</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Holidays() {
  const { data } = useStore()
  const today = todayIST()
  const next = data.holidays.filter((h) => h.date >= today).slice(0, 4)
  return (
    <Card title="Upcoming holidays">
      {next.length === 0 ? (
        <Empty icon={<PartyPopper size={22} />} title="No upcoming holidays" />
      ) : (
        <ul className="divide-y divide-line">
          {next.map((h) => (
            <li key={h.date} className="flex items-center gap-3 px-5 py-3">
              <span className="grid w-11 shrink-0 place-items-center rounded-xl bg-teal-soft py-1.5 text-teal">
                <span className="text-[10px] font-semibold uppercase">{fmtDate(h.date, { month: 'short' })}</span>
                <span className="font-display text-lg leading-none font-semibold">{fmtDate(h.date, { day: 'numeric' })}</span>
              </span>
              <div>
                <p className="text-sm font-semibold">{h.name}</p>
                <p className="text-xs text-muted">{fmtDate(h.date, { weekday: 'long' })}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function TeamDashboard({ setPage }: { setPage: (p: Page) => void }) {
  const { data, session, me } = useStore()
  const today = todayIST()
  const isHR = session!.role === 'hr'
  const pool = scopeEmployees(session!, data.employees).filter((e) => e.active)
  const ids = new Set(pool.map((e) => e.id))
  const todays = data.attendance.filter((a) => a.date === today && ids.has(a.employeeId))
  const count = (s: string) => todays.filter((a) => a.status === s).length
  const working = isWorkingDay(today, data.holidays)
  const pendingCount = data.leaves.filter((l) => l.status === 'pending' && ids.has(l.employeeId) && l.employeeId !== session!.employeeId).length
  const [from, to] = monthRange(monthOf(today), today)
  const rates = pool.map((e) => attendanceSummary(e.id, from, to, data.attendance, data.holidays).rate)
  const avgRate = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 10) / 10 : 0

  const deptCounts = [...pool.reduce((m, e) => m.set(e.department, (m.get(e.department) ?? 0) + 1), new Map<string, number>())]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
  const unmarked = working ? pool.length - todays.length : 0

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${me!.name.split(' ')[0]}`}
        subtitle={isHR ? 'Here is what is happening across the company today.' : `Here is how your team of ${pool.length} is doing today.`}
        actions={<Button onClick={() => setPage('attendance')}><CalendarCheck2 size={16} /> Mark attendance</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={isHR ? 'Active employees' : 'Team members'} value={pool.length} hint={isHR ? `${new Set(pool.map((e) => e.department)).size} departments` : me!.department} icon={<Users size={18} />} tone="info" />
        <StatCard label="Present today" value={working ? count('present') + count('wfh') + count('half_day') : '—'} hint={working ? `${count('wfh')} WFH · ${count('half_day')} half day` : 'Not a working day'} icon={<UserCheck size={18} />} tone="ok" />
        <StatCard label="Absent / on leave" value={working ? `${count('absent')} / ${count('leave')}` : '—'} hint={unmarked ? `${unmarked} not marked yet` : 'All marked'} icon={<CalendarClock size={18} />} tone={unmarked ? 'warn' : 'neutral'} />
        <StatCard label="Pending approvals" value={pendingCount} hint={`Avg attendance ${avgRate}% this month`} icon={<Clock size={18} />} tone="brand" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Attendance trend" subtitle="Last 14 working days" action={<Legend keys={KEYS} />}>
          <div className="px-5 pt-6 pb-2">
            <StackedBars data={trendData(pool, data, today)} keys={KEYS} />
          </div>
        </Card>
        {isHR ? (
          <Card title="Headcount by department" subtitle="Active employees">
            <div className="p-5">
              <HBars data={deptCounts} />
            </div>
          </Card>
        ) : (
          <TodayTeam pool={pool} />
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PendingList setPage={setPage} />
        </div>
        <Holidays />
      </div>
    </>
  )
}

function TodayTeam({ pool }: { pool: Employee[] }) {
  const { data } = useStore()
  const today = todayIST()
  const rec = new Map(data.attendance.filter((a) => a.date === today).map((a) => [a.employeeId, a.status]))
  return (
    <Card title="Team today" subtitle={fmtDay(today)}>
      <ul className="divide-y divide-line">
        {pool.map((e) => {
          const s = rec.get(e.id)
          return (
            <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
              <Avatar name={e.name} size="sm" />
              <span className="flex-1 truncate text-sm">{e.name}</span>
              {s ? <Badge tone={STATUS_META[s].tone}>{STATUS_META[s].label}</Badge> : <Badge>Not marked</Badge>}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function EmployeeDashboard({ setPage }: { setPage: (p: Page) => void }) {
  const { data, me } = useStore()
  const today = todayIST()
  const month = monthOf(today)
  const [from, to] = monthRange(month, today)
  const sum = attendanceSummary(me!.id, from, to, data.attendance, data.holidays)
  const bal = allBalances(me!.id, data.leaves, today.slice(0, 4))
  const todayRec = data.attendance.find((a) => a.employeeId === me!.id && a.date === today)
  const slip = payslip(me!, month, data.attendance, data.holidays)
  const manager = data.employees.find((e) => e.id === me!.managerId)
  const recent = data.leaves.filter((l) => l.employeeId === me!.id).slice(-4).reverse()
  const LEAVE_TONE = { pending: 'warn', approved: 'ok', rejected: 'bad', cancelled: 'neutral' } as const

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${me!.name.split(' ')[0]}`}
        subtitle={`${me!.designation} · ${me!.department}${manager ? ` · Reports to ${manager.name}` : ''}`}
        actions={<Button onClick={() => setPage('leave')}><CalendarDays size={16} /> Apply for leave</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today"
          value={todayRec ? STATUS_META[todayRec.status].label : isWorkingDay(today, data.holidays) ? 'Not marked' : 'Day off'}
          hint={todayRec?.checkIn ? `In ${todayRec.checkIn}${todayRec.checkOut ? ` · Out ${todayRec.checkOut}` : ''}` : 'Marked by your manager or HR'}
          icon={<CalendarCheck2 size={18} />}
          tone={todayRec ? STATUS_META[todayRec.status].tone : 'neutral'}
        />
        <StatCard label="Days present" value={sum.effective} hint={`of ${sum.workingDays} working days in ${fmtMonth(month)}`} icon={<UserCheck size={18} />} tone="ok" />
        <StatCard label="Leave available" value={bal.reduce((s, b) => s + b.available, 0)} hint={bal.map((b) => `${b.type} ${b.available}`).join(' · ')} icon={<CalendarDays size={18} />} tone="plum" />
        <StatCard label="Net pay (est.)" value={inr(slip.net)} hint={`${fmtMonth(month)} · LOP ${slip.lopDays} day(s)`} icon={<Wallet size={18} />} tone="brand" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="This month" subtitle={fmtMonth(month)}>
          <div className="flex items-center gap-6 p-5">
            <Ring value={sum.rate} label="Attendance rate" />
            <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[['Present', sum.present], ['WFH', sum.wfh], ['Half day', sum.halfDay], ['Absent', sum.absent], ['Leave', sum.leave], ['Unmarked', sum.unmarked]].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
        <Card title="Leave balance" subtitle={`Year ${today.slice(0, 4)}`}>
          <div className="space-y-4 p-5">
            {bal.map((b) => (
              <div key={b.type}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium">{LEAVE_NAMES[b.type]}</span>
                  <span className="text-muted"><strong className="text-ink">{b.available}</strong> / {b.quota}</span>
                </div>
                <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-soft">
                  <div className="bg-plum" style={{ width: `${(b.used / b.quota) * 100}%` }} title={`${b.used} used`} />
                  <div className="bg-warn/60" style={{ width: `${(b.pending / b.quota) * 100}%` }} title={`${b.pending} pending`} />
                </div>
                <p className="mt-1 text-[11px] text-muted">{b.used} used · {b.pending} pending</p>
              </div>
            ))}
          </div>
        </Card>
        <Holidays />
      </div>

      <Card className="mt-6" title="My recent leave requests" action={<Button size="sm" variant="secondary" onClick={() => setPage('leave')}>View all</Button>}>
        {recent.length === 0 ? (
          <Empty icon={<CalendarDays size={22} />} title="No leave requests yet" />
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((l) => (
              <li key={l.id} className="flex items-center gap-4 px-5 py-3">
                <Badge tone="plum">{l.type}</Badge>
                <span className="flex-1 text-sm">{fmtDate(l.from)}{l.to !== l.from && ` – ${fmtDate(l.to)}`} · {l.days} day(s)</span>
                <Badge tone={LEAVE_TONE[l.status]}>{l.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date()))
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

export function Dashboard({ setPage }: { setPage: (p: Page) => void }) {
  const { session } = useStore()
  return session?.role === 'employee' ? <EmployeeDashboard setPage={setPage} /> : <TeamDashboard setPage={setPage} />
}
