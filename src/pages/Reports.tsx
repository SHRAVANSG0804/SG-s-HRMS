import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useState } from 'react'
import { HBars, Legend, StackedBars, type SeriesKey } from '../components/charts'
import { Badge, Button, Card, PageHeader } from '../components/ui'
import { downloadCSV } from '../lib/csv'
import { addMonths, fmtMonth, monthOf, todayIST } from '../lib/date'
import { LEAVE_NAMES, LEAVE_QUOTA, attendanceSummary, monthRange, scopeEmployees } from '../lib/rules'
import { useStore } from '../lib/store'
import type { LeaveType } from '../lib/types'

const KEYS: SeriesKey[] = ['present', 'wfh', 'half_day', 'absent', 'leave']

export function Reports() {
  const { data, session } = useStore()
  const today = todayIST()
  const [month, setMonth] = useState(monthOf(today))
  const [from, to] = monthRange(month, today)
  const pool = scopeEmployees(session!, data.employees).filter((e) => e.active && e.joinDate <= to)
  const rows = pool.map((e) => ({ e, s: attendanceSummary(e.id, from, to, data.attendance, data.holidays) }))

  const depts = [...new Set(pool.map((e) => e.department))].sort()
  const deptRates = depts
    .map((d) => {
      const rs = rows.filter((r) => r.e.department === d)
      return { label: d, value: Math.round((rs.reduce((s, r) => s + r.s.rate, 0) / rs.length) * 10) / 10 }
    })
    .sort((a, b) => b.value - a.value)

  // One department (a manager's team): show a bar per person instead of a single bar.
  const byPerson = depts.length <= 1
  const groups = byPerson
    ? rows.map((r) => ({ label: r.e.name.split(' ')[0], sub: r.e.name, rs: [r] }))
    : depts.map((d) => ({ label: d.split(' ')[0], sub: d, rs: rows.filter((r) => r.e.department === d) }))
  const deptStack = groups.map(({ label, sub, rs }) => {
    const sum = (k: 'present' | 'wfh' | 'halfDay' | 'absent' | 'leave') => rs.reduce((s, r) => s + r.s[k], 0)
    return { label, sub, values: { present: sum('present'), wfh: sum('wfh'), half_day: sum('halfDay'), absent: sum('absent'), leave: sum('leave') } }
  })

  const year = month.slice(0, 4)
  const ids = new Set(pool.map((e) => e.id))
  const leaveUse = (Object.keys(LEAVE_QUOTA) as LeaveType[]).map((t) => {
    const used = data.leaves.filter((l) => ids.has(l.employeeId) && l.type === t && l.status === 'approved' && l.from.startsWith(year)).reduce((s, l) => s + l.days, 0)
    return { label: `${LEAVE_NAMES[t]} (${t})`, value: used }
  })

  const exportCSV = () =>
    downloadCSV(`attendance-summary-${month}.csv`, [
      ['Code', 'Name', 'Department', 'Working days', 'Present', 'WFH', 'Half day', 'Absent', 'Leave', 'Unmarked', 'Attendance %'],
      ...rows.map(({ e, s }) => [e.code, e.name, e.department, s.workingDays, s.present, s.wfh, s.halfDay, s.absent, s.leave, s.unmarked, s.rate]),
    ])

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={session!.role === 'hr' ? 'Company-wide attendance and leave analytics.' : 'Attendance and leave analytics for your team.'}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1">
              <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={16} /></Button>
              <span className="w-36 text-center text-sm font-semibold">{fmtMonth(month)}</span>
              <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= monthOf(today)} aria-label="Next month"><ChevronRight size={16} /></Button>
            </div>
            <Button variant="secondary" onClick={exportCSV}><Download size={16} /> Export CSV</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={byPerson ? 'Attendance days by team member' : 'Attendance days by department'} subtitle={`${fmtMonth(month)}${month === monthOf(today) ? ' · to date' : ''}`} action={<Legend keys={KEYS} />}>
          <div className="px-5 pt-6 pb-2"><StackedBars data={deptStack} keys={KEYS} /></div>
        </Card>
        <Card title="Attendance rate by department" subtitle="Average of employee rates">
          <div className="p-5"><HBars data={deptRates} format={(n) => `${n}%`} color="#0F7B5F" /></div>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Employee attendance summary" subtitle="Table view of the data above">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-right text-xs font-semibold text-muted">
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-3 py-3">Working</th>
                  <th className="px-3 py-3">Present</th>
                  <th className="px-3 py-3">WFH</th>
                  <th className="px-3 py-3">Half</th>
                  <th className="px-3 py-3">Absent</th>
                  <th className="px-3 py-3">Leave</th>
                  <th className="px-5 py-3">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...rows].sort((a, b) => a.s.rate - b.s.rate).map(({ e, s }) => (
                  <tr key={e.id} className="text-right tabular-nums">
                    <td className="px-5 py-2.5 text-left">
                      <p className="font-semibold">{e.name}</p>
                      <p className="text-xs text-muted">{e.department}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{s.workingDays}</td>
                    <td className="px-3 py-2.5">{s.present}</td>
                    <td className="px-3 py-2.5">{s.wfh}</td>
                    <td className="px-3 py-2.5">{s.halfDay}</td>
                    <td className={`px-3 py-2.5 ${s.absent ? 'font-semibold text-bad' : ''}`}>{s.absent}</td>
                    <td className="px-3 py-2.5">{s.leave}</td>
                    <td className="px-5 py-2.5"><Badge tone={s.rate >= 90 ? 'ok' : s.rate >= 75 ? 'warn' : 'bad'}>{s.rate}%</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={`Leave taken in ${year}`} subtitle="Approved days">
          <div className="p-5"><HBars data={leaveUse} format={(n) => `${n} days`} color="#7A2BB8" /></div>
        </Card>
      </div>
    </>
  )
}
