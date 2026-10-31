import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { daysBetweenInclusive, nowTimeIST, todayIST } from './date'
import { canActOn, isWorkingDay, leaveDays, validateLeave } from './rules'
import { DATA_VERSION, seedData } from './seed'
import type { AttendanceRecord, Employee, HRMSData, Holiday, LeaveRequest, LeaveType, Role, Session } from './types'

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

  const resetDemo = () => setData(seedData())

  const value: Store = {
    data, session, me, login, logout, saveAttendance, clearAttendance, addEmployee, updateEmployee, setEmployeeActive,
    applyLeave, decideLeave, cancelLeave, addHoliday, removeHoliday, resetDemo,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}
