// Pure business rules. Screens, the chatbot and CSV exports all reuse these.
import { daysBetweenInclusive, daysInMonth, isSunday, monthOf } from './date'
import type {
  AttendanceRecord, AttendanceStatus, Candidate, CandidateStage, Employee, Goal, Holiday, Interview, Job, LeaveRequest, LeaveType, Review, ReviewCycle, Session,
} from './types'

export const LEAVE_QUOTA: Record<LeaveType, number> = { CL: 8, SL: 7, EL: 15 }
export const LEAVE_NAMES: Record<LeaveType, string> = { CL: 'Casual Leave', SL: 'Sick Leave', EL: 'Earned Leave' }

export const STATUS_META: Record<AttendanceStatus, { label: string; short: string; tone: Tone }> = {
  present: { label: 'Present', short: 'P', tone: 'ok' },
  absent: { label: 'Absent', short: 'A', tone: 'bad' },
  half_day: { label: 'Half day', short: 'H', tone: 'warn' },
  leave: { label: 'On leave', short: 'L', tone: 'plum' },
  wfh: { label: 'Work from home', short: 'W', tone: 'info' },
  holiday: { label: 'Holiday', short: 'HO', tone: 'teal' },
}

export type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'plum' | 'teal' | 'neutral' | 'brand'

// ---------- Access ----------

export function directReports(managerId: string, employees: Employee[]): Employee[] {
  return employees.filter((e) => e.managerId === managerId && e.active)
}

/** Employees this session may see and act on (attendance, leave approvals). */
export function scopeEmployees(session: Session, employees: Employee[]): Employee[] {
  if (session.role === 'hr') return employees
  if (session.role === 'manager') return directReports(session.employeeId, employees)
  return employees.filter((e) => e.id === session.employeeId)
}

export function canActOn(session: Session, employeeId: string, employees: Employee[]): boolean {
  if (session.role === 'hr') return true
  if (session.role === 'manager') return directReports(session.employeeId, employees).some((e) => e.id === employeeId)
  return false
}

// ---------- Calendar ----------

export function isHoliday(date: string, holidays: Holiday[]): Holiday | undefined {
  return holidays.find((h) => h.date === date)
}

export function isWorkingDay(date: string, holidays: Holiday[]): boolean {
  return !isSunday(date) && !isHoliday(date, holidays)
}

export function workingDaysInRange(from: string, to: string, holidays: Holiday[]): string[] {
  if (to < from) return []
  return daysBetweenInclusive(from, to).filter((d) => isWorkingDay(d, holidays))
}

// ---------- Leave ----------

export function leaveDays(from: string, to: string, holidays: Holiday[]): number {
  return workingDaysInRange(from, to, holidays).length
}

export interface LeaveBalance {
  type: LeaveType
  quota: number
  used: number
  pending: number
  available: number
}

/** Balance is always computed, never stored: quota − approved − pending. */
export function leaveBalance(employeeId: string, type: LeaveType, leaves: LeaveRequest[], year: string): LeaveBalance {
  const mine = leaves.filter((l) => l.employeeId === employeeId && l.type === type && l.from.startsWith(year))
  const used = mine.filter((l) => l.status === 'approved').reduce((s, l) => s + l.days, 0)
  const pending = mine.filter((l) => l.status === 'pending').reduce((s, l) => s + l.days, 0)
  const quota = LEAVE_QUOTA[type]
  return { type, quota, used, pending, available: quota - used - pending }
}

export function allBalances(employeeId: string, leaves: LeaveRequest[], year: string): LeaveBalance[] {
  return (Object.keys(LEAVE_QUOTA) as LeaveType[]).map((t) => leaveBalance(employeeId, t, leaves, year))
}

export function overlapsExisting(employeeId: string, from: string, to: string, leaves: LeaveRequest[]): boolean {
  return leaves.some(
    (l) => l.employeeId === employeeId && (l.status === 'pending' || l.status === 'approved') && l.from <= to && from <= l.to,
  )
}

/** Returns an error message, or null if the request is valid. */
export function validateLeave(
  req: { employeeId: string; type: LeaveType; from: string; to: string },
  leaves: LeaveRequest[],
  holidays: Holiday[],
): string | null {
  if (!req.from || !req.to) return 'Choose both a start and an end date.'
  if (req.to < req.from) return 'The end date is before the start date.'
  const days = leaveDays(req.from, req.to, holidays)
  if (days === 0) return 'The selected dates contain no working days.'
  if (overlapsExisting(req.employeeId, req.from, req.to, leaves)) return 'You already have leave applied for some of these dates.'
  const bal = leaveBalance(req.employeeId, req.type, leaves, req.from.slice(0, 4))
  if (days > bal.available) return `Only ${bal.available} ${req.type} day(s) available; this request needs ${days}.`
  return null
}

// ---------- Attendance ----------

