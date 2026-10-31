// Rule-based HR assistant. Each role has its own topics; answers are computed from live HRMS data
// through the same rules the screens use, and are limited to what the role may see.
import { addDays, fmtDate, fmtDay, fmtMonth, monthOf } from './date'
import {
  JOB_STATUS_META, PHASE_META, RATING_LABEL, REVIEW_STAGE_META, STAGE_META, cycleParticipants, pipelineCounts, reviewStage, visibleInterviews, visibleJobs,
  LEAVE_NAMES, LEAVE_QUOTA, STATUS_META, allBalances, attendanceSummary, directReports, inr, isWorkingDay, monthRange, payslip, scopeEmployees,
} from './rules'
import type { Employee, HRMSData, Session } from './types'

export type Page = 'dashboard' | 'employees' | 'attendance' | 'leave' | 'recruitment' | 'performance' | 'payroll' | 'reports'

export interface BotReply {
  text: string
  actions?: { label: string; page: Page }[]
}

export interface BotContext {
  session: Session
  data: HRMSData
  today: string
}

export const BOT_PROFILES: Record<Session['role'], { title: string; intro: string; suggestions: string[] }> = {
  employee: {
    title: 'My HR Assistant',
    intro: 'Hi! I can help with your attendance, leave balance, payslip, holidays and HR policies.',
    suggestions: ['My leave balance', 'My attendance this month', 'My goals and review', 'Show my payslip', 'Upcoming holidays', 'Leave policy'],
  },
  manager: {
    title: 'Manager Assistant',
    intro: 'Hello! Ask me about your team: who is absent today, pending approvals, attendance rates and more.',
    suggestions: ["Who is absent today?", 'Pending leave approvals', 'My upcoming interviews', 'Team review status', 'Team attendance this month', 'My hiring pipeline', 'Frequent absentees'],
  },
  hr: {
    title: 'HR Copilot',
    intro: 'Welcome! I can summarise headcount, attendance, leave and payroll across the company.',
    suggestions: ['Headcount by department', "Today's attendance overview", 'Open positions', 'Reviews awaiting HR', 'Pending leave requests', 'Payroll cost this month', 'Rating distribution'],
  },
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w))

function nameOf(data: HRMSData, id: string | null | undefined) {
  return data.employees.find((e) => e.id === id)?.name ?? '—'
}

function findMentioned(q: string, pool: Employee[]): Employee | undefined {
  return pool.find((e) => {
    const parts = e.name.toLowerCase().split(' ')
    return q.includes(e.name.toLowerCase()) || parts.some((p) => p.length > 2 && new RegExp(`\\b${p}\\b`).test(q))
  })
}

function summaryLine(e: Employee, ctx: BotContext): string {
  const [from, to] = monthRange(monthOf(ctx.today), ctx.today)
  const s = attendanceSummary(e.id, from, to, ctx.data.attendance, ctx.data.holidays)
  return `**${e.name}** (${e.designation}): ${s.rate}% attendance in ${fmtMonth(monthOf(ctx.today))}, ${s.present} present, ${s.wfh} WFH, ${s.halfDay} half day, ${s.absent} absent, ${s.leave} leave, ${s.unmarked} unmarked.`
}

function todayStatusList(pool: Employee[], ctx: BotContext) {
  const recs = new Map(ctx.data.attendance.filter((a) => a.date === ctx.today).map((a) => [a.employeeId, a.status]))
  const groups: Record<string, Employee[]> = { present: [], wfh: [], half_day: [], absent: [], leave: [], unmarked: [] }
  for (const e of pool) groups[recs.get(e.id) ?? 'unmarked']?.push(e)
  return groups
}

// ---------- Shared topics ----------

function holidays(ctx: BotContext): BotReply {
  const next = ctx.data.holidays.filter((h) => h.date >= ctx.today).slice(0, 5)
  if (!next.length) return { text: 'There are no more holidays on the calendar this year.' }
  return { text: `Upcoming holidays:\n${next.map((h) => `• ${fmtDay(h.date)}: ${h.name}`).join('\n')}` }
}

