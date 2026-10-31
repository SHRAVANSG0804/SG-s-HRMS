import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { daysBetweenInclusive, nowTimeIST, todayIST } from './date'
import {
  applyIncrement, canActOn, canManageJob, canReview, cycleParticipants, goalWeightTotal, isWorkingDay, leaveDays, reviewerOf, validateLeave, weightedRating,
} from './rules'
import { DATA_VERSION, seedData } from './seed'
import type {
  AttendanceRecord, Candidate, CandidateStage, CyclePhase, Employee, Goal, HRMSData, Holiday, Interview, Job, LeaveRequest, LeaveType, Review, ReviewCycle, Role, Session,
} from './types'

const DATA_KEY = 'sg-hrms:data'
const SESSION_KEY = 'sg-hrms:session'

// Demo passwords, one per role, as specified for this project.
// They are checked in the browser, so they keep honest users apart but are not real security.
export const ROLE_PASSWORDS: Record<Role, string> = { manager: '1234', hr: '5678', employee: '9101' }
export const HR_ADMIN_ID = 'e01'

function loadData(): HRMSData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as HRMSData
      if (parsed.version === DATA_VERSION) return parsed
    }
  } catch {
    // fall through to fresh seed
  }
  return seedData()
}

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

type Result = { ok: true } | { ok: false; error: string }
const ok: Result = { ok: true }
const fail = (error: string): Result => ({ ok: false, error })

export type AttendanceInput = Pick<AttendanceRecord, 'employeeId' | 'date' | 'status' | 'checkIn' | 'checkOut' | 'remarks'>
export type EmployeeInput = Omit<Employee, 'id' | 'code' | 'active'>
export type JobInput = Omit<Job, 'id' | 'status' | 'createdBy' | 'createdOn'>
export type CandidateInput = Omit<Candidate, 'id' | 'stage' | 'appliedOn' | 'employeeId'>
export type InterviewInput = Pick<Interview, 'candidateId' | 'interviewerId' | 'round' | 'date' | 'time' | 'mode'>
export type GoalInput = Pick<Goal, 'title' | 'description' | 'weight'>
export type HireInput = { designation: string; managerId: string | null; joinDate: string; location: string; salary: Employee['salary'] }

interface Store {
  data: HRMSData
  session: Session | null
  me: Employee | null
  login: (role: Role, password: string, employeeId: string) => Result
  logout: () => void
  saveAttendance: (rows: AttendanceInput[]) => Result
  clearAttendance: (employeeId: string, date: string) => Result
  addEmployee: (input: EmployeeInput) => Result
  updateEmployee: (id: string, input: EmployeeInput) => Result
  setEmployeeActive: (id: string, active: boolean) => Result
  applyLeave: (req: { type: LeaveType; from: string; to: string; reason: string }) => Result
  decideLeave: (id: string, decision: 'approved' | 'rejected', comment?: string) => Result
  cancelLeave: (id: string) => Result
  addHoliday: (h: Holiday) => Result
  removeHoliday: (date: string) => Result
  // ATS
  saveJob: (input: JobInput, id?: string) => Result
  setJobStatus: (id: string, status: Job['status']) => Result
  addCandidate: (input: CandidateInput) => Result
  moveCandidate: (id: string, stage: CandidateStage) => Result
  updateCandidateNotes: (id: string, notes: string) => Result
  scheduleInterview: (input: InterviewInput) => Result
  submitInterviewFeedback: (id: string, fb: { rating: number; recommendation: 'hire' | 'no_hire'; feedback: string }) => Result
  cancelInterview: (id: string) => Result
  hireCandidate: (id: string, input: HireInput) => Result
  // PMS
  createCycle: (c: Omit<ReviewCycle, 'id' | 'phase'>) => Result
  setCyclePhase: (id: string, phase: CyclePhase) => Result
  saveGoal: (cycleId: string, employeeId: string, input: GoalInput, id?: string) => Result
  deleteGoal: (id: string) => Result
  updateGoalProgress: (id: string, progress: number) => Result
  approveGoals: (cycleId: string, employeeId: string) => Result
  submitSelfReview: (cycleId: string, ratings: Record<string, number>, comments: string) => Result
  submitManagerReview: (cycleId: string, employeeId: string, ratings: Record<string, number>, comments: string) => Result
  finaliseReview: (cycleId: string, employeeId: string, finalRating: number, incrementPct: number) => Result
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HRMSData>(loadData)
  const [session, setSession] = useState<Session | null>(loadSession)

