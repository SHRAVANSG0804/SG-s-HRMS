import { BriefcaseBusiness, CalendarCheck2, Eye, EyeOff, Lock, MessageCircle, ShieldCheck, UserRound, Users, Wallet } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Button, Field, Input, Select, cx } from '../components/ui'
import { HR_ADMIN_ID, useStore } from '../lib/store'
import type { Role } from '../lib/types'

const ROLES: { role: Role; title: string; text: string; icon: ReactNode }[] = [
  { role: 'hr', title: 'HR', text: 'Manage people, payroll & policy', icon: <ShieldCheck size={20} /> },
  { role: 'manager', title: 'Manager', text: 'Team attendance & approvals', icon: <BriefcaseBusiness size={20} /> },
  { role: 'employee', title: 'Employee', text: 'Attendance, leave & payslips', icon: <UserRound size={20} /> },
]

export function Login() {
  const { data, login } = useStore()
  const [role, setRole] = useState<Role>('hr')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [error, setError] = useState('')

  const profiles = useMemo(() => {
    const active = data.employees.filter((e) => e.active)
    if (role === 'manager') return active.filter((e) => active.some((x) => x.managerId === e.id))
    if (role === 'employee') return active.filter((e) => e.id !== HR_ADMIN_ID)
    return []
  }, [data.employees, role])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const r = login(role, password, employeeId)
    if (!r.ok) setError(r.error)
  }

  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-brand/25 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 size-96 rounded-full bg-info/25 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand font-display text-base font-bold">SG</span>
          <span className="font-display text-xl font-semibold">SG HRMS</span>
        </div>
        <div className="relative my-auto max-w-lg">
          <h1 className="font-display text-5xl leading-[1.05] font-semibold tracking-tight">
            Your people, <span className="text-brand-light">organised.</span>
          </h1>
          <p className="mt-5 text-lg text-white/65">One workspace for HR, managers and employees: attendance, leave, payroll and an assistant built for each role.</p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              [<CalendarCheck2 size={18} key="a" />, 'Manual attendance', 'Mark the whole team in seconds'],
              [<Users size={18} key="b" />, 'Employee directory', 'Profiles, teams and reporting lines'],
              [<Wallet size={18} key="c" />, 'Payroll overview', 'Payslips with LOP from attendance'],
              [<MessageCircle size={18} key="d" />, 'Role-based assistant', 'Ask questions, get live answers'],
            ].map(([icon, t, s]) => (
              <div key={t as string} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <span className="text-brand-light">{icon}</span>
                <p className="mt-2 text-sm font-semibold">{t}</p>
                <p className="mt-0.5 text-xs text-white/55">{s}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} SG HRMS</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-brand font-display text-sm font-bold text-white">SG</span>
            <span className="font-display text-lg font-semibold">SG HRMS</span>
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-muted">Choose how you're signing in today.</p>

          <div className="mt-8 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Role">
            {ROLES.map((r) => (
              <button
                type="button"
                role="radio"
                aria-checked={role === r.role}
                key={r.role}
                onClick={() => {
                  setRole(r.role)
                  setEmployeeId('')
                  setPassword('')
                  setError('')
                }}
                className={cx(
                  'rounded-2xl border-2 p-3 text-left transition-all cursor-pointer',
                  role === r.role ? 'border-ink bg-white shadow-md' : 'border-line bg-white/60 hover:border-ink/30',
                )}
              >
                <span className={cx('grid size-9 place-items-center rounded-xl', role === r.role ? 'bg-ink text-white' : 'bg-soft text-ink-2')}>{r.icon}</span>
                <p className="mt-2.5 text-sm font-semibold">{r.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">{r.text}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            {role !== 'hr' && (
              <Field label={role === 'manager' ? 'Manager profile' : 'Your name'}>
                <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
                  <option value="">Select…</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.designation}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={`${ROLES.find((r) => r.role === role)!.title} password`}>
              <div className="relative">
                <Lock size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
                <Input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="Enter password"
                  className="pl-9 pr-10"
                  autoComplete="current-password"
                  inputMode="numeric"
                  required
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink cursor-pointer" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{error}</p>}
            <Button type="submit" className="h-11 w-full">
              Sign in as {ROLES.find((r) => r.role === role)!.title}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