function policy(): BotReply {
  return {
    text:
      `**Leave policy (per calendar year)**\n` +
      `• Casual Leave (CL): ${LEAVE_QUOTA.CL} days\n• Sick Leave (SL): ${LEAVE_QUOTA.SL} days\n• Earned Leave (EL): ${LEAVE_QUOTA.EL} days\n` +
      `• Leave counts working days only; Sundays and public holidays are skipped.\n` +
      `• Requests go to your reporting manager (HR for staff without a manager).\n` +
      `• Pending requests reduce your available balance until they are decided.\n` +
      `• Absent days and half of each half day are treated as Loss of Pay in payroll.`,
    actions: [{ label: 'Open Leave', page: 'leave' }],
  }
}

function attendancePolicy(): BotReply {
  return {
    text:
      `**Attendance rules**\n• Attendance is marked manually each working day by HR or your reporting manager.\n` +
      `• Statuses: Present, Work from home, Half day, Absent, On leave, Holiday.\n` +
      `• Office hours are 9:00 to 18:00; Sundays and public holidays are off.\n` +
      `• If your attendance is wrong, ask your manager or HR to correct it.`,
  }
}

function myBalance(ctx: BotContext): BotReply {
  const bal = allBalances(ctx.session.employeeId, ctx.data.leaves, ctx.today.slice(0, 4))
  return {
    text: `Your leave balance for ${ctx.today.slice(0, 4)}:\n${bal
      .map((b) => `• ${LEAVE_NAMES[b.type]}: **${b.available}** available (${b.used} used, ${b.pending} pending, of ${b.quota})`)
      .join('\n')}`,
    actions: [{ label: 'Apply for leave', page: 'leave' }],
  }
}

function myAttendance(ctx: BotContext): BotReply {
  const me = ctx.data.employees.find((e) => e.id === ctx.session.employeeId)!
  const todayRec = ctx.data.attendance.find((a) => a.employeeId === me.id && a.date === ctx.today)
  return {
    text: `${summaryLine(me, ctx)}\nToday: ${todayRec ? STATUS_META[todayRec.status].label : 'not marked yet'}.`,
    actions: [{ label: 'View attendance', page: 'attendance' }],
  }
}

function myPayslip(ctx: BotContext): BotReply {
  const me = ctx.data.employees.find((e) => e.id === ctx.session.employeeId)!
  const month = monthOf(ctx.today)
  const p = payslip(me, month, ctx.data.attendance, ctx.data.holidays)
  return {
    text:
      `Payslip estimate for ${fmtMonth(month)}:\n• Gross: ${inr(p.earnings.gross)}\n• Deductions: ${inr(p.deductions.total)} ` +
      `(PF ${inr(p.deductions.pf)}, Prof. tax ${inr(p.deductions.professionalTax)}, LOP ${inr(p.deductions.lop)})\n• **Net pay: ${inr(p.net)}**\n` +
      `LOP days so far: ${p.lopDays}.`,
    actions: [{ label: 'Open payslip', page: 'payroll' }],
  }
}

function myManager(ctx: BotContext): BotReply {
  const me = ctx.data.employees.find((e) => e.id === ctx.session.employeeId)!
  const m = ctx.data.employees.find((e) => e.id === me.managerId)
  return { text: m ? `You report to **${m.name}** (${m.designation}), ${m.email}.` : 'You report directly to HR (Priya Naik).' }
}

// ---------- Manager / HR topics ----------

function absentToday(pool: Employee[], ctx: BotContext): BotReply {
  const g = todayStatusList(pool, ctx)
  const list = (label: string, xs: Employee[]) => (xs.length ? `• ${label}: ${xs.map((e) => e.name).join(', ')}` : '')
  const lines = [list('Absent', g.absent), list('On leave', g.leave), list('Half day', g.half_day)].filter(Boolean)
  if (!isWorkingDay(ctx.today, ctx.data.holidays)) return { text: `Today (${fmtDay(ctx.today)}) is not a working day.` }
  return {
    text: lines.length
      ? `Out today (${fmtDay(ctx.today)}):\n${lines.join('\n')}${g.unmarked.length ? `\n${g.unmarked.length} not marked yet.` : ''}`
      : `Nobody is marked absent or on leave today.${g.unmarked.length ? ` ${g.unmarked.length} still need to be marked.` : ''}`,
    actions: [{ label: 'Mark attendance', page: 'attendance' }],
  }
}