export interface AttendanceSummary {
  workingDays: number
  present: number
  absent: number
  halfDay: number
  leave: number
  wfh: number
  unmarked: number
  /** Present-equivalent days: present + wfh + 0.5 × half day */
  effective: number
  /** effective ÷ (working days − leave), as a percentage */
  rate: number
}

export function attendanceSummary(
  employeeId: string,
  from: string,
  to: string,
  attendance: AttendanceRecord[],
  holidays: Holiday[],
): AttendanceSummary {
  const days = workingDaysInRange(from, to, holidays)
  const byDate = new Map(attendance.filter((a) => a.employeeId === employeeId).map((a) => [a.date, a.status]))
  const s = { workingDays: days.length, present: 0, absent: 0, halfDay: 0, leave: 0, wfh: 0, unmarked: 0 }
  for (const d of days) {
    const st = byDate.get(d)
    if (st === 'present') s.present++
    else if (st === 'absent') s.absent++
    else if (st === 'half_day') s.halfDay++
    else if (st === 'leave') s.leave++
    else if (st === 'wfh') s.wfh++
    else s.unmarked++
  }
  const effective = s.present + s.wfh + s.halfDay * 0.5
  const base = s.workingDays - s.leave - s.unmarked
  return { ...s, effective, rate: base > 0 ? Math.round((effective / base) * 1000) / 10 : 0 }
}

export function monthRange(month: string, upTo?: string): [string, string] {
  const days = daysInMonth(month)
  const last = upTo && monthOf(upTo) === month ? upTo : days[days.length - 1]
  return [days[0], last]
}

// ---------- Payroll ----------

export const PROFESSIONAL_TAX = 200
export const PF_RATE = 0.12
export const PF_CAP = 1800

export interface Payslip {
  month: string
  workingDays: number
  lopDays: number
  payableDays: number
  earnings: { basic: number; hra: number; allowances: number; gross: number }
  deductions: { pf: number; professionalTax: number; lop: number; total: number }
  net: number
}

const round = (n: number) => Math.round(n)

/** Loss of pay = absent days + half of half days. Unmarked days are not deducted. */
export function payslip(emp: Employee, month: string, attendance: AttendanceRecord[], holidays: Holiday[]): Payslip {
  const [from, to] = monthRange(month)
  const sum = attendanceSummary(emp.id, from, to, attendance, holidays)
  const lopDays = sum.absent + sum.halfDay * 0.5
  const { basic, hra, allowances } = emp.salary
  const gross = basic + hra + allowances
  const perDay = sum.workingDays > 0 ? gross / sum.workingDays : 0
  const lop = round(perDay * lopDays)
  const earnedBasic = sum.workingDays > 0 ? basic * ((sum.workingDays - lopDays) / sum.workingDays) : basic
  const pf = Math.min(PF_CAP, round(earnedBasic * PF_RATE))
  const professionalTax = gross > 0 ? PROFESSIONAL_TAX : 0
  const total = pf + professionalTax + lop
  return {
    month,
    workingDays: sum.workingDays,
    lopDays,
    payableDays: sum.workingDays - lopDays,
    earnings: { basic, hra, allowances, gross },
    deductions: { pf, professionalTax, lop, total },
    net: gross - total,
  }
}

// ---------- ATS (recruitment) ----------

export const STAGES: CandidateStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']
/** The forward path a candidate moves along; 'rejected' can be reached from any open stage. */
export const PIPELINE: CandidateStage[] = ['applied', 'screening', 'interview', 'offer', 'hired']

export const STAGE_META: Record<CandidateStage, { label: string; tone: Tone }> = {
  applied: { label: 'Applied', tone: 'neutral' },
  screening: { label: 'Screening', tone: 'info' },
  interview: { label: 'Interview', tone: 'plum' },
  offer: { label: 'Offer', tone: 'warn' },
  hired: { label: 'Hired', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'bad' },
}

export const JOB_STATUS_META: Record<Job['status'], { label: string; tone: Tone }> = {
  requested: { label: 'Awaiting HR approval', tone: 'warn' },
  open: { label: 'Open', tone: 'ok' },
  on_hold: { label: 'On hold', tone: 'neutral' },
  closed: { label: 'Closed', tone: 'bad' },
}

export function nextStage(stage: CandidateStage): CandidateStage | null {
  const i = PIPELINE.indexOf(stage)
  return i >= 0 && i < PIPELINE.length - 1 ? PIPELINE[i + 1] : null
}

/** HR sees every job; a manager sees the jobs they are hiring manager for; employees see none. */
export function visibleJobs(session: Session, jobs: Job[]): Job[] {
  if (session.role === 'hr') return jobs
  if (session.role === 'manager') return jobs.filter((j) => j.hiringManagerId === session.employeeId)
  return []
}

export function canManageJob(session: Session, job: Job): boolean {
  return session.role === 'hr' || (session.role === 'manager' && job.hiringManagerId === session.employeeId)
}

