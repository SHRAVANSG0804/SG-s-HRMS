import { BarChart3, Briefcase, CalendarCheck2, CalendarDays, LayoutDashboard, LogOut, Menu, RotateCcw, Target, Users, Wallet, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Page } from '../lib/chatbot'
import { fmtDate, todayIST } from '../lib/date'
import { useStore } from '../lib/store'
import { cycleParticipants, reviewStage, scopeEmployees, visibleInterviews } from '../lib/rules'
import type { HRMSData, Role, Session } from '../lib/types'
import { Avatar, Badge, cx } from './ui'

export const ROLE_LABEL: Record<Role, string> = { hr: 'HR Admin', manager: 'Manager', employee: 'Employee' }

export function navFor(role: Role): { page: Page; label: string; icon: ReactNode }[] {
  const all = {
    dashboard: { page: 'dashboard' as Page, label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    employees: { page: 'employees' as Page, label: role === 'manager' ? 'My Team' : 'Employees', icon: <Users size={18} /> },
    attendance: { page: 'attendance' as Page, label: role === 'employee' ? 'My Attendance' : 'Attendance', icon: <CalendarCheck2 size={18} /> },
    leave: { page: 'leave' as Page, label: 'Leave', icon: <CalendarDays size={18} /> },
    recruitment: { page: 'recruitment' as Page, label: 'Recruitment', icon: <Briefcase size={18} /> },
    performance: { page: 'performance' as Page, label: 'Performance', icon: <Target size={18} /> },
    payroll: { page: 'payroll' as Page, label: role === 'hr' ? 'Payroll' : 'My Payslip', icon: <Wallet size={18} /> },
    reports: { page: 'reports' as Page, label: 'Reports', icon: <BarChart3 size={18} /> },
  }
  if (role === 'employee') return [all.dashboard, all.attendance, all.leave, all.performance, all.payroll]
  return [all.dashboard, all.employees, all.attendance, all.leave, all.recruitment, all.performance, all.payroll, all.reports]
}

/** Things waiting for this user in the ATS and PMS, shown as sidebar badges. */
function actionCounts(session: Session, data: HRMSData): Partial<Record<Page, number>> {
  const out: Partial<Record<Page, number>> = {}
  if (session.role !== 'employee') {
    const myInterviews = visibleInterviews(session, data.interviews, data.candidates, data.jobs).filter((i) => i.status === 'scheduled' && i.interviewerId === session.employeeId).length
    out.recruitment = myInterviews + (session.role === 'hr' ? data.jobs.filter((j) => j.status === 'requested').length : 0)
  }
  const cycle = data.cycles.find((c) => c.phase === 'review')
  if (cycle) {
    const stageOf = (id: string) => reviewStage(data.goals.filter((g) => g.cycleId === cycle.id && g.employeeId === id), data.reviews.find((r) => r.cycleId === cycle.id && r.employeeId === id))
    const ppl = cycleParticipants(cycle, data.employees)
    const mine = ppl.some((e) => e.id === session.employeeId) && stageOf(session.employeeId) === 'self_pending' ? 1 : 0
    const team = session.role === 'hr'
      ? ppl.filter((e) => stageOf(e.id) === 'hr_pending' || (e.managerId === null || e.managerId === session.employeeId) && stageOf(e.id) === 'manager_pending').length
      : session.role === 'manager'
        ? ppl.filter((e) => scopeEmployees(session, data.employees).some((x) => x.id === e.id) && stageOf(e.id) === 'manager_pending').length
        : 0
    out.performance = mine + team
  }
  return out
}

export function Layout({ page, setPage, children }: { page: Page; setPage: (p: Page) => void; children: ReactNode }) {
  const { session, me, logout, resetDemo, data } = useStore()
  const [open, setOpen] = useState(false)
  if (!session || !me) return null
  const nav = navFor(session.role)
  const pendingCount = data.leaves.filter((l) => {
    if (l.status !== 'pending' || l.employeeId === session.employeeId) return false
    if (session.role === 'hr') return true
    if (session.role === 'manager') return data.employees.find((e) => e.id === l.employeeId)?.managerId === session.employeeId
    return false
  }).length
  const badges: Partial<Record<Page, number>> = { leave: pendingCount, ...actionCounts(session, data) }

  const sidebar = (
    <nav className="flex h-full flex-col bg-ink text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid size-9 place-items-center rounded-xl bg-brand font-display text-sm font-bold">SG</span>
        <div>
          <p className="font-display text-base leading-tight font-semibold">SG HRMS</p>
          <p className="text-[11px] text-white/50">People · Attendance · Payroll</p>
        </div>
      </div>
      <div className="mt-2 flex-1 space-y-1 px-3">
        {nav.map((n) => (
          <button
            key={n.page}
            onClick={() => {
              setPage(n.page)
              setOpen(false)
            }}
            className={cx(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer',
              page === n.page ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
            )}
          >
            <span className={page === n.page ? 'text-brand-light' : ''}>{n.icon}</span>
            {n.label}
            {(badges[n.page] ?? 0) > 0 && (
              <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold">{badges[n.page]}</span>
            )}
          </button>
        ))}
      </div>
      <div className="space-y-1 border-t border-white/10 p-3">
        {session.role === 'hr' && (
          <button
            onClick={() => confirm('Reset all data to the demo data set? Your changes will be lost.') && resetDemo()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-white/50 hover:bg-white/5 hover:text-white cursor-pointer"
          >
            <RotateCcw size={15} /> Reset demo data
          </button>
        )}
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white cursor-pointer">
          <LogOut size={17} /> Sign out
        </button>
      </div>
    </nav>
  )

  return (
    <div className="flex min-h-full">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
          <button className="absolute top-4 left-[17rem] rounded-lg bg-white p-1.5" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur sm:px-8">
          <button className="rounded-lg p-2 hover:bg-soft lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <p className="hidden text-sm text-muted sm:block">{fmtDate(todayIST(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="ml-auto flex items-center gap-3">
            <Badge tone={session.role === 'hr' ? 'brand' : session.role === 'manager' ? 'info' : 'ok'}>{ROLE_LABEL[session.role]}</Badge>
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-semibold">{me.name}</p>
              <p className="text-xs text-muted">{me.designation}</p>
            </div>
            <Avatar name={me.name} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  )
}