function unmarkedToday(pool: Employee[], ctx: BotContext): BotReply {
  if (!isWorkingDay(ctx.today, ctx.data.holidays)) return { text: `Today (${fmtDay(ctx.today)}) is not a working day, so nothing needs marking.` }
  const g = todayStatusList(pool, ctx)
  return {
    text: g.unmarked.length
      ? `${g.unmarked.length} of ${pool.length} still need attendance marked today:\n${g.unmarked.map((e) => `• ${e.name}`).join('\n')}`
      : `All ${pool.length} have attendance marked for today.`,
    actions: [{ label: 'Mark attendance', page: 'attendance' }],
  }
}

function todayOverview(pool: Employee[], ctx: BotContext): BotReply {
  const g = todayStatusList(pool, ctx)
  return {
    text:
      `Attendance today (${fmtDay(ctx.today)}), ${pool.length} people:\n` +
      `• Present: ${g.present.length}\n• Work from home: ${g.wfh.length}\n• Half day: ${g.half_day.length}\n` +
      `• Absent: ${g.absent.length}\n• On leave: ${g.leave.length}\n• Not marked: ${g.unmarked.length}`,
    actions: [{ label: 'Mark attendance', page: 'attendance' }],
  }
}

function pendingApprovals(pool: Employee[], ctx: BotContext): BotReply {
  const ids = new Set(pool.map((e) => e.id))
  const pending = ctx.data.leaves.filter((l) => l.status === 'pending' && ids.has(l.employeeId) && l.employeeId !== ctx.session.employeeId)
  if (!pending.length) return { text: 'No leave requests are waiting for approval. 🎉' }
  return {
    text: `${pending.length} request(s) awaiting your decision:\n${pending
      .map((l) => `• ${nameOf(ctx.data, l.employeeId)}: ${l.type}, ${fmtDate(l.from)}${l.to !== l.from ? ` to ${fmtDate(l.to)}` : ''} (${l.days} day${l.days === 1 ? '' : 's'}) — "${l.reason}"`)
      .join('\n')}`,
    actions: [{ label: 'Review requests', page: 'leave' }],
  }
}

function teamAttendance(pool: Employee[], ctx: BotContext): BotReply {
  if (!pool.length) return { text: 'There is nobody in your scope.' }
  const [from, to] = monthRange(monthOf(ctx.today), ctx.today)
  const rows = pool.map((e) => ({ e, s: attendanceSummary(e.id, from, to, ctx.data.attendance, ctx.data.holidays) }))
  const avg = Math.round((rows.reduce((s, r) => s + r.s.rate, 0) / rows.length) * 10) / 10
  rows.sort((a, b) => b.s.rate - a.s.rate)
  return {
    text: `Average attendance in ${fmtMonth(monthOf(ctx.today))}: **${avg}%**\n${rows.map((r) => `• ${r.e.name}: ${r.s.rate}%`).join('\n')}`,
    actions: [{ label: 'Open reports', page: 'reports' }],
  }
}

function absentees(pool: Employee[], ctx: BotContext, threshold?: number): BotReply {
  const from = addDays(ctx.today, -30)
  const rows = pool
    .map((e) => ({ e, s: attendanceSummary(e.id, from, ctx.today, ctx.data.attendance, ctx.data.holidays) }))
    .filter((r) => (threshold ? r.s.rate < threshold : r.s.absent + r.s.halfDay > 0))
    .sort((a, b) => (threshold ? a.s.rate - b.s.rate : b.s.absent + b.s.halfDay * 0.5 - (a.s.absent + a.s.halfDay * 0.5)))
    .slice(0, 8)
  if (!rows.length) return { text: threshold ? `Everyone is above ${threshold}% attendance in the last 30 days.` : 'No absences in the last 30 days.' }
  return {
    text: `${threshold ? `Below ${threshold}% attendance` : 'Most absences'} (last 30 days):\n${rows
      .map((r) => `• ${r.e.name}: ${r.s.absent} absent, ${r.s.halfDay} half day, ${r.s.rate}% attendance`)
      .join('\n')}`,
    actions: [{ label: 'Open reports', page: 'reports' }],
  }
}