/** Interviews this session may see: HR all; managers those they conduct or that belong to their jobs. */
export function visibleInterviews(session: Session, interviews: Interview[], candidates: Candidate[], jobs: Job[]): Interview[] {
  if (session.role === 'hr') return interviews
  if (session.role !== 'manager') return []
  const myJobs = new Set(visibleJobs(session, jobs).map((j) => j.id))
  const myCands = new Set(candidates.filter((c) => myJobs.has(c.jobId)).map((c) => c.id))
  return interviews.filter((i) => i.interviewerId === session.employeeId || myCands.has(i.candidateId))
}

export function pipelineCounts(jobId: string, candidates: Candidate[]): Record<CandidateStage, number> {
  const out = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<CandidateStage, number>
  for (const c of candidates) if (c.jobId === jobId) out[c.stage]++
  return out
}

export function averageInterviewRating(candidateId: string, interviews: Interview[]): number | null {
  const rs = interviews.filter((i) => i.candidateId === candidateId && i.status === 'completed' && i.rating).map((i) => i.rating!)
  return rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10 : null
}

// ---------- PMS (performance) ----------

export const PHASE_META: Record<ReviewCycle['phase'], { label: string; tone: Tone }> = {
  goal_setting: { label: 'Goal setting', tone: 'info' },
  review: { label: 'Review in progress', tone: 'warn' },
  closed: { label: 'Closed', tone: 'neutral' },
}

export const RATING_LABEL: Record<number, string> = {
  1: 'Needs improvement',
  2: 'Partly meets expectations',
  3: 'Meets expectations',
  4: 'Exceeds expectations',
  5: 'Outstanding',
}

/** Suggested appraisal increment (%) for a final rating. */
export const INCREMENT_FOR_RATING: Record<number, number> = { 1: 0, 2: 3, 3: 6, 4: 10, 5: 15 }

export function suggestedIncrement(rating: number): number {
  return INCREMENT_FOR_RATING[Math.round(rating)] ?? 0
}

/** Who reviews an employee: their manager, or HR when they have none. The HR admin is not reviewed in the app. */
export function reviewerOf(emp: Employee): string | null {
  return emp.managerId ?? (emp.id === 'e01' ? null : 'e01')
}

export function cycleParticipants(cycle: ReviewCycle, employees: Employee[]): Employee[] {
  return employees.filter((e) => e.active && e.joinDate <= cycle.to && reviewerOf(e) !== null)
}

/** May this session act as reviewer for the employee (approve goals, give manager rating)? */
export function canReview(session: Session, emp: Employee): boolean {
  if (session.employeeId === emp.id) return false
  return session.role === 'hr' || reviewerOf(emp) === session.employeeId
}

export function goalWeightTotal(goals: Goal[]): number {
  return goals.reduce((s, g) => s + g.weight, 0)
}

/** Weighted average of per-goal ratings, rounded to one decimal. Null if any goal is unrated. */
export function weightedRating(goals: Goal[], key: 'selfRating' | 'managerRating'): number | null {
  if (!goals.length || goals.some((g) => !g[key])) return null
  const w = goalWeightTotal(goals)
  if (!w) return null
  return Math.round((goals.reduce((s, g) => s + g[key]! * g.weight, 0) / w) * 10) / 10
}

export type ReviewStage = 'goals_pending' | 'self_pending' | 'manager_pending' | 'hr_pending' | 'finalised'

export const REVIEW_STAGE_META: Record<ReviewStage, { label: string; tone: Tone }> = {
  goals_pending: { label: 'Goals not approved', tone: 'neutral' },
  self_pending: { label: 'Self review pending', tone: 'info' },
  manager_pending: { label: 'Manager review pending', tone: 'plum' },
  hr_pending: { label: 'Awaiting HR', tone: 'warn' },
  finalised: { label: 'Finalised', tone: 'ok' },
}

export function reviewStage(goals: Goal[], review: Review | undefined): ReviewStage {
  if (review?.finalRating) return 'finalised'
  if (review?.managerRating) return 'hr_pending'
  if (review?.selfRating) return 'manager_pending'
  if (!goals.length || goals.some((g) => !g.approved)) return 'goals_pending'
  return 'self_pending'
}

/** Applies an increment to every salary component, rounded to the nearest rupee. */
export function applyIncrement(salary: Employee['salary'], pct: number): Employee['salary'] {
  const f = 1 + pct / 100
  return { basic: Math.round(salary.basic * f), hra: Math.round(salary.hra * f), allowances: Math.round(salary.allowances * f) }
}

// ---------- Formatting & masking ----------

export function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export function maskPAN(pan: string): string {
  return pan.length === 10 ? `${pan.slice(0, 5)}****${pan.slice(9)}` : '—'
}

export function maskAccount(acc: string): string {
  return acc.length >= 4 ? `XXXX${acc.slice(-4)}` : '—'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}
