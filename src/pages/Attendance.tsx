import { CalendarX2, ChevronLeft, ChevronRight, Download, Info, Save, Search, UserCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Avatar, Badge, Button, Card, Empty, Input, PageHeader, Select, Tabs, cx, useToast } from '../components/ui'
import { downloadCSV } from '../lib/csv'
import { addDays, addMonths, daysInMonth, fmtDate, fmtDay, fmtMonth, hoursBetween, isSunday, monthOf, todayIST, weekday } from '../lib/date'
import { STATUS_META, attendanceSummary, isHoliday, monthRange, scopeEmployees } from '../lib/rules'
import { useStore, type AttendanceInput } from '../lib/store'
import type { AttendanceStatus, Employee } from '../lib/types'

const code = (s: AttendanceStatus) => (s === 'wfh' ? 'W' : STATUS_META[s].short)
const MARKABLE: AttendanceStatus[] = ['present', 'wfh', 'half_day', 'absent', 'leave']
const ACTIVE_BTN: Record<string, string> = {
  present: 'bg-ok text-white border-ok',
  wfh: 'bg-info text-white border-info',
  half_day: 'bg-warn text-white border-warn',
  absent: 'bg-bad text-white border-bad',
  leave: 'bg-plum text-white border-plum',
  holiday: 'bg-teal text-white border-teal',
}
const CELL: Record<AttendanceStatus, string> = {
  present: 'bg-ok-soft text-ok',
  wfh: 'bg-info-soft text-info',
  half_day: 'bg-warn-soft text-warn',
  absent: 'bg-bad-soft text-bad',
  leave: 'bg-plum-soft text-plum',
  holiday: 'bg-teal-soft text-teal',
}

type Draft = { status?: AttendanceStatus; checkIn: string; checkOut: string; remarks: string; dirty: boolean }