function upcomingLeave(pool: Employee[], ctx: BotContext): BotReply {
  const ids = new Set(pool.map((e) => e.id))
  const end = addDays(ctx.today, 7)
  const ls = ctx.data.leaves.filter((l) => ids.has(l.employeeId) && (l.status === 'approved' || l.status === 'pending') && l.from <= end && l.to >= ctx.today)
  if (!ls.length) return { text: 'No leave planned in the next 7 days.' }
  return {
    text: `Leave in the next 7 days:\n${ls
      .map((l) => `• ${nameOf(ctx.data, l.employeeId)}: ${l.type} ${fmtDate(l.from)}${l.to !== l.from ? ` – ${fmtDate(l.to)}` : ''} (${l.status})`)
      .join('\n')}`,
  }
}

function teamList(pool: Employee[], ctx: BotContext): BotReply {
  return {
    text: `${ctx.session.role === 'hr' ? 'Active employees' : 'Your team'} (${pool.filter((e) => e.active).length}):\n${pool
      .filter((e) => e.active)
      .map((e) => `• ${e.name}, ${e.designation}`)
      .join('\n')}`,
    actions: [{ label: 'Open directory', page: 'employees' }],
  }
}

function headcount(ctx: BotContext): BotReply {
  const active = ctx.data.employees.filter((e) => e.active)
  const byDept = new Map<string, number>()
  const byLoc = new Map<string, number>()
  for (const e of active) {
    byDept.set(e.department, (byDept.get(e.department) ?? 0) + 1)
    byLoc.set(e.location, (byLoc.get(e.location) ?? 0) + 1)
  }
  return {
    text:
      `Active headcount: **${active.length}** (${ctx.data.employees.length - active.length} inactive)\n` +
      [...byDept].sort((a, b) => b[1] - a[1]).map(([d, n]) => `• ${d}: ${n}`).join('\n') +
      `\nBy location: ${[...byLoc].map(([l, n]) => `${l} ${n}`).join(', ')}`,
    actions: [{ label: 'Open directory', page: 'employees' }],
  }
}

function payrollCost(ctx: BotContext): BotReply {
  const month = monthOf(ctx.today)
  const slips = ctx.data.employees.filter((e) => e.active).map((e) => payslip(e, month, ctx.data.attendance, ctx.data.holidays))
  const gross = slips.reduce((s, p) => s + p.earnings.gross, 0)
  const net = slips.reduce((s, p) => s + p.net, 0)
  const pf = slips.reduce((s, p) => s + p.deductions.pf, 0)
  const lop = slips.reduce((s, p) => s + p.deductions.lop, 0)
  return {
    text: `Payroll for ${fmtMonth(month)} (${slips.length} employees, attendance so far):\n• Gross: ${inr(gross)}\n• Net payout: **${inr(net)}**\n• Employee PF: ${inr(pf)}\n• Loss of pay: ${inr(lop)}`,
    actions: [{ label: 'Open payroll', page: 'payroll' }],
  }
}

function newJoiners(ctx: BotContext): BotReply {
  const since = addDays(ctx.today, -365)
  const js = ctx.data.employees.filter((e) => e.joinDate >= since).sort((a, b) => b.joinDate.localeCompare(a.joinDate))
  if (!js.length) return { text: 'No one joined in the last 12 months.' }
  return { text: `Joined in the last 12 months:\n${js.map((e) => `• ${e.name}, ${e.designation} (${e.department}), joined ${fmtDate(e.joinDate)}`).join('\n')}` }
}

// ---------- ATS topics ----------

