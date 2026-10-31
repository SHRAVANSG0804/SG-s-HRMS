import { Download, Eye, EyeOff, Mail, MapPin, Pencil, Phone, Plus, Search, UserX, Users } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, useToast } from '../components/ui'
import { downloadCSV } from '../lib/csv'
import { fmtDate, monthOf, todayIST } from '../lib/date'
import { allBalances, attendanceSummary, inr, maskAccount, maskPAN, monthRange, scopeEmployees } from '../lib/rules'
import { DEPARTMENTS, LOCATIONS } from '../lib/seed'
import { useStore, type EmployeeInput } from '../lib/store'
import type { Employee } from '../lib/types'

const blank = (): EmployeeInput => ({
  name: '', email: '', phone: '', department: DEPARTMENTS[1], designation: '', location: LOCATIONS[0], managerId: null,
  joinDate: todayIST(), pan: '', bankAccount: '', salary: { basic: 25000, hra: 10000, allowances: 5000 },
})

function EmployeeForm({ initial, editingId, onClose }: { initial: EmployeeInput; editingId?: string; onClose: () => void }) {
  const { data, addEmployee, updateEmployee } = useStore()
  const toast = useToast()
  const [f, setF] = useState<EmployeeInput>(initial)
  const [error, setError] = useState('')
  const set = <K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const setSal = (k: keyof EmployeeInput['salary'], v: string) => setF((x) => ({ ...x, salary: { ...x.salary, [k]: Number(v) || 0 } }))
  const managers = data.employees.filter((e) => e.active && e.id !== editingId)

  const submit = () => {
    const input = { ...f, pan: f.pan.toUpperCase().trim(), email: f.email.trim(), name: f.name.trim() }
    const r = editingId ? updateEmployee(editingId, input) : addEmployee(input)
    if (!r.ok) return setError(r.error)
    toast(editingId ? 'Employee updated' : 'Employee added')
    onClose()
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={editingId ? 'Edit employee' : 'Add employee'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{editingId ? 'Save changes' : 'Add employee'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><Input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <Field label="Work email"><Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 …" /></Field>
        <Field label="Designation"><Input value={f.designation} onChange={(e) => set('designation', e.target.value)} /></Field>
        <Field label="Department">
          <Select value={f.department} onChange={(e) => set('department', e.target.value)}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</Select>
        </Field>
        <Field label="Location">
          <Select value={f.location} onChange={(e) => set('location', e.target.value)}>{LOCATIONS.map((d) => <option key={d}>{d}</option>)}</Select>
        </Field>
        <Field label="Reports to">
          <Select value={f.managerId ?? ''} onChange={(e) => set('managerId', e.target.value || null)}>
            <option value="">— No manager (reports to HR) —</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.designation}</option>)}
          </Select>
        </Field>
        <Field label="Date of joining"><Input type="date" value={f.joinDate} onChange={(e) => set('joinDate', e.target.value)} /></Field>
        <Field label="PAN" hint="Format ABCDE1234F"><Input value={f.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} maxLength={10} /></Field>
        <Field label="Bank account number"><Input value={f.bankAccount} onChange={(e) => set('bankAccount', e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></Field>
      </div>
      <p className="mt-6 mb-3 text-xs font-bold tracking-wide text-muted uppercase">Monthly salary (₹)</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Basic"><Input type="number" min={0} value={f.salary.basic} onChange={(e) => setSal('basic', e.target.value)} /></Field>
        <Field label="HRA"><Input type="number" min={0} value={f.salary.hra} onChange={(e) => setSal('hra', e.target.value)} /></Field>
        <Field label="Other allowances"><Input type="number" min={0} value={f.salary.allowances} onChange={(e) => setSal('allowances', e.target.value)} /></Field>
      </div>
      <p className="mt-2 text-xs text-muted">Gross: <strong className="text-ink">{inr(f.salary.basic + f.salary.hra + f.salary.allowances)}</strong> per month</p>
      {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{error}</p>}
    </Modal>
  )
}

function Profile({ emp, onClose, onEdit }: { emp: Employee; onClose: () => void; onEdit: () => void }) {
  const { data, session, setEmployeeActive } = useStore()
  const toast = useToast()
  const [reveal, setReveal] = useState(false)
  const isHR = session!.role === 'hr'
  const today = todayIST()
  const [from, to] = monthRange(monthOf(today), today)
  const s = attendanceSummary(emp.id, from, to, data.attendance, data.holidays)
  const bal = allBalances(emp.id, data.leaves, today.slice(0, 4))
  const mgr = data.employees.find((e) => e.id === emp.managerId)
  const reports = data.employees.filter((e) => e.managerId === emp.id && e.active)

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Employee profile"
      footer={
        isHR ? (
          <>
            <Button
              variant={emp.active ? 'secondary' : 'success'}
              onClick={() => {
                if (emp.active && !confirm(`Deactivate ${emp.name}? Their pending leave will be cancelled.`)) return
                const r = setEmployeeActive(emp.id, !emp.active)
                toast(r.ok ? (emp.active ? 'Employee deactivated' : 'Employee reactivated') : r.error, r.ok ? 'ok' : 'bad')
                if (r.ok) onClose()
              }}
            >
              <UserX size={16} /> {emp.active ? 'Deactivate' : 'Reactivate'}
            </Button>
            <Button onClick={onEdit}><Pencil size={16} /> Edit</Button>
          </>
        ) : undefined
      }
    >
      <div className="flex items-center gap-4">
        <Avatar name={emp.name} size="lg" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl font-semibold">{emp.name}</h3>
            {!emp.active && <Badge tone="bad">Inactive</Badge>}
          </div>
          <p className="text-sm text-muted">{emp.designation} · {emp.department} · {emp.code}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <p className="flex items-center gap-2"><Mail size={15} className="text-muted" /> {emp.email}</p>
        <p className="flex items-center gap-2"><Phone size={15} className="text-muted" /> {emp.phone}</p>
        <p className="flex items-center gap-2"><MapPin size={15} className="text-muted" /> {emp.location}</p>
        <p><span className="text-muted">Joined:</span> {fmtDate(emp.joinDate)}</p>
        <p><span className="text-muted">Reports to:</span> {mgr?.name ?? 'HR'}</p>
        <p><span className="text-muted">Direct reports:</span> {reports.length || '—'}</p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-canvas p-3"><p className="text-xs text-muted">Attendance (MTD)</p><p className="font-display text-xl font-semibold">{s.rate}%</p></div>
        {bal.map((b) => (
          <div key={b.type} className="rounded-xl bg-canvas p-3"><p className="text-xs text-muted">{b.type} available</p><p className="font-display text-xl font-semibold">{b.available}<span className="text-sm text-muted">/{b.quota}</span></p></div>
        ))}
      </div>
      {isHR && (
        <div className="mt-6 rounded-xl border border-line p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold tracking-wide text-muted uppercase">Confidential (HR only)</p>
            <button onClick={() => setReveal(!reveal)} className="inline-flex items-center gap-1 text-xs font-semibold text-info cursor-pointer">
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />} {reveal ? 'Hide' : 'Reveal'}
            </button>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <p><span className="text-muted">PAN:</span> <span className="font-mono">{reveal ? emp.pan : maskPAN(emp.pan)}</span></p>
            <p><span className="text-muted">Bank A/C:</span> <span className="font-mono">{reveal ? emp.bankAccount : maskAccount(emp.bankAccount)}</span></p>
            <p><span className="text-muted">Gross:</span> {inr(emp.salary.basic + emp.salary.hra + emp.salary.allowances)}/mo</p>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function Employees() {
  const { data, session } = useStore()
  const isHR = session!.role === 'hr'
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [viewing, setViewing] = useState<Employee | null>(null)
  const [editing, setEditing] = useState<{ initial: EmployeeInput; id?: string } | null>(null)

  const pool = scopeEmployees(session!, data.employees)
  const list = pool.filter(
    (e) =>
      (status === 'all' || (status === 'active') === e.active) &&
      (!dept || e.department === dept) &&
      (!q || `${e.name} ${e.code} ${e.designation} ${e.email}`.toLowerCase().includes(q.toLowerCase())),
  )
  const managerName = (id: string | null) => data.employees.find((e) => e.id === id)?.name ?? '—'

  const exportCSV = () =>
    downloadCSV('employees.csv', [
      ['Code', 'Name', 'Email', 'Phone', 'Department', 'Designation', 'Location', 'Manager', 'Joined', 'Status', 'PAN (masked)', 'Bank A/C (masked)'],
      ...list.map((e) => [e.code, e.name, e.email, e.phone, e.department, e.designation, e.location, managerName(e.managerId), e.joinDate, e.active ? 'Active' : 'Inactive', maskPAN(e.pan), maskAccount(e.bankAccount)]),
    ])

  return (
    <>
      <PageHeader
        title={isHR ? 'Employees' : 'My Team'}
        subtitle={isHR ? `${data.employees.filter((e) => e.active).length} active employees across ${DEPARTMENTS.length} departments` : `${pool.length} direct reports`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCSV}><Download size={16} /> Export</Button>
            {isHR && <Button onClick={() => setEditing({ initial: blank() })}><Plus size={16} /> Add employee</Button>}
          </>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, code, role…" className="pl-9" />
          </div>
          {isHR && (
            <>
              <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-48" aria-label="Department">
                <option value="">All departments</option>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </Select>
              <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-36" aria-label="Status">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </Select>
            </>
          )}
        </div>
        {list.length === 0 ? (
          <Empty icon={<Users size={22} />} title="No employees found" text="Try a different search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-muted">
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-3 py-3">Department</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Reports to</th>
                  <th className="px-3 py-3">Joined</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((e) => (
                  <tr key={e.id} className="cursor-pointer hover:bg-canvas/70" onClick={() => setViewing(e)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={e.name} />
                        <div>
                          <p className="font-semibold">{e.name}</p>
                          <p className="text-xs text-muted">{e.designation} · {e.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{e.department}</td>
                    <td className="px-3 py-3 text-muted">{e.location}</td>
                    <td className="px-3 py-3 text-muted">{managerName(e.managerId)}</td>
                    <td className="px-3 py-3 text-muted">{fmtDate(e.joinDate)}</td>
                    <td className="px-3 py-3">{e.active ? <Badge tone="ok">Active</Badge> : <Badge tone="bad">Inactive</Badge>}</td>
                    <td className="px-5 py-3 text-right">
                      {isHR && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            const { id, code, active, ...rest } = e
                            void code; void active
                            setEditing({ initial: rest, id })
                          }}
                        >
                          <Pencil size={14} /> Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {viewing && (
        <Profile
          emp={data.employees.find((e) => e.id === viewing.id)!}
          onClose={() => setViewing(null)}
          onEdit={() => {
            const { id, code, active, ...rest } = data.employees.find((e) => e.id === viewing.id)!
            void code; void active
            setViewing(null)
            setEditing({ initial: rest, id })
          }}
        />
      )}
      {editing && <EmployeeForm initial={editing.initial} editingId={editing.id} onClose={() => setEditing(null)} />}
    </>
  )
}
