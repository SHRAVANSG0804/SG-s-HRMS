// Rule-based HR assistant. Each role has its own topics; answers are computed from live HRMS data
// through the same rules the screens use, and are limited to what the role may see.
import { addDays, fmtDate, fmtDay, fmtMonth, monthOf } from './date'
import {
  LEAVE_NAMES, LEAVE_QUOTA, STATUS_META, allBalances, attendanceSummary, directReports, inr, isWorkingDay, monthRange, payslip, scopeEmployees,
} from './rules'
import type { Employee, HRMSData, Session } from './types'

export type Page = 'dashboard' | 'employees' | 'attendance' | 'leave' | 'payroll' | 'reports'

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
    suggestions: ['My leave balance', 'My attendance this month', 'Show my payslip', 'Upcoming holidays', 'How do I apply for leave?', 'Leave policy'],
  },
  manager: {
    title: 'Manager Assistant',
    intro: 'Hello! Ask me about your team: who is absent today, pending approvals, attendance rates and more.',
    suggestions: ["Who is absent today?", 'Pending leave approvals', 'Team attendance this month', 'Frequent absentees', 'Team leave next 7 days', 'Unmarked attendance today'],
  },
  hr: {
    title: 'HR Copilot',
    intro: 'Welcome! I can summarise headcount, attendance, leave and payroll across the company.',
    suggestions: ['Headcount by department', "Today's attendance overview", 'Pending leave requests', 'Payroll cost this month', 'Low attendance employees', 'New joiners'],
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