function hiringSummary(ctx: BotContext): BotReply {
  const jobs = visibleJobs(ctx.session, ctx.data.jobs).filter((j) => j.status !== 'closed')
  if (!jobs.length) return { text: ctx.session.role === 'hr' ? 'There are no active job openings.' : 'You have no active hiring requests. You can raise one from Recruitment.', actions: [{ label: 'Open Recruitment', page: 'recruitment' }] }
  return {
    text: `Active jobs (${jobs.length}):\n${jobs
      .map((j) => {
        const c = pipelineCounts(j.id, ctx.data.candidates)
        return `• **${j.title}** (${JOB_STATUS_META[j.status].label}, ${c.hired}/${j.openings} filled): ${c.applied} applied, ${c.screening} screening, ${c.interview} interview, ${c.offer} offer`
      })
      .join('\n')}`,
    actions: [{ label: 'Open Recruitment', page: 'recruitment' }],
  }
}

function myInterviews(ctx: BotContext): BotReply {
  const ivs = visibleInterviews(ctx.session, ctx.data.interviews, ctx.data.candidates, ctx.data.jobs)
    .filter((i) => i.status === 'scheduled' && (ctx.session.role !== 'manager' || i.interviewerId === ctx.session.employeeId))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  if (!ivs.length) return { text: 'No interviews are scheduled.', actions: [{ label: 'Open Recruitment', page: 'recruitment' }] }
  const cand = (id: string) => ctx.data.candidates.find((c) => c.id === id)
  const job = (id: string) => ctx.data.jobs.find((j) => j.id === cand(id)?.jobId)
  return {
    text: `Upcoming interviews:\n${ivs
      .map((i) => `• ${fmtDay(i.date)} ${i.time}: **${cand(i.candidateId)?.name}** for ${job(i.candidateId)?.title} (${i.round}, ${i.mode})${ctx.session.role === 'hr' ? ` with ${nameOf(ctx.data, i.interviewerId)}` : ''}${i.date < ctx.today ? ' — feedback overdue' : ''}`)
      .join('\n')}`,
    actions: [{ label: 'Open interviews', page: 'recruitment' }],
  }
}

function candidateLookup(q: string, ctx: BotContext): BotReply | null {
  const jobs = new Set(visibleJobs(ctx.session, ctx.data.jobs).map((j) => j.id))
  const c = ctx.data.candidates.find((x) => jobs.has(x.jobId) && x.name.toLowerCase().split(' ').some((p) => p.length > 2 && new RegExp(`\\b${p}\\b`).test(q)))
  if (!c) return null
  const j = ctx.data.jobs.find((x) => x.id === c.jobId)!
  const ivs = ctx.data.interviews.filter((i) => i.candidateId === c.id && i.status === 'completed')
  return {
    text: `**${c.name}** — candidate for ${j.title}\n• Stage: ${STAGE_META[c.stage].label}\n• ${c.experience} yrs, ${c.currentCompany || '—'}, expects ${inr(c.expectedSalary)}/month\n${ivs.length ? ivs.map((i) => `• ${i.round}: ${i.rating}/5, ${i.recommendation === 'hire' ? 'hire' : 'no hire'} (${nameOf(ctx.data, i.interviewerId)})`).join('\n') : '• No interview feedback yet'}`,
    actions: [{ label: 'Open pipeline', page: 'recruitment' }],
  }
}

// ---------- PMS topics ----------

function activeCycle(ctx: BotContext) {
  return ctx.data.cycles.find((c) => c.phase !== 'closed') ?? ctx.data.cycles[ctx.data.cycles.length - 1]
}

function reviewLine(ctx: BotContext, cycleId: string, empId: string) {
  const goals = ctx.data.goals.filter((g) => g.cycleId === cycleId && g.employeeId === empId)
  const rev = ctx.data.reviews.find((r) => r.cycleId === cycleId && r.employeeId === empId)
  return { goals, rev, stage: reviewStage(goals, rev) }
}