  useEffect(() => {
    localStorage.setItem(DATA_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  }, [session])

  const me = useMemo(() => data.employees.find((e) => e.id === session?.employeeId) ?? null, [data.employees, session])
  const stamp = () => `${todayIST()}T${nowTimeIST()}`

  const login = useCallback(
    (role: Role, password: string, employeeId: string): Result => {
      if (password !== ROLE_PASSWORDS[role]) return fail('Incorrect password for this role.')
      const id = role === 'hr' ? HR_ADMIN_ID : employeeId
      const emp = data.employees.find((e) => e.id === id && e.active)
      if (!emp) return fail('Select your profile to continue.')
      if (role === 'manager' && !data.employees.some((e) => e.managerId === id && e.active))
        return fail('This profile has no team members, so it cannot sign in as a manager.')
      window.location.hash = '/dashboard'
      setSession({ role, employeeId: id })
      return ok
    },
    [data.employees],
  )

  const logout = useCallback(() => {
    window.location.hash = ''
    setSession(null)
  }, [])

  const saveAttendance = (rows: AttendanceInput[]): Result => {
    if (!session) return fail('Not signed in.')
    for (const r of rows) {
      if (!canActOn(session, r.employeeId, data.employees)) return fail('You can only mark attendance for your own team.')
      if (r.date > todayIST()) return fail('Attendance cannot be marked for a future date.')
      if (r.checkIn && r.checkOut && r.checkOut < r.checkIn) return fail('Check-out time is before check-in time.')
    }
    setData((d) => {
      const keys = new Set(rows.map((r) => `${r.employeeId}|${r.date}`))
      const kept = d.attendance.filter((a) => !keys.has(`${a.employeeId}|${a.date}`))
      const added = rows.map((r) => ({ ...r, markedBy: session.employeeId, markedAt: stamp() }))
      return { ...d, attendance: [...kept, ...added] }
    })
    return ok
  }

  const clearAttendance = (employeeId: string, date: string): Result => {
    if (!session || !canActOn(session, employeeId, data.employees)) return fail('Not allowed.')
    setData((d) => ({ ...d, attendance: d.attendance.filter((a) => !(a.employeeId === employeeId && a.date === date)) }))
    return ok
  }

  const requireHR = (): Result | null => (session?.role === 'hr' ? null : fail('Only HR can do this.'))

  const validateEmployee = (input: EmployeeInput, selfId?: string): Result | null => {
    if (!input.name.trim()) return fail('Name is required.')
    if (!/^\S+@\S+\.\S+$/.test(input.email)) return fail('Enter a valid email address.')
    if (data.employees.some((e) => e.email.toLowerCase() === input.email.toLowerCase() && e.id !== selfId))
      return fail('Another employee already uses this email.')
    if (input.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(input.pan)) return fail('PAN must look like ABCDE1234F.')
    if (input.managerId && input.managerId === selfId) return fail('An employee cannot report to themselves.')
    if (input.salary.basic < 0 || input.salary.hra < 0 || input.salary.allowances < 0) return fail('Salary values cannot be negative.')
    return null
  }

  const addEmployee = (input: EmployeeInput): Result => {
    const denied = requireHR() ?? validateEmployee(input)
    if (denied) return denied
    setData((d) => {
      const nums = d.employees.map((e) => Number(e.id.slice(1)))
      const next = Math.max(0, ...nums) + 1
      const codes = d.employees.map((e) => Number(e.code.slice(2)))
      const emp: Employee = {
        ...input,
        id: `e${String(next).padStart(2, '0')}`,
        code: `SG${Math.max(1000, ...codes) + 1}`,
        active: true,
      }
      return { ...d, employees: [...d.employees, emp] }
    })
    return ok
  }

  const updateEmployee = (id: string, input: EmployeeInput): Result => {
    const denied = requireHR() ?? validateEmployee(input, id)
    if (denied) return denied
    setData((d) => ({ ...d, employees: d.employees.map((e) => (e.id === id ? { ...e, ...input } : e)) }))
    return ok
  }

  const setEmployeeActive = (id: string, active: boolean): Result => {
    const denied = requireHR()
    if (denied) return denied
    if (id === HR_ADMIN_ID && !active) return fail('The HR admin profile cannot be deactivated.')
    setData((d) => ({
      ...d,
      employees: d.employees.map((e) => (e.id === id ? { ...e, active } : e)),
      // Leaving employees: cancel their pending leave
      leaves: active ? d.leaves : d.leaves.map((l) => (l.employeeId === id && l.status === 'pending' ? { ...l, status: 'cancelled' } : l)),
    }))
    return ok
  }

  const applyLeave = (req: { type: LeaveType; from: string; to: string; reason: string }): Result => {
    if (!session) return fail('Not signed in.')
    if (!req.reason.trim()) return fail('Please give a reason.')
    const err = validateLeave({ employeeId: session.employeeId, ...req }, data.leaves, data.holidays)
    if (err) return fail(err)
    setData((d) => ({
      ...d,
      leaves: [
        ...d.leaves,
        {
          id: `L${Date.now()}`,
          employeeId: session.employeeId,
          ...req,
          reason: req.reason.trim(),
          days: leaveDays(req.from, req.to, d.holidays),
          status: 'pending',
          appliedOn: todayIST(),
        },
      ],
    }))
    return ok
  }

  const decideLeave = (id: string, decision: 'approved' | 'rejected', comment?: string): Result => {
    if (!session) return fail('Not signed in.')
    const req = data.leaves.find((l) => l.id === id)
    if (!req || req.status !== 'pending') return fail('This request is no longer pending.')
    if (req.employeeId === session.employeeId) return fail('You cannot approve your own leave.')
    if (!canActOn(session, req.employeeId, data.employees)) return fail('You can only decide leave for your own team.')
    setData((d) => {
      const leaves = d.leaves.map((l): LeaveRequest =>
        l.id === id ? { ...l, status: decision, decidedBy: session.employeeId, decidedOn: todayIST(), comment } : l,
      )
      if (decision !== 'approved') return { ...d, leaves }
      // Approved leave is written into the attendance register.
      const dates = daysBetweenInclusive(req.from, req.to).filter((x) => isWorkingDay(x, d.holidays))
      const keys = new Set(dates.map((x) => `${req.employeeId}|${x}`))
      const attendance = [
        ...d.attendance.filter((a) => !keys.has(`${a.employeeId}|${a.date}`)),
        ...dates.map(
          (date): AttendanceRecord => ({
            employeeId: req.employeeId, date, status: 'leave', remarks: `${req.type} approved`, markedBy: session.employeeId, markedAt: stamp(),
          }),
        ),
      ]
      return { ...d, leaves, attendance }
    })
    return ok
  }

  const cancelLeave = (id: string): Result => {
    if (!session) return fail('Not signed in.')
    const req = data.leaves.find((l) => l.id === id)
    if (!req) return fail('Request not found.')
    const own = req.employeeId === session.employeeId
    if (!own && session.role !== 'hr') return fail('You can only cancel your own leave.')
    if (req.status === 'approved' && req.from <= todayIST() && session.role !== 'hr') return fail('Leave that has started can only be cancelled by HR.')
    if (req.status !== 'pending' && req.status !== 'approved') return fail('This request cannot be cancelled.')
    setData((d) => ({
      ...d,
      leaves: d.leaves.map((l) => (l.id === id ? { ...l, status: 'cancelled' } : l)),
      attendance:
        req.status === 'approved'
          ? d.attendance.filter((a) => !(a.employeeId === req.employeeId && a.status === 'leave' && a.date >= req.from && a.date <= req.to))
          : d.attendance,
    }))
    return ok
  }

  const addHoliday = (h: Holiday): Result => {
    const denied = requireHR()
    if (denied) return denied
    if (!h.date || !h.name.trim()) return fail('Date and name are required.')
    if (data.holidays.some((x) => x.date === h.date)) return fail('There is already a holiday on this date.')
    setData((d) => ({ ...d, holidays: [...d.holidays, { date: h.date, name: h.name.trim() }].sort((a, b) => a.date.localeCompare(b.date)) }))
    return ok
  }

  const removeHoliday = (date: string): Result => {
    const denied = requireHR()
    if (denied) return denied
    setData((d) => ({ ...d, holidays: d.holidays.filter((h) => h.date !== date) }))
    return ok
  }

  // ---------- ATS ----------

  const findJob = (id: string) => data.jobs.find((j) => j.id === id)
  const findCandidate = (id: string) => data.candidates.find((c) => c.id === id)

  const saveJob = (input: JobInput, id?: string): Result => {
    if (!session || session.role === 'employee') return fail('Only HR and managers can manage jobs.')
    if (!input.title.trim()) return fail('Job title is required.')
    if (input.openings < 1) return fail('There must be at least one opening.')
    if (input.minSalary > input.maxSalary) return fail('Minimum salary is above the maximum.')
    if (session.role === 'manager' && input.hiringManagerId !== session.employeeId) return fail('Managers can only request jobs for their own team.')
    if (id) {
      const job = findJob(id)
      if (!job || !canManageJob(session, job)) return fail('Not allowed.')
      setData((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === id ? { ...j, ...input, title: input.title.trim() } : j)) }))
    } else {
      const job: Job = {
        ...input, title: input.title.trim(), id: `J${Date.now()}`, createdBy: session.employeeId, createdOn: todayIST(),
        // A manager's job is a hiring request that HR must approve before it opens.
        status: session.role === 'hr' ? 'open' : 'requested',
      }
      setData((d) => ({ ...d, jobs: [job, ...d.jobs] }))
    }
    return ok
  }

  const setJobStatus = (id: string, status: Job['status']): Result => {
    const denied = requireHR()
    if (denied) return denied
    setData((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === id ? { ...j, status } : j)) }))
    return ok
  }

  const addCandidate = (input: CandidateInput): Result => {
    const job = findJob(input.jobId)
    if (!session || !job || !canManageJob(session, job)) return fail('Not allowed.')
    if (job.status !== 'open') return fail('Candidates can only be added to open jobs.')
    if (!input.name.trim()) return fail('Candidate name is required.')
    if (!/^\S+@\S+\.\S+$/.test(input.email)) return fail('Enter a valid email address.')
    if (data.candidates.some((c) => c.jobId === input.jobId && c.email.toLowerCase() === input.email.toLowerCase()))
      return fail('This candidate has already applied for this job.')
    const c: Candidate = { ...input, name: input.name.trim(), id: `C${Date.now()}`, stage: 'applied', appliedOn: todayIST() }
    setData((d) => ({ ...d, candidates: [...d.candidates, c] }))
    return ok
  }

  const moveCandidate = (id: string, stage: CandidateStage): Result => {
    const c = findCandidate(id)
    const job = c && findJob(c.jobId)
    if (!session || !c || !job || !canManageJob(session, job)) return fail('Not allowed.')
    if (c.stage === 'hired') return fail('Hired candidates cannot be moved.')
    if (stage === 'hired') return fail('Use "Hire" to convert the candidate into an employee.')
    setData((d) => ({ ...d, candidates: d.candidates.map((x) => (x.id === id ? { ...x, stage } : x)) }))
    return ok
  }

  const updateCandidateNotes = (id: string, notes: string): Result => {
    const c = findCandidate(id)
    const job = c && findJob(c.jobId)
    if (!session || !c || !job || !canManageJob(session, job)) return fail('Not allowed.')
    setData((d) => ({ ...d, candidates: d.candidates.map((x) => (x.id === id ? { ...x, notes } : x)) }))
    return ok
  }

  const scheduleInterview = (input: InterviewInput): Result => {
    const c = findCandidate(input.candidateId)
    const job = c && findJob(c.jobId)
    if (!session || !c || !job || !canManageJob(session, job)) return fail('Not allowed.')
    if (c.stage === 'hired' || c.stage === 'rejected') return fail('This candidate is no longer in the pipeline.')
    if (!input.date || !input.time) return fail('Choose a date and time.')
    if (input.date < todayIST()) return fail('Interviews cannot be scheduled in the past.')
    if (!data.employees.some((e) => e.id === input.interviewerId && e.active)) return fail('Choose an interviewer.')
    if (data.interviews.some((i) => i.interviewerId === input.interviewerId && i.status === 'scheduled' && i.date === input.date && i.time === input.time))
      return fail('The interviewer already has an interview at that time.')
    setData((d) => ({
      ...d,
      interviews: [...d.interviews, { ...input, round: input.round.trim() || 'Interview', id: `I${Date.now()}`, status: 'scheduled' }],
      // Scheduling an interview moves early-stage candidates into the Interview stage.
      candidates: d.candidates.map((x) => (x.id === c.id && (x.stage === 'applied' || x.stage === 'screening') ? { ...x, stage: 'interview' } : x)),
    }))
    return ok
  }

  const submitInterviewFeedback = (id: string, fb: { rating: number; recommendation: 'hire' | 'no_hire'; feedback: string }): Result => {
    const iv = data.interviews.find((i) => i.id === id)
    if (!session || !iv) return fail('Interview not found.')
    if (iv.interviewerId !== session.employeeId && session.role !== 'hr') return fail('Only the interviewer can submit feedback.')
    if (iv.status === 'cancelled') return fail('This interview was cancelled.')
    if (fb.rating < 1 || fb.rating > 5) return fail('Choose a rating from 1 to 5.')
    if (!fb.feedback.trim()) return fail('Please write a short note.')
    setData((d) => ({ ...d, interviews: d.interviews.map((i) => (i.id === id ? { ...i, ...fb, feedback: fb.feedback.trim(), status: 'completed' } : i)) }))
    return ok
  }

  const cancelInterview = (id: string): Result => {
    const iv = data.interviews.find((i) => i.id === id)
    const c = iv && findCandidate(iv.candidateId)
    const job = c && findJob(c.jobId)
    if (!session || !iv || !job || !canManageJob(session, job)) return fail('Not allowed.')
    if (iv.status !== 'scheduled') return fail('Only scheduled interviews can be cancelled.')
    setData((d) => ({ ...d, interviews: d.interviews.map((i) => (i.id === id ? { ...i, status: 'cancelled' } : i)) }))
    return ok
  }

  const hireCandidate = (id: string, input: HireInput): Result => {
    const denied = requireHR()
    if (denied) return denied
    const c = findCandidate(id)
    const job = c && findJob(c.jobId)
    if (!c || !job) return fail('Candidate not found.')
    if (c.stage !== 'offer') return fail('Only candidates at the Offer stage can be hired.')
    if (!input.designation.trim()) return fail('Designation is required.')
    if (data.employees.some((e) => e.email.toLowerCase() === c.email.toLowerCase())) return fail('An employee with this email already exists.')
    setData((d) => {
      const next = Math.max(0, ...d.employees.map((e) => Number(e.id.slice(1)))) + 1
      const emp: Employee = {
        id: `e${String(next).padStart(2, '0')}`,
        code: `SG${Math.max(1000, ...d.employees.map((e) => Number(e.code.slice(2)))) + 1}`,
        name: c.name, email: c.email, phone: c.phone, department: job.department, designation: input.designation.trim(),
        location: input.location, managerId: input.managerId, joinDate: input.joinDate, active: true, pan: '', bankAccount: '', salary: input.salary,
      }
      const hiredCount = d.candidates.filter((x) => x.jobId === job.id && x.stage === 'hired').length + 1
      return {
        ...d,
        employees: [...d.employees, emp],
        candidates: d.candidates.map((x) => (x.id === id ? { ...x, stage: 'hired', employeeId: emp.id } : x)),
        // Close the job automatically once all openings are filled.
        jobs: d.jobs.map((j) => (j.id === job.id && hiredCount >= j.openings ? { ...j, status: 'closed' } : j)),
      }
    })
    return ok
  }

  // ---------- PMS ----------

  const findCycle = (id: string) => data.cycles.find((c) => c.id === id)
  const findEmp = (id: string) => data.employees.find((e) => e.id === id)
  const reviewOf = (d: HRMSData, cycleId: string, employeeId: string): Review =>
    d.reviews.find((r) => r.cycleId === cycleId && r.employeeId === employeeId) ?? { cycleId, employeeId }
  const upsertReview = (d: HRMSData, r: Review): Review[] => [
    ...d.reviews.filter((x) => !(x.cycleId === r.cycleId && x.employeeId === r.employeeId)),
    r,
  ]

  const createCycle = (c: Omit<ReviewCycle, 'id' | 'phase'>): Result => {
    const denied = requireHR()
    if (denied) return denied
    if (!c.name.trim()) return fail('Cycle name is required.')
    if (!c.from || !c.to || c.to < c.from) return fail('Choose a valid date range.')
    if (data.cycles.some((x) => x.name.toLowerCase() === c.name.trim().toLowerCase())) return fail('A cycle with this name already exists.')
    setData((d) => ({ ...d, cycles: [...d.cycles, { ...c, name: c.name.trim(), id: `PC${Date.now()}`, phase: 'goal_setting' }] }))
    return ok
  }

  const setCyclePhase = (id: string, phase: CyclePhase): Result => {
    const denied = requireHR()
    if (denied) return denied
    setData((d) => ({ ...d, cycles: d.cycles.map((c) => (c.id === id ? { ...c, phase } : c)) }))
    return ok
  }

  /** Goals can be edited by the employee or their reviewer while the cycle is in goal setting. */
  const canEditGoalsOf = (cycleId: string, employeeId: string): Result | null => {
    const cycle = findCycle(cycleId)
    const emp = findEmp(employeeId)
    if (!session || !cycle || !emp) return fail('Not found.')
    if (cycle.phase !== 'goal_setting') return fail('Goals can only be changed during goal setting.')
    if (!cycleParticipants(cycle, data.employees).some((e) => e.id === employeeId)) return fail('This employee is not part of the cycle.')
    if (session.employeeId !== employeeId && !canReview(session, emp)) return fail('Not allowed.')
    return null
  }

  const saveGoal = (cycleId: string, employeeId: string, input: GoalInput, id?: string): Result => {
    const denied = canEditGoalsOf(cycleId, employeeId)
    if (denied) return denied
    if (!input.title.trim()) return fail('Goal title is required.')
    if (input.weight <= 0 || input.weight > 100) return fail('Weightage must be between 1 and 100.')
    const others = data.goals.filter((g) => g.cycleId === cycleId && g.employeeId === employeeId && g.id !== id)
    if (goalWeightTotal(others) + input.weight > 100) return fail(`Total weightage cannot exceed 100% (${100 - goalWeightTotal(others)}% left).`)
    setData((d) => {
      // Any change to goals resets approval for that employee.
      const reset = d.goals.map((g) => (g.cycleId === cycleId && g.employeeId === employeeId ? { ...g, approved: false } : g))
      const goals = id
        ? reset.map((g) => (g.id === id ? { ...g, ...input, title: input.title.trim() } : g))
        : [...reset, { ...input, title: input.title.trim(), id: `G${Date.now()}`, cycleId, employeeId, progress: 0, approved: false }]
      return { ...d, goals }
    })
    return ok
  }

  const deleteGoal = (id: string): Result => {
    const g = data.goals.find((x) => x.id === id)
    if (!g) return fail('Goal not found.')
    const denied = canEditGoalsOf(g.cycleId, g.employeeId)
    if (denied) return denied
    setData((d) => ({
      ...d,
      goals: d.goals.filter((x) => x.id !== id).map((x) => (x.cycleId === g.cycleId && x.employeeId === g.employeeId ? { ...x, approved: false } : x)),
    }))
    return ok
  }

  const updateGoalProgress = (id: string, progress: number): Result => {
    const g = data.goals.find((x) => x.id === id)
    if (!session || !g) return fail('Goal not found.')
    if (g.employeeId !== session.employeeId) return fail('You can only update your own goals.')
    if (findCycle(g.cycleId)?.phase === 'closed') return fail('This cycle is closed.')
    const p = Math.max(0, Math.min(100, Math.round(progress)))
    setData((d) => ({ ...d, goals: d.goals.map((x) => (x.id === id ? { ...x, progress: p } : x)) }))
    return ok
  }

  const approveGoals = (cycleId: string, employeeId: string): Result => {
    const emp = findEmp(employeeId)
    if (!session || !emp || !canReview(session, emp)) return fail('Only the reviewer can approve goals.')
    const mine = data.goals.filter((g) => g.cycleId === cycleId && g.employeeId === employeeId)
    if (!mine.length) return fail('There are no goals to approve.')
    if (goalWeightTotal(mine) !== 100) return fail(`Goal weightage must total 100% (currently ${goalWeightTotal(mine)}%).`)
    setData((d) => ({ ...d, goals: d.goals.map((g) => (g.cycleId === cycleId && g.employeeId === employeeId ? { ...g, approved: true } : g)) }))
    return ok
  }

  const validRatings = (goals: Goal[], ratings: Record<string, number>) => goals.every((g) => ratings[g.id] >= 1 && ratings[g.id] <= 5)

  const submitSelfReview = (cycleId: string, ratings: Record<string, number>, comments: string): Result => {
    if (!session) return fail('Not signed in.')
    const cycle = findCycle(cycleId)
    if (cycle?.phase !== 'review') return fail('Self reviews open when HR starts the review phase.')
    const mine = data.goals.filter((g) => g.cycleId === cycleId && g.employeeId === session.employeeId)
    if (!mine.length || mine.some((g) => !g.approved)) return fail('Your goals must be approved before you can review them.')
    const existing = data.reviews.find((r) => r.cycleId === cycleId && r.employeeId === session.employeeId)
    if (existing?.selfRating) return fail('You have already submitted your self review.')
    if (!validRatings(mine, ratings)) return fail('Rate every goal from 1 to 5.')
    const rated = mine.map((g) => ({ ...g, selfRating: ratings[g.id] }))
    setData((d) => ({
      ...d,
      goals: d.goals.map((g) => (ratings[g.id] && g.employeeId === session.employeeId ? { ...g, selfRating: ratings[g.id] } : g)),
      reviews: upsertReview(d, { ...reviewOf(d, cycleId, session.employeeId), selfRating: weightedRating(rated, 'selfRating')!, selfComments: comments.trim(), selfSubmittedOn: todayIST() }),
    }))
    return ok
  }

  const submitManagerReview = (cycleId: string, employeeId: string, ratings: Record<string, number>, comments: string): Result => {
    const emp = findEmp(employeeId)
    if (!session || !emp || !canReview(session, emp)) return fail('Only the reviewer can submit this review.')
    if (findCycle(cycleId)?.phase !== 'review') return fail('The cycle is not in the review phase.')
    const existing = data.reviews.find((r) => r.cycleId === cycleId && r.employeeId === employeeId)
    if (!existing?.selfRating) return fail('Wait for the employee to submit their self review.')
    if (existing.finalRating) return fail('This review has already been finalised.')
    const mine = data.goals.filter((g) => g.cycleId === cycleId && g.employeeId === employeeId)
    if (!validRatings(mine, ratings)) return fail('Rate every goal from 1 to 5.')
    if (!comments.trim()) return fail('Please add overall feedback.')
    const rated = mine.map((g) => ({ ...g, managerRating: ratings[g.id] }))
    setData((d) => ({
      ...d,
      goals: d.goals.map((g) => (ratings[g.id] && g.employeeId === employeeId ? { ...g, managerRating: ratings[g.id] } : g)),
      reviews: upsertReview(d, { ...reviewOf(d, cycleId, employeeId), managerRating: weightedRating(rated, 'managerRating')!, managerComments: comments.trim(), managerSubmittedOn: todayIST(), reviewerId: session.employeeId }),
    }))
    return ok
  }

  const finaliseReview = (cycleId: string, employeeId: string, finalRating: number, incrementPct: number): Result => {
    const denied = requireHR()
    if (denied) return denied
    const emp = findEmp(employeeId)
    const existing = data.reviews.find((r) => r.cycleId === cycleId && r.employeeId === employeeId)
    if (!emp || reviewerOf(emp) === null) return fail('Employee not found.')
    if (!existing?.managerRating) return fail('The manager review must be submitted first.')
    if (existing.finalRating) return fail('This review is already finalised.')
    if (finalRating < 1 || finalRating > 5) return fail('Final rating must be from 1 to 5.')
    if (incrementPct < 0 || incrementPct > 50) return fail('Increment must be between 0% and 50%.')
    setData((d) => ({
      ...d,
      reviews: upsertReview(d, { ...existing, finalRating, incrementPct, finalisedOn: todayIST() }),
      // The appraisal increment flows straight into payroll.
      employees: d.employees.map((e) => (e.id === employeeId ? { ...e, salary: applyIncrement(e.salary, incrementPct) } : e)),
    }))
    return ok
  }

  const resetDemo = () => setData(seedData())

  const value: Store = {
    data, session, me, login, logout, saveAttendance, clearAttendance, addEmployee, updateEmployee, setEmployeeActive,
    applyLeave, decideLeave, cancelLeave, addHoliday, removeHoliday,
    saveJob, setJobStatus, addCandidate, moveCandidate, updateCandidateNotes, scheduleInterview, submitInterviewFeedback, cancelInterview, hireCandidate,
    createCycle, setCyclePhase, saveGoal, deleteGoal, updateGoalProgress, approveGoals, submitSelfReview, submitManagerReview, finaliseReview,
    resetDemo,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}
