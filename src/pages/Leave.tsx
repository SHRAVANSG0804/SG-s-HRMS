import { CalendarDays, CalendarPlus, Check, PartyPopper, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, useToast } from '../components/ui'
import { fmtDate, todayIST } from '../lib/date'
import { LEAVE_NAMES, allBalances, leaveBalance, leaveDays, scopeEmployees } from '../lib/rules'
import { useStore } from '../lib/store'
import type { LeaveRequest, LeaveStatus, LeaveType } from '../lib/types'

const STATUS_TONE: Record<LeaveStatus, 'warn' | 'ok' | 'bad' | 'neutral'> = { pending: 'warn', approved: 'ok', rejected: 'bad', cancelled: 'neutral' }

function ApplyModal({ onClose }: { onClose: () => void }) {
  const { data, session, applyLeave } = useStore()
  const toast = useToast()
  const today = todayIST()
  const [type, setType] = useState<LeaveType>('CL')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const days = from && to && to >= from ? leaveDays(from, to, data.holidays) : 0
  const bal = leaveBalance(session!.employeeId, type, data.leaves, (from || today).slice(0, 4))

  const submit = () => {
    const r = applyLeave({ type, from, to, reason })
    if (!r.ok) return setError(r.error)
    toast('Leave request submitted')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Apply for leave"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Submit request</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Leave type">
          <Select value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
            {(Object.keys(LEAVE_NAMES) as LeaveType[]).map((t) => (
              <option key={t} value={t}>{LEAVE_NAMES[t]} ({t})</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="From"><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value) }} /></Field>
          <Field label="To"><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm">
          <span className="text-muted">Working days requested</span>
          <strong>{days}</strong>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm">
          <span className="text-muted">{LEAVE_NAMES[type]} available</span>
          <strong className={days > bal.available ? 'text-bad' : ''}>{bal.available} / {bal.quota}</strong>
        </div>
        <Field label="Reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Briefly describe the reason" /></Field>
        <p className="text-xs text-muted">Sundays and public holidays inside the range are not counted.</p>
        {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}

function RequestTable({ rows, mode }: { rows: LeaveRequest[]; mode: 'approve' | 'mine' | 'all' }) {
  const { data, session, decideLeave, cancelLeave } = useStore()
  const toast = useToast()
  const today = todayIST()
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null)
  const [comment, setComment] = useState('')
  const emp = (id: string) => data.employees.find((e) => e.id === id)
  const run = (r: { ok: true } | { ok: false; error: string }, msg: string) => toast(r.ok ? msg : r.error, r.ok ? 'ok' : 'bad')

  if (!rows.length)
    return <Empty icon={<CalendarDays size={22} />} title={mode === 'approve' ? 'No pending requests' : 'No leave requests'} text={mode === 'approve' ? 'You are all caught up.' : undefined} />

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-muted">
              {mode !== 'mine' && <th className="px-5 py-3">Employee</th>}
              <th className="px-5 py-3">Type</th>
              <th className="px-3 py-3">Dates</th>
              <th className="px-3 py-3">Days</th>
              <th className="px-3 py-3">Reason</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-5 py-3 text-right">{mode === 'approve' ? 'Decision' : ''}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((l) => {
              const e = emp(l.employeeId)
              const bal = leaveBalance(l.employeeId, l.type, data.leaves, l.from.slice(0, 4))
              const canCancel =
                (l.status === 'pending' && (l.employeeId === session!.employeeId || session!.role === 'hr')) ||
                (l.status === 'approved' && (session!.role === 'hr' || (l.employeeId === session!.employeeId && l.from > today)))
              return (
                <tr key={l.id}>
                  {mode !== 'mine' && (
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e?.name ?? '?'} size="sm" />
                        <div>
                          <p className="font-semibold">{e?.name}</p>
                          <p className="text-xs text-muted">{e?.department}</p>
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="px-5 py-3"><Badge tone="plum">{l.type}</Badge></td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {fmtDate(l.from)}{l.to !== l.from && <> – {fmtDate(l.to)}</>}
                    <p className="text-xs text-muted">Applied {fmtDate(l.appliedOn, { day: 'numeric', month: 'short' })}</p>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {l.days}
                    {mode === 'approve' && <p className="text-xs text-muted">{bal.available + l.days} avail.</p>}
                  </td>
                  <td className="max-w-56 px-3 py-3">
                    <p className="truncate" title={l.reason}>{l.reason}</p>
                    {l.comment && <p className="truncate text-xs text-muted" title={l.comment}>“{l.comment}”</p>}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge>
                    {l.decidedBy && <p className="mt-0.5 text-[11px] text-muted">by {emp(l.decidedBy)?.name.split(' ')[0]}</p>}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {mode === 'approve' ? (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => { setRejecting(l); setComment('') }}><X size={14} /> Reject</Button>
                        <Button size="sm" variant="success" onClick={() => run(decideLeave(l.id, 'approved'), `Approved leave for ${e?.name}`)}><Check size={14} /> Approve</Button>
                      </div>
                    ) : (
                      canCancel && (
                        <Button size="sm" variant="ghost" onClick={() => confirm('Cancel this leave request?') && run(cancelLeave(l.id), 'Leave cancelled')}>
                          Cancel
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rejecting && (
        <Modal
          open
          onClose={() => setRejecting(null)}
          title="Reject leave request"
          footer={
            <>
              <Button variant="secondary" onClick={() => setRejecting(null)}>Back</Button>
              <Button variant="danger" onClick={() => { run(decideLeave(rejecting.id, 'rejected', comment.trim() || undefined), 'Leave rejected'); setRejecting(null) }}>Reject</Button>
            </>
          }
        >
          <p className="mb-4 text-sm text-muted">
            {emp(rejecting.employeeId)?.name} · {rejecting.type} · {fmtDate(rejecting.from)}{rejecting.to !== rejecting.from && ` – ${fmtDate(rejecting.to)}`}
          </p>
          <Field label="Comment for the employee (optional)"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
        </Modal>
      )}
    </>
  )
}

function HolidayCard() {
  const { data, session, addHoliday, removeHoliday } = useStore()
  const toast = useToast()
  const isHR = session!.role === 'hr'
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const today = todayIST()
  const year = today.slice(0, 4)
  const list = data.holidays.filter((h) => h.date.startsWith(year))
  return (
    <Card title={`Holiday calendar ${year}`} subtitle={`${list.length} public holidays`}>
      {isHR && (
        <form
          className="flex flex-wrap gap-2 border-b border-line px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault()
            const r = addHoliday({ date, name })
            toast(r.ok ? 'Holiday added' : r.error, r.ok ? 'ok' : 'bad')
            if (r.ok) { setDate(''); setName('') }
          }}
        >
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" aria-label="Holiday date" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday name" className="flex-1" aria-label="Holiday name" />
          <Button type="submit" variant="secondary"><Plus size={16} /> Add</Button>
        </form>
      )}
      {list.length === 0 ? (
        <Empty icon={<PartyPopper size={22} />} title="No holidays" />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((h) => (
            <li key={h.date} className={`flex items-center gap-4 px-5 py-2.5 ${h.date < today ? 'opacity-50' : ''}`}>
              <span className="w-28 text-sm font-semibold tabular-nums">{fmtDate(h.date, { day: 'numeric', month: 'short', weekday: 'short' })}</span>
              <span className="flex-1 text-sm">{h.name}</span>
              {isHR && (
                <button className="rounded p-1 text-muted hover:text-bad cursor-pointer" aria-label={`Remove ${h.name}`} onClick={() => confirm(`Remove ${h.name}?`) && removeHoliday(h.date)}>
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

type TabKey = 'approve' | 'mine' | 'all' | 'holidays'

export function Leave() {
  const { data, session } = useStore()
  const role = session!.role
  const [tab, setTab] = useState<TabKey>(role === 'employee' ? 'mine' : 'approve')
  const [applying, setApplying] = useState(false)
  const scope = new Set(scopeEmployees(session!, data.employees).map((e) => e.id))
  const pending = data.leaves.filter((l) => l.status === 'pending' && scope.has(l.employeeId) && l.employeeId !== session!.employeeId)
  const mine = data.leaves.filter((l) => l.employeeId === session!.employeeId)
  const all = data.leaves.filter((l) => scope.has(l.employeeId))
  const sortDesc = (xs: LeaveRequest[]) => [...xs].sort((a, b) => b.from.localeCompare(a.from))
  const bal = allBalances(session!.employeeId, data.leaves, todayIST().slice(0, 4))

  const tabs: { value: TabKey; label: string }[] = [
    ...(role !== 'employee' ? [{ value: 'approve' as TabKey, label: `Approvals${pending.length ? ` (${pending.length})` : ''}` }] : []),
    ...(role !== 'hr' ? [{ value: 'mine' as TabKey, label: 'My requests' }] : []),
    ...(role !== 'employee' ? [{ value: 'all' as TabKey, label: role === 'hr' ? 'All requests' : 'Team history' }] : []),
    { value: 'holidays', label: 'Holidays' },
  ]

  return (
    <>
      <PageHeader
        title="Leave"
        subtitle={role === 'employee' ? 'Apply for leave and track your requests.' : role === 'manager' ? 'Approve your team’s leave and manage your own.' : 'Review and manage leave across the company.'}
        actions={role !== 'hr' && <Button onClick={() => setApplying(true)}><CalendarPlus size={16} /> Apply for leave</Button>}
      />
      {role !== 'hr' && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {bal.map((b) => (
            <div key={b.type} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted">{LEAVE_NAMES[b.type]}</p>
                <Badge tone="plum">{b.type}</Badge>
              </div>
              <p className="mt-2 font-display text-3xl font-semibold">{b.available}<span className="text-base text-muted"> / {b.quota}</span></p>
              <p className="mt-1 text-xs text-muted">{b.used} used · {b.pending} pending</p>
            </div>
          ))}
        </div>
      )}
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={tabs} /></div>
      {tab === 'holidays' ? (
        <HolidayCard />
      ) : (
        <Card>
          {tab === 'approve' && <RequestTable rows={pending} mode="approve" />}
          {tab === 'mine' && <RequestTable rows={sortDesc(mine)} mode="mine" />}
          {tab === 'all' && <RequestTable rows={sortDesc(all)} mode="all" />}
        </Card>
      )}
      {applying && <ApplyModal onClose={() => setApplying(false)} />}
    </>
  )
}