function myReview(ctx: BotContext, empId = ctx.session.employeeId): BotReply {
  const cycle = activeCycle(ctx)
  if (!cycle) return { text: 'No review cycle has been started yet.' }
  const { goals, rev, stage } = reviewLine(ctx, cycle.id, empId)
  const self = empId === ctx.session.employeeId
  if (!goals.length) return { text: `${self ? 'You have' : `${nameOf(ctx.data, empId)} has`} no goals in ${cycle.name} yet.`, actions: [{ label: 'Open Performance', page: 'performance' }] }
  const lines = goals.map((g) => `• ${g.title} (${g.weight}%): ${g.progress}% done${g.approved ? '' : ', awaiting approval'}`)
  const last = ctx.data.cycles.filter((c) => c.phase === 'closed').map((c) => ({ c, r: ctx.data.reviews.find((r) => r.cycleId === c.id && r.employeeId === empId) })).filter((x) => x.r?.finalRating).pop()
  return {
    text:
      `${self ? 'Your' : `${nameOf(ctx.data, empId)}'s`} goals in **${cycle.name}** (${PHASE_META[cycle.phase].label}):\n${lines.join('\n')}\n` +
      `Status: **${REVIEW_STAGE_META[stage].label}**` +
      (rev?.selfRating ? ` · self ${rev.selfRating}` : '') + (rev?.managerRating ? ` · manager ${rev.managerRating}` : '') +
      (rev?.finalRating ? ` · final ${rev.finalRating} (${RATING_LABEL[rev.finalRating]}), increment ${rev.incrementPct}%` : '') +
      (last ? `\nLast cycle (${last.c.name}): rated **${last.r!.finalRating}** — ${RATING_LABEL[last.r!.finalRating!]}, ${last.r!.incrementPct}% increment.` : ''),
    actions: [{ label: 'Open Performance', page: 'performance' }],
  }
}

function teamReviews(pool: Employee[], ctx: BotContext, onlyStage?: string): BotReply {
  const cycle = activeCycle(ctx)
  if (!cycle) return { text: 'No review cycle has been started yet.' }
  const ids = new Set(cycleParticipants(cycle, ctx.data.employees).map((e) => e.id))
  const rows = pool.filter((e) => ids.has(e.id)).map((e) => ({ e, ...reviewLine(ctx, cycle.id, e.id) })).filter((r) => !onlyStage || r.stage === onlyStage)
  if (!rows.length) return { text: onlyStage ? `Nothing is ${REVIEW_STAGE_META[onlyStage as keyof typeof REVIEW_STAGE_META].label.toLowerCase()} in ${cycle.name}.` : `Nobody in your scope is part of ${cycle.name}.`, actions: [{ label: 'Open Performance', page: 'performance' }] }
  const byStage = new Map<string, string[]>()
  for (const r of rows) byStage.set(r.stage, [...(byStage.get(r.stage) ?? []), r.e.name])
  return {
    text: `${cycle.name} (${PHASE_META[cycle.phase].label}) — ${rows.length} people:\n${[...byStage]
      .map(([st, names]) => `• ${REVIEW_STAGE_META[st as keyof typeof REVIEW_STAGE_META].label} (${names.length}): ${names.join(', ')}`)
      .join('\n')}`,
    actions: [{ label: 'Open Performance', page: 'performance' }],
  }
}

function ratingDistribution(ctx: BotContext): BotReply {
  const cycle = [...ctx.data.cycles].reverse().find((c) => ctx.data.reviews.some((r) => r.cycleId === c.id && r.finalRating))
  if (!cycle) return { text: 'No reviews have been finalised yet.' }
  const fins = ctx.data.reviews.filter((r) => r.cycleId === cycle.id && r.finalRating)
  const avg = fins.reduce((s, r) => s + r.finalRating!, 0) / fins.length
  return {
    text: `Final ratings in **${cycle.name}** (${fins.length} employees, average ${avg.toFixed(1)}):\n${[5, 4, 3, 2, 1]
      .map((n) => `• ${n} — ${RATING_LABEL[n]}: ${fins.filter((r) => r.finalRating === n).length}`)
      .join('\n')}\nAverage increment: ${(fins.reduce((s, r) => s + (r.incrementPct ?? 0), 0) / fins.length).toFixed(1)}%`,
    actions: [{ label: 'Open Performance', page: 'performance' }],
  }
}