function MarkSheet() {
  const { data, session, saveAttendance, clearAttendance } = useStore()
  const toast = useToast()
  const today = todayIST()
  const [date, setDate] = useState(today)
  const [dept, setDept] = useState('')
  const [q, setQ] = useState('')
  const pool = useMemo(() => scopeEmployees(session!, data.employees).filter((e) => e.active && e.joinDate <= date), [session, data.employees, date])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})

  // Load saved records into the sheet whenever the date (or saved data) changes.
  useEffect(() => {
    const next: Record<string, Draft> = {}
    for (const e of pool) {
      const r = data.attendance.find((a) => a.employeeId === e.id && a.date === date)
      next[e.id] = { status: r?.status, checkIn: r?.checkIn ?? '', checkOut: r?.checkOut ?? '', remarks: r?.remarks ?? '', dirty: false }
    }
    setDrafts(next)
  }, [date, data.attendance, pool])

  const holiday = isHoliday(date, data.holidays)
  const offDay = isSunday(date) || !!holiday
  const depts = [...new Set(pool.map((e) => e.department))].sort()
  const shown = pool.filter((e) => (!dept || e.department === dept) && (!q || `${e.name} ${e.code}`.toLowerCase().includes(q.toLowerCase())))
  const dirtyCount = Object.values(drafts).filter((d) => d.dirty).length
  const markedCount = pool.filter((e) => drafts[e.id]?.status).length

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => {
      const cur = d[id]
      const next = { ...cur, ...patch, dirty: true }
      // Sensible default times when marking someone in.
      if (patch.status && (patch.status === 'present' || patch.status === 'wfh') && !cur.checkIn) Object.assign(next, { checkIn: '09:00', checkOut: date < today ? '18:00' : '' })
      if (patch.status === 'half_day' && !cur.checkIn) Object.assign(next, { checkIn: '09:00', checkOut: date < today ? '13:00' : '' })
      if (patch.status === 'absent' || patch.status === 'leave' || patch.status === 'holiday') Object.assign(next, { checkIn: '', checkOut: '' })
      return { ...d, [id]: next }
    })

  const markAllUnmarked = (status: AttendanceStatus) => {
    for (const e of shown) if (!drafts[e.id]?.status) update(e.id, { status })
  }

  const save = () => {
    const rows: AttendanceInput[] = Object.entries(drafts)
      .filter(([, d]) => d.dirty && d.status)
      .map(([employeeId, d]) => ({
        employeeId, date, status: d.status!, checkIn: d.checkIn || undefined, checkOut: d.checkOut || undefined, remarks: d.remarks.trim() || undefined,
      }))
    if (!rows.length) return toast('Nothing to save — choose a status first.', 'bad')
    const r = saveAttendance(rows)
    toast(r.ok ? `Attendance saved for ${rows.length} employee(s)` : r.error, r.ok ? 'ok' : 'bad')
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft size={16} /></Button>
          <Input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-8 w-40" aria-label="Date" />
          <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day"><ChevronRight size={16} /></Button>
          {date !== today && <Button variant="ghost" size="sm" onClick={() => setDate(today)}>Today</Button>}
        </div>
        {session!.role === 'hr' && (
          <Select value={dept} onChange={(e) => setDept(e.target.value)} className="h-8 w-44 text-xs" aria-label="Department">
            <option value="">All departments</option>
            {depts.map((d) => <option key={d}>{d}</option>)}
          </Select>
        )}
        <div className="relative">
          <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or code" className="h-8 w-48 pl-8 text-xs" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted">{markedCount}/{pool.length} marked</span>
          <Button size="sm" variant="secondary" onClick={() => markAllUnmarked(offDay ? 'holiday' : 'present')}>
            <UserCheck size={14} /> Mark unmarked {offDay ? 'holiday' : 'present'}
          </Button>
          <Button size="sm" onClick={save} disabled={!dirtyCount}>
            <Save size={14} /> Save{dirtyCount ? ` (${dirtyCount})` : ''}
          </Button>
        </div>
      </div>
      {offDay && (
        <div className="flex items-center gap-2 border-b border-line bg-teal-soft/60 px-5 py-2.5 text-sm text-teal">
          <Info size={15} /> {fmtDay(date)} is {holiday ? `a holiday (${holiday.name})` : 'a Sunday'}. You can still record anyone who worked.
        </div>
      )}
      {shown.length === 0 ? (
        <Empty icon={<CalendarX2 size={22} />} title="No employees to show" text="Try a different filter or date." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-muted">
                <th className="px-5 py-2.5">Employee</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Check-in</th>
                <th className="px-3 py-2.5">Check-out</th>
                <th className="px-3 py-2.5">Hours</th>
                <th className="px-3 py-2.5">Remarks</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((e) => {
                const d = drafts[e.id]
                if (!d) return null
                const timed = d.status === 'present' || d.status === 'wfh' || d.status === 'half_day'
                return (
                  <tr key={e.id} className={cx(d.dirty && 'bg-brand-soft/30')}>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={e.name} size="sm" />
                        <div>
                          <p className="font-semibold">{e.name}</p>
                          <p className="text-xs text-muted">{e.code} · {e.designation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1" role="radiogroup" aria-label={`Status for ${e.name}`}>
                        {(offDay ? [...MARKABLE, 'holiday' as AttendanceStatus] : MARKABLE).map((s) => (
                          <button
                            key={s}
                            role="radio"
                            aria-checked={d.status === s}
                            title={STATUS_META[s].label}
                            onClick={() => update(e.id, { status: s })}
                            className={cx(
                              'h-8 min-w-9 rounded-lg border px-2 text-xs font-bold transition-colors cursor-pointer',
                              d.status === s ? ACTIVE_BTN[s] : 'border-line bg-white text-muted hover:border-ink/40 hover:text-ink',
                            )}
                          >
                            {s === 'wfh' ? 'WFH' : STATUS_META[s].short}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Input type="time" value={d.checkIn} disabled={!timed} onChange={(ev) => update(e.id, { checkIn: ev.target.value })} className="h-8 w-28 text-xs" aria-label="Check-in" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input type="time" value={d.checkOut} disabled={!timed} onChange={(ev) => update(e.id, { checkOut: ev.target.value })} className="h-8 w-28 text-xs" aria-label="Check-out" />
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-muted">{timed && d.checkIn && d.checkOut ? `${hoursBetween(d.checkIn, d.checkOut).toFixed(1)}h` : '—'}</td>
                    <td className="px-3 py-2.5">
                      <Input value={d.remarks} onChange={(ev) => update(e.id, { remarks: ev.target.value })} placeholder="Optional" className="h-8 w-40 text-xs" aria-label="Remarks" />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {d.status && !d.dirty && (
                        <button
                          className="text-xs font-semibold text-muted hover:text-bad cursor-pointer"
                          onClick={() => {
                            if (!confirm(`Clear attendance for ${e.name} on ${fmtDate(date)}?`)) return
                            const r = clearAttendance(e.id, date)
                            toast(r.ok ? 'Attendance cleared' : r.error, r.ok ? 'ok' : 'bad')
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function Register({ employees, title }: { employees: Employee[]; title?: string }) {
  const { data } = useStore()
  const today = todayIST()
  const [month, setMonth] = useState(monthOf(today))
  const days = daysInMonth(month)
  const recs = useMemo(() => {
    const m = new Map<string, AttendanceStatus>()
    for (const a of data.attendance) if (a.date.startsWith(month)) m.set(`${a.employeeId}|${a.date}`, a.status)
    return m
  }, [data.attendance, month])
  const [from, to] = monthRange(month, today)

  const exportCSV = () => {
    const header = ['Code', 'Name', 'Department', ...days.map((d) => d.slice(8)), 'Present', 'WFH', 'Half day', 'Absent', 'Leave', 'Attendance %']
    const rows = employees.map((e) => {
      const s = attendanceSummary(e.id, from, to, data.attendance, data.holidays)
      return [e.code, e.name, e.department, ...days.map((d) => { const st = recs.get(`${e.id}|${d}`); return st ? code(st) : '' }), s.present, s.wfh, s.halfDay, s.absent, s.leave, s.rate]
    })
    downloadCSV(`attendance-${month}.csv`, [header, ...rows])
  }

  return (
    <Card
      title={title ?? 'Monthly register'}
      subtitle={fmtMonth(month)}
      action={
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={16} /></Button>
          <Button variant="secondary" size="sm" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= monthOf(today)} aria-label="Next month"><ChevronRight size={16} /></Button>
          <Button variant="secondary" size="sm" onClick={exportCSV}><Download size={14} /> CSV</Button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line bg-canvas text-muted">
              <th className="sticky left-0 z-10 bg-canvas px-4 py-2 text-left font-semibold">Employee</th>
              {days.map((d) => (
                <th key={d} className={cx('w-8 px-0.5 py-2 text-center font-medium', (isSunday(d) || isHoliday(d, data.holidays)) && 'text-teal')}>
                  <div>{'SMTWTFS'[weekday(d)]}</div>
                  <div className="font-semibold text-ink-2">{Number(d.slice(8))}</div>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {employees.map((e) => {
              const s = attendanceSummary(e.id, from, to, data.attendance, data.holidays)
              return (
                <tr key={e.id}>
                  <td className="sticky left-0 z-10 bg-white px-4 py-1.5 font-semibold whitespace-nowrap">{e.name}</td>
                  {days.map((d) => {
                    const st = recs.get(`${e.id}|${d}`)
                    const off = isSunday(d) || isHoliday(d, data.holidays)
                    return (
                      <td key={d} className="px-0.5 py-1.5 text-center">
                        {st ? (
                          <span title={`${fmtDay(d)}: ${STATUS_META[st].label}`} className={cx('inline-grid size-6 place-items-center rounded-md text-[10px] font-bold', CELL[st])}>
                            {code(st)}
                          </span>
                        ) : (
                          <span className={cx('inline-block size-6 rounded-md', off ? 'bg-soft' : d <= today ? 'border border-dashed border-line' : '')} title={off ? 'Off day' : d <= today ? 'Not marked' : ''} />
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{s.rate}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-line px-5 py-3">
        {(['present', 'wfh', 'half_day', 'absent', 'leave', 'holiday'] as AttendanceStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <span className={cx('inline-grid size-5 place-items-center rounded text-[9px] font-bold', CELL[s])}>{code(s)}</span>
            {STATUS_META[s].label}
          </span>
        ))}
      </div>
    </Card>
  )
}

function MyAttendance() {
  const { data, me } = useStore()
  const today = todayIST()
  const [month, setMonth] = useState(monthOf(today))
  const days = daysInMonth(month)
  const lead = weekday(days[0])
  const mine = new Map(data.attendance.filter((a) => a.employeeId === me!.id && a.date.startsWith(month)).map((a) => [a.date, a]))
  const [from, to] = monthRange(month, today)
  const s = attendanceSummary(me!.id, from, to, data.attendance, data.holidays)
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card
        title={fmtMonth(month)}
        subtitle="Your attendance is marked by your manager or HR"
        action={
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={16} /></Button>
            <Button variant="secondary" size="sm" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= monthOf(today)} aria-label="Next month"><ChevronRight size={16} /></Button>
          </div>
        }
      >
        <div className="grid grid-cols-7 gap-2 p-5">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="pb-1 text-center text-xs font-semibold text-muted">{d}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`x${i}`} />)}
          {days.map((d) => {
            const r = mine.get(d)
            const h = isHoliday(d, data.holidays)
            return (
              <div key={d} className={cx('min-h-20 rounded-xl border p-2', d === today ? 'border-ink' : 'border-line', r ? CELL[r.status] : isSunday(d) || h ? 'bg-soft' : 'bg-white')}>
                <p className="text-xs font-bold">{Number(d.slice(8))}</p>
                {r ? (
                  <>
                    <p className="mt-1 text-[11px] font-semibold">{STATUS_META[r.status].label}</p>
                    {r.checkIn && <p className="text-[10px] opacity-80">{r.checkIn}–{r.checkOut ?? '…'}</p>}
                  </>
                ) : h ? (
                  <p className="mt-1 text-[11px] text-teal">{h.name}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      </Card>
      <Card title="Summary" subtitle={month === monthOf(today) ? 'Month to date' : fmtMonth(month)}>
        <dl className="divide-y divide-line">
          {[
            ['Working days', s.workingDays], ['Present', s.present], ['Work from home', s.wfh], ['Half day', s.halfDay],
            ['Absent', s.absent], ['On leave', s.leave], ['Not marked', s.unmarked],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between px-5 py-2.5 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm font-semibold">Attendance rate</dt>
            <dd><Badge tone={s.rate >= 90 ? 'ok' : s.rate >= 75 ? 'warn' : 'bad'}>{s.rate}%</Badge></dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}

export function Attendance() {
  const { session, data } = useStore()
  const [tab, setTab] = useState<'mark' | 'register'>('mark')
  if (session!.role === 'employee') {
    return (
      <>
        <PageHeader title="My Attendance" subtitle="Your day-by-day attendance record." />
        <MyAttendance />
      </>
    )
  }
  const pool = scopeEmployees(session!, data.employees).filter((e) => e.active)
  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={session!.role === 'hr' ? 'Mark daily attendance manually for any employee.' : 'Mark daily attendance for your team.'}
        actions={<Tabs value={tab} onChange={setTab} items={[{ value: 'mark', label: 'Mark attendance' }, { value: 'register', label: 'Monthly register' }]} />}
      />
      {tab === 'mark' ? <MarkSheet /> : <Register employees={pool} />}
    </>
  )
}
