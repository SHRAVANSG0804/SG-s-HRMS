import { addDays, nowTimeIST, todayIST } from './date'
import { isWorkingDay, leaveDays } from './rules'
import type { AttendanceRecord, AttendanceStatus, Employee, HRMSData, Holiday, LeaveRequest, LeaveType } from './types'

export const DATA_VERSION = 1

export const DEPARTMENTS = ['Human Resources', 'Operations', 'Sales', 'Technology', 'Finance']
export const LOCATIONS = ['Panaji HO', 'Verna Plant']

export const HOLIDAYS: Holiday[] = [
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-04', name: 'Holi' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Dussehra' },
  { date: '2026-11-09', name: 'Diwali' },
  { date: '2026-12-19', name: 'Goa Liberation Day' },
  { date: '2026-12-25', name: 'Christmas' },
]

type Row = [name: string, dept: string, designation: string, manager: string | null, loc: number, join: string, basic: number]

// id is derived from row index: e01…e20
const ROWS: Row[] = [
  ['Priya Naik', 'Human Resources', 'HR Manager', null, 0, '2019-04-01', 52000],
  ['Rohan Desai', 'Operations', 'Operations Manager', null, 1, '2018-07-16', 60000],
  ['Ananya Kamat', 'Sales', 'Sales Manager', null, 0, '2020-01-06', 58000],
  ['Vikram Shetty', 'Technology', 'Engineering Manager', null, 0, '2019-11-11', 75000],
  ['Sneha Pai', 'Operations', 'Production Supervisor', 'e02', 1, '2021-03-01', 32000],
  ['Arjun Gaonkar', 'Operations', 'Quality Analyst', 'e02', 1, '2022-06-13', 28000],
  ['Meera Fernandes', 'Operations', 'Store Keeper', 'e02', 1, '2023-02-01', 22000],
  ['Karan Sawant', 'Operations', 'Machine Operator', 'e02', 1, '2023-08-21', 20000],
  ['Divya Kulkarni', 'Operations', 'Logistics Executive', 'e02', 1, '2024-01-08', 24000],
  ['Rahul Prabhu', 'Sales', 'Area Sales Executive', 'e03', 0, '2021-09-01', 30000],
  ['Pooja Lotlikar', 'Sales', 'Key Account Executive', 'e03', 0, '2022-11-14', 34000],
  ['Nikhil Borkar', 'Sales', 'Sales Executive', 'e03', 0, '2024-04-01', 25000],
  ['Shruti Dessai', 'Sales', 'Marketing Associate', 'e03', 0, '2025-02-10', 27000],
  ['Aditya Rao', 'Technology', 'Senior Developer', 'e04', 0, '2021-05-17', 55000],
  ['Kavya Menon', 'Technology', 'Developer', 'e04', 0, '2023-07-03', 42000],
  ['Sameer Khan', 'Technology', 'QA Engineer', 'e04', 0, '2024-09-02', 36000],
  ['Tanvi Joshi', 'Technology', 'UI Designer', 'e04', 0, '2025-06-16', 38000],
  ['Ishaan Verma', 'Finance', 'Accountant', 'e01', 0, '2022-02-07', 33000],
  ['Riya Parab', 'Human Resources', 'HR Executive', 'e01', 0, '2023-10-09', 29000],
  ['Manoj Gawas', 'Finance', 'Accounts Assistant', 'e01', 0, '2025-08-04', 21000],
]

const PAN_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

// Small deterministic PRNG so the demo data is the same on every device.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

export function seedEmployees(): Employee[] {
  const r = rng(42)
  return ROWS.map(([name, department, designation, managerId, loc, joinDate, basic], i) => {
    const id = `e${String(i + 1).padStart(2, '0')}`
    const [first, last] = name.toLowerCase().split(' ')
    const pick = () => PAN_LETTERS[Math.floor(r() * PAN_LETTERS.length)]
    return {
      id,
      code: `SG${String(1001 + i)}`,
      name,
      email: `${first}.${last}@sghrms.in`,
      phone: `+91 9${String(Math.floor(r() * 1e9)).padStart(9, '0')}`,
      department,
      designation,
      location: LOCATIONS[loc],
      managerId,
      joinDate,
      active: true,
      pan: `${pick()}${pick()}${pick()}P${last[0].toUpperCase()}${String(1000 + Math.floor(r() * 9000))}${pick()}`,
      bankAccount: String(Math.floor(1e11 + r() * 9e11)),
      salary: { basic, hra: Math.round(basic * 0.4), allowances: Math.round(basic * 0.2) },
    }
  })
}

