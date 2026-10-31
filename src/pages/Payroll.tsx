import { ChevronLeft, ChevronRight, Download, FileText, IndianRupee, Printer, TrendingDown, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Button, Card, Modal, PageHeader, StatCard } from '../components/ui'
import { downloadCSV } from '../lib/csv'
import { addMonths, fmtMonth, monthOf, todayIST } from '../lib/date'
import { PF_RATE, inr, maskAccount, maskPAN, payslip } from '../lib/rules'
import { useStore } from '../lib/store'
import type { Employee } from '../lib/types'

function MonthPicker({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const current = monthOf(todayIST())
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1">
      <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={16} /></Button>
      <span className="w-36 text-center text-sm font-semibold">{fmtMonth(month)}</span>
      <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= current} aria-label="Next month"><ChevronRight size={16} /></Button>
    </div>
  )
}

function Payslip({ emp, month }: { emp: Employee; month: string }) {
  const { data } = useStore()
  const p = payslip(emp, month, data.attendance, data.holidays)
  const partial = month === monthOf(todayIST())
  const Row = ({ k, v, bold }: { k: string; v: number; bold?: boolean }) => (
    <div className={`flex justify-between py-1.5 text-sm ${bold ? 'border-t border-line pt-2.5 font-semibold' : ''}`}>
      <span className={bold ? '' : 'text-ink-2'}>{k}</span>
      <span className="tabular-nums">{inr(v)}</span>
    </div>
  )
  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand font-display text-sm font-bold text-white">SG</span>
          <div>
            <p className="font-display text-lg font-semibold">Payslip · {fmtMonth(month)}</p>
            <p className="text-xs text-muted">{partial ? 'Estimate based on attendance marked so far' : 'Based on the monthly attendance register'}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Net pay</p>
          <p className="font-display text-3xl font-semibold text-ok">{inr(p.net)}</p>
        </div>
      </div>
      <div className="grid gap-x-8 gap-y-2 border-b border-line p-6 text-sm sm:grid-cols-3">
        {[
          ['Employee', emp.name], ['Code', emp.code], ['Designation', emp.designation],
          ['Department', emp.department], ['PAN', maskPAN(emp.pan)], ['Bank A/C', maskAccount(emp.bankAccount)],
          ['Working days', p.workingDays], ['LOP days', p.lopDays], ['Payable days', p.payableDays],
        ].map(([k, v]) => (
          <div key={k as string}>
            <p className="text-xs text-muted">{k}</p>
            <p className="font-medium">{v}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-8 p-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">Earnings</p>
          <Row k="Basic" v={p.earnings.basic} />
          <Row k="House rent allowance" v={p.earnings.hra} />
          <Row k="Other allowances" v={p.earnings.allowances} />
          <Row k="Gross earnings" v={p.earnings.gross} bold />
        </div>
        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">Deductions</p>
          <Row k={`Provident fund (${PF_RATE * 100}% of earned basic)`} v={p.deductions.pf} />
          <Row k="Professional tax" v={p.deductions.professionalTax} />
          <Row k={`Loss of pay (${p.lopDays} day${p.lopDays === 1 ? '' : 's'})`} v={p.deductions.lop} />
          <Row k="Total deductions" v={p.deductions.total} bold />
        </div>
      </div>
      <p className="border-t border-line px-6 py-3 text-[11px] text-muted">This is a system-generated payslip and does not need a signature.</p>
    </div>
  )
}

export function Payroll() {
  const { data, session, me } = useStore()
  const [month, setMonth] = useState(monthOf(todayIST()))
  const [viewing, setViewing] = useState<Employee | null>(null)

  if (session!.role !== 'hr') {
    return (
      <>
        <PageHeader
          title="My Payslip"
          subtitle="Salary breakdown with loss of pay from your attendance."
          actions={
            <>
              <MonthPicker month={month} setMonth={setMonth} />
              <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button>
            </>
          }
        />
        <Payslip emp={me!} month={month} />
      </>
    )
  }

  const active = data.employees.filter((e) => e.active && e.joinDate <= `${month}-31`)
  const slips = active.map((e) => ({ e, p: payslip(e, month, data.attendance, data.holidays) }))
  const total = (f: (p: ReturnType<typeof payslip>) => number) => slips.reduce((s, x) => s + f(x.p), 0)

  const exportCSV = () =>
    downloadCSV(`payroll-${month}.csv`, [
      ['Code', 'Name', 'Department', 'Working days', 'LOP days', 'Basic', 'HRA', 'Allowances', 'Gross', 'PF', 'Prof. tax', 'LOP amount', 'Total deductions', 'Net pay', 'Bank A/C (masked)'],
      ...slips.map(({ e, p }) => [e.code, e.name, e.department, p.workingDays, p.lopDays, p.earnings.basic, p.earnings.hra, p.earnings.allowances, p.earnings.gross, p.deductions.pf, p.deductions.professionalTax, p.deductions.lop, p.deductions.total, p.net, maskAccount(e.bankAccount)]),
    ])

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Monthly payroll overview. Loss of pay is calculated from the attendance register."
        actions={
          <>
            <MonthPicker month={month} setMonth={setMonth} />
            <Button variant="secondary" onClick={exportCSV}><Download size={16} /> Export</Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross payroll" value={inr(total((p) => p.earnings.gross))} hint={`${slips.length} employees`} icon={<IndianRupee size={18} />} tone="info" />
        <StatCard label="Net payout" value={inr(total((p) => p.net))} hint="After all deductions" icon={<Wallet size={18} />} tone="ok" />
        <StatCard label="Provident fund" value={inr(total((p) => p.deductions.pf))} hint="Employee contribution" icon={<FileText size={18} />} tone="plum" />
        <StatCard label="Loss of pay" value={inr(total((p) => p.deductions.lop))} hint={`${total((p) => p.lopDays)} LOP days`} icon={<TrendingDown size={18} />} tone="bad" />
      </div>
      <Card className="mt-6" title="Employee payroll" subtitle={fmtMonth(month)}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-right text-xs font-semibold text-muted">
                <th className="px-5 py-3 text-left">Employee</th>
                <th className="px-3 py-3">Gross</th>
                <th className="px-3 py-3">LOP days</th>
                <th className="px-3 py-3">PF</th>
                <th className="px-3 py-3">Prof. tax</th>
                <th className="px-3 py-3">LOP</th>
                <th className="px-3 py-3">Net pay</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {slips.map(({ e, p }) => (
                <tr key={e.id} className="text-right tabular-nums">
                  <td className="px-5 py-3 text-left">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} size="sm" />
                      <div>
                        <p className="font-semibold">{e.name}</p>
                        <p className="text-xs text-muted">{e.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">{inr(p.earnings.gross)}</td>
                  <td className={`px-3 py-3 ${p.lopDays ? 'font-semibold text-bad' : 'text-muted'}`}>{p.lopDays}</td>
                  <td className="px-3 py-3 text-muted">{inr(p.deductions.pf)}</td>
                  <td className="px-3 py-3 text-muted">{inr(p.deductions.professionalTax)}</td>
                  <td className="px-3 py-3 text-muted">{inr(p.deductions.lop)}</td>
                  <td className="px-3 py-3 font-semibold">{inr(p.net)}</td>
                  <td className="px-5 py-3">
                    <Button size="sm" variant="ghost" onClick={() => setViewing(e)}>Payslip</Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line bg-canvas text-right font-semibold tabular-nums">
                <td className="px-5 py-3 text-left">Total</td>
                <td className="px-3 py-3">{inr(total((p) => p.earnings.gross))}</td>
                <td className="px-3 py-3">{total((p) => p.lopDays)}</td>
                <td className="px-3 py-3">{inr(total((p) => p.deductions.pf))}</td>
                <td className="px-3 py-3">{inr(total((p) => p.deductions.professionalTax))}</td>
                <td className="px-3 py-3">{inr(total((p) => p.deductions.lop))}</td>
                <td className="px-3 py-3">{inr(total((p) => p.net))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      {viewing && (
        <Modal open wide onClose={() => setViewing(null)} title={`Payslip · ${viewing.name}`} footer={<Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button>}>
          <Payslip emp={viewing} month={month} />
        </Modal>
      )}
    </>
  )
}