function help(role: Session['role']): BotReply {
  return { text: `Here are some things you can ask me:\n${BOT_PROFILES[role].suggestions.map((s) => `• ${s}`).join('\n')}` }
}

// ---------- Router ----------

export function answer(question: string, ctx: BotContext): BotReply {
  const q = question.toLowerCase().trim()
  const role = ctx.session.role
  if (!q) return help(role)
  const pool = scopeEmployees(ctx.session, ctx.data.employees).filter((e) => e.active)

  if (/^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/.test(q)) return { text: BOT_PROFILES[role].intro }
  if (has(q, 'help', 'what can you', 'options')) return help(role)
  if (has(q, 'thank')) return { text: "You're welcome! Anything else?" }
  if (has(q, 'holiday')) return holidays(ctx)

  if (role === 'employee') {
    if (has(q, 'other', 'colleague', 'team', 'everyone', 'salary of', 'all employees', 'payroll of'))
      return { text: "Sorry, I can only share your own information. For anything about other employees, please contact HR." }
    if (has(q, 'interview', 'candidate', 'hiring', 'recruit', 'job opening', 'vacanc'))
      return { text: 'Recruitment is handled by HR and hiring managers. Ask HR about internal job openings or referrals.' }
    if (has(q, 'goal', 'kra', 'review', 'appraisal', 'rating', 'performance', 'increment', 'hike')) return myReview(ctx)
    if (has(q, 'balance', 'how many leave', 'leaves left', 'remaining')) return myBalance(ctx)
    if (has(q, 'apply', 'request leave', 'take leave', 'how do i')) {
      return { text: 'To apply for leave: open **Leave** → **Apply for leave**, choose the type and dates, add a reason and submit. Your manager will be notified to approve it.', actions: [{ label: 'Apply now', page: 'leave' }] }
    }
    if (has(q, 'policy', 'rule', 'quota', 'entitle')) return has(q, 'attendance') ? attendancePolicy() : policy()
    if (has(q, 'pay', 'salary', 'slip', 'ctc', 'net')) return myPayslip(ctx)
    if (has(q, 'attendance', 'present', 'absent', 'late', 'marked')) return myAttendance(ctx)
    if (has(q, 'manager', 'report to', 'boss')) return myManager(ctx)
    if (has(q, 'leave', 'status', 'request')) {
      const mine = ctx.data.leaves.filter((l) => l.employeeId === ctx.session.employeeId).slice(-5).reverse()
      if (!mine.length) return { text: "You haven't applied for any leave yet.", actions: [{ label: 'Apply for leave', page: 'leave' }] }
      return { text: `Your recent leave requests:\n${mine.map((l) => `• ${l.type} ${fmtDate(l.from)}${l.to !== l.from ? ` – ${fmtDate(l.to)}` : ''}: **${l.status}**`).join('\n')}` }
    }
    return { text: "I didn't quite get that. I can help with your leave balance, attendance, payslip, holidays and policies.", actions: [] }
  }

  // Manager and HR share most team topics; the pool limits what they can see.
  const person = findMentioned(q, pool)
  if (person && has(q, 'attendance', 'present', 'absent', 'how is', 'record')) return { text: summaryLine(person, ctx) }
  if (person && has(q, 'leave', 'balance')) {
    const bal = allBalances(person.id, ctx.data.leaves, ctx.today.slice(0, 4))
    return { text: `${person.name}'s leave balance: ${bal.map((b) => `${b.type} ${b.available}/${b.quota}`).join(', ')}` }
  }
  if (person && role === 'hr' && has(q, 'salary', 'pay', 'ctc')) {
    const p = payslip(person, monthOf(ctx.today), ctx.data.attendance, ctx.data.holidays)
    return { text: `${person.name}: gross ${inr(p.earnings.gross)}/month, net this month ${inr(p.net)} (LOP ${p.lopDays} days).`, actions: [{ label: 'Open payroll', page: 'payroll' }] }
  }
  if (person && has(q, 'who is', 'details', 'contact', 'info', 'about', 'find', 'email', 'phone')) {
    return { text: `**${person.name}** (${person.code})\n• ${person.designation}, ${person.department}\n• ${person.location}\n• ${person.email} · ${person.phone}\n• Reports to: ${nameOf(ctx.data, person.managerId)}\n• Joined ${fmtDate(person.joinDate)}` }
  }
  if (person && has(q, 'goal', 'review', 'rating', 'appraisal', 'performance')) return myReview(ctx, person.id)
  if (has(q, 'my goal', 'my review', 'my rating', 'my appraisal')) return myReview(ctx)
  if (has(q, 'interview')) return myInterviews(ctx)
  if (has(q, 'candidate', 'applicant')) {
    const c = candidateLookup(q, ctx)
    if (c) return c
    return hiringSummary(ctx)
  }
  if (has(q, 'open position', 'opening', 'hiring', 'recruit', 'vacanc', 'pipeline', 'job')) {
    const c = candidateLookup(q, ctx)
    return c ?? hiringSummary(ctx)
  }
  if (role === 'hr' && has(q, 'distribution', 'bell curve')) return ratingDistribution(ctx)
  if (has(q, 'review', 'appraisal', 'goal', 'kra', 'performance', 'rating')) {
    if (role === 'hr' && has(q, 'awaiting hr', 'finalise', 'pending')) return teamReviews(pool, ctx, 'hr_pending')
    if (role === 'manager' && has(q, 'pending')) return teamReviews(pool, ctx, 'manager_pending')
    return teamReviews(pool, ctx)
  }
  {
    const c = candidateLookup(q, ctx)
    if (c && !person) return c
  }
  if (!person && /\b(salary|pay|payroll|ctc)\b/.test(q) && role === 'manager')
    return { text: 'Salary details are confidential and only available to HR. I can help with your team’s attendance and leave.' }

  if (has(q, 'unmarked', 'not marked', 'pending attendance', 'yet to mark')) return unmarkedToday(pool, ctx)
  if (has(q, 'absent today', 'who is absent', "who's absent", 'out today', 'on leave today', 'missing today', 'absent')) return absentToday(pool, ctx)
  if (has(q, 'overview', 'today') && has(q, 'attendance', 'today')) return todayOverview(pool, ctx)
  if (has(q, 'pending', 'approval', 'approve', 'requests')) return pendingApprovals(pool, ctx)
  if (has(q, 'low attendance', 'below', 'poor')) return absentees(pool, ctx, 90)
  if (has(q, 'frequent', 'absentee', 'most absent', 'absences')) return absentees(pool, ctx)
  if (has(q, 'next 7', 'next week', 'upcoming leave', 'planned', 'leave next')) return upcomingLeave(pool, ctx)
  if (has(q, 'rate', 'percentage', 'attendance this month', 'team attendance', 'attendance')) return teamAttendance(pool, ctx)
  if (role === 'hr' && has(q, 'headcount', 'department', 'how many employees', 'strength')) return headcount(ctx)
  if (role === 'hr' && has(q, 'payroll', 'salary', 'cost', 'payout')) return payrollCost(ctx)
  if (role === 'hr' && has(q, 'joiner', 'joined', 'new hire', 'recent')) return newJoiners(ctx)
  if (has(q, 'team', 'my reports', 'list', 'members', 'who reports')) {
    if (role === 'manager' && !directReports(ctx.session.employeeId, ctx.data.employees).length) return { text: 'You have no direct reports.' }
    return teamList(pool, ctx)
  }
  if (has(q, 'policy', 'rule', 'quota')) return has(q, 'attendance') ? attendancePolicy() : policy()
  if (has(q, 'my balance', 'my leave')) return myBalance(ctx)
  if (has(q, 'my payslip', 'my salary')) return myPayslip(ctx)
  return {
    text: `I didn't catch that. Try one of these: ${BOT_PROFILES[role].suggestions.slice(0, 3).map((s) => `"${s}"`).join(', ')}. You can also name a person, e.g. "attendance of ${pool[0]?.name.split(' ')[0] ?? 'Sneha'}".`,
  }
}