export function seedData(now: Date = new Date()): HRMSData {
  const employees = seedEmployees()
  const today = todayIST(now)
  const r = rng(7)
  const attendance: AttendanceRecord[] = []
  const leaves: LeaveRequest[] = []
  const stamp = `${today}T${nowTimeIST(now)}`

  // A few approved past leaves, and pending ones awaiting approval.
  const approvedPlan: [string, LeaveType, number, number, string][] = [
    ['e06', 'CL', -12, -11, 'Family function'],
    ['e11', 'SL', -20, -19, 'Viral fever'],
    ['e15', 'EL', -8, -6, 'Trip to Kerala'],
    ['e09', 'CL', -3, -3, 'Personal work'],
  ]
  const pendingPlan: [string, LeaveType, number, number, string][] = [
    ['e07', 'CL', 3, 3, 'Bank work'],
    ['e12', 'EL', 7, 10, 'Wedding in the family'],
    ['e16', 'SL', 1, 1, 'Dental appointment'],
    ['e19', 'CL', 5, 5, 'House shifting'],
  ]
  const approverOf = (id: string) => employees.find((e) => e.id === id)?.managerId ?? 'e01'
  let n = 1
  for (const [emp, type, a, b, reason] of approvedPlan) {
    const from = addDays(today, a)
    const to = addDays(today, b)
    leaves.push({
      id: `L${n++}`, employeeId: emp, type, from, to, days: leaveDays(from, to, HOLIDAYS), reason,
      status: 'approved', appliedOn: addDays(from, -5), decidedBy: approverOf(emp), decidedOn: addDays(from, -4),
    })
  }
  for (const [emp, type, a, b, reason] of pendingPlan) {
    const from = addDays(today, a)
    const to = addDays(today, b)
    leaves.push({
      id: `L${n++}`, employeeId: emp, type, from, to, days: leaveDays(from, to, HOLIDAYS), reason,
      status: 'pending', appliedOn: addDays(today, -1),
    })
  }

  const onLeave = (empId: string, date: string) =>
    leaves.some((l) => l.status === 'approved' && l.employeeId === empId && l.from <= date && date <= l.to)

  // Attendance for the last 60 days up to yesterday. Today is left for manual marking.
  for (let i = 60; i >= 1; i--) {
    const date = addDays(today, -i)
    for (const e of employees) {
      if (e.joinDate > date) continue
      let status: AttendanceStatus
      if (!isWorkingDay(date, HOLIDAYS)) {
        if (HOLIDAYS.some((h) => h.date === date)) status = 'holiday'
        else continue
      } else if (onLeave(e.id, date)) status = 'leave'
      else {
        const x = r()
        status = x < 0.05 ? 'absent' : x < 0.09 ? 'half_day' : x < 0.17 && e.department === 'Technology' ? 'wfh' : 'present'
      }
      const rec: AttendanceRecord = { employeeId: e.id, date, status, markedBy: e.managerId ?? 'e01', markedAt: stamp }
      if (status === 'present' || status === 'wfh' || status === 'half_day') {
        const inMin = 9 * 60 + Math.floor(r() * 40) - 10
        const outMin = status === 'half_day' ? inMin + 240 + Math.floor(r() * 30) : inMin + 510 + Math.floor(r() * 60)
        rec.checkIn = `${String(Math.floor(inMin / 60)).padStart(2, '0')}:${String(inMin % 60).padStart(2, '0')}`
        rec.checkOut = `${String(Math.floor(outMin / 60)).padStart(2, '0')}:${String(outMin % 60).padStart(2, '0')}`
      }
      attendance.push(rec)
    }
  }

  return { version: DATA_VERSION, employees, attendance, leaves, holidays: [...HOLIDAYS] }
}
