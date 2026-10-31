import { addDays, nowTimeIST, todayIST, weekday } from './date'
import { cycleParticipants, isWorkingDay, leaveDays, weightedRating } from './rules'
import type {
  AttendanceRecord, AttendanceStatus, Candidate, CandidateStage, Employee, Goal, HRMSData, Holiday, Interview, Job, LeaveRequest, LeaveType, Review, ReviewCycle,
} from './types'

export const DATA_VERSION = 2

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

  return {
    version: DATA_VERSION, employees, attendance, leaves, holidays: [...HOLIDAYS],
    ...seedRecruitment(today),
    ...seedPerformance(employees, today),
  }
}

// ---------- ATS ----------

export const CANDIDATE_SOURCES = ['Naukri', 'LinkedIn', 'Referral', 'Company website', 'Campus', 'Walk-in']

export function seedRecruitment(today: string): Pick<HRMSData, 'jobs' | 'candidates' | 'interviews'> {
  const d = (n: number) => addDays(today, n)
  const jobs: Job[] = [
    { id: 'J1', title: 'Senior Developer', department: 'Technology', location: 'Panaji HO', openings: 2, hiringManagerId: 'e04', status: 'open', description: 'React/TypeScript developer to build internal tools and the customer portal. 4+ years experience.', minSalary: 50000, maxSalary: 70000, createdBy: 'e01', createdOn: d(-40) },
    { id: 'J2', title: 'Sales Executive', department: 'Sales', location: 'Panaji HO', openings: 1, hiringManagerId: 'e03', status: 'open', description: 'Field sales for North Goa retail and HoReCa accounts. Two-wheeler and licence required.', minSalary: 22000, maxSalary: 30000, createdBy: 'e01', createdOn: d(-25) },
    { id: 'J3', title: 'Production Supervisor (Shift B)', department: 'Operations', location: 'Verna Plant', openings: 1, hiringManagerId: 'e02', status: 'open', description: 'Supervise second-shift production line of 25 operators; food-processing experience preferred.', minSalary: 28000, maxSalary: 36000, createdBy: 'e01', createdOn: d(-18) },
    { id: 'J4', title: 'Quality Analyst', department: 'Operations', location: 'Verna Plant', openings: 1, hiringManagerId: 'e02', status: 'requested', description: 'Replacement for growing QA workload; B.Sc. Food Technology.', minSalary: 24000, maxSalary: 30000, createdBy: 'e02', createdOn: d(-2) },
    { id: 'J5', title: 'Accounts Executive', department: 'Finance', location: 'Panaji HO', openings: 1, hiringManagerId: 'e01', status: 'closed', description: 'GST filing and vendor payments. Tally and Excel.', minSalary: 20000, maxSalary: 26000, createdBy: 'e01', createdOn: d(-120) },
  ]
  const C = (id: string, jobId: string, name: string, exp: number, company: string, expected: number, source: string, stage: CandidateStage, applied: number, notes = ''): Candidate => {
    const [f, l] = name.toLowerCase().split(' ')
    return { id, jobId, name, email: `${f}.${l}@mail.com`, phone: `+91 98${String(20000000 + Number(id.slice(1)) * 7919).slice(0, 8)}`, experience: exp, currentCompany: company, expectedSalary: expected, source, stage, appliedOn: d(applied), notes }
  }
  const candidates: Candidate[] = [
    C('C1', 'J1', 'Neha Bhat', 5, 'Persistent Systems', 68000, 'LinkedIn', 'offer', -35, 'Strong React; notice period 30 days.'),
    C('C2', 'J1', 'Akash Naik', 4, 'Infosys', 60000, 'Naukri', 'interview', -30),
    C('C3', 'J1', 'Farhan Shaikh', 6, 'Freelancer', 72000, 'Referral', 'interview', -28, 'Referred by Aditya Rao.'),
    C('C4', 'J1', 'Lavanya Iyer', 3, 'TCS', 52000, 'Naukri', 'screening', -12),
    C('C5', 'J1', 'Gaurav Mehta', 2, 'Startup', 45000, 'Company website', 'rejected', -33, 'Below required experience.'),
    C('C6', 'J1', 'Pranav Sardesai', 4, 'Wipro', 58000, 'LinkedIn', 'applied', -3),
    C('C7', 'J2', 'Siddhi Kerkar', 2, 'Asian Paints (dealer)', 26000, 'Referral', 'interview', -20),
    C('C8', 'J2', 'Omkar Parsekar', 1, 'Fresher', 22000, 'Walk-in', 'screening', -9),
    C('C9', 'J2', 'Clara D’Souza', 3, 'Amul distributor', 29000, 'Naukri', 'applied', -4),
    C('C10', 'J2', 'Vishal Gawde', 4, 'ITC', 32000, 'LinkedIn', 'rejected', -22, 'Salary expectation above band.'),
    C('C11', 'J3', 'Ravi Chodankar', 7, 'Godrej Agrovet', 34000, 'Naukri', 'offer', -16, 'Offer letter shared; awaiting acceptance.'),
    C('C12', 'J3', 'Sunita Morajkar', 5, 'Britannia', 31000, 'Referral', 'interview', -14),
    C('C13', 'J3', 'Deepak Halarnkar', 3, 'Local unit', 27000, 'Walk-in', 'applied', -1),
    C('C14', 'J5', 'Manoj Gawas', 2, 'CA firm', 21000, 'Campus', 'hired', -110),
  ]
  candidates[13].employeeId = 'e20'
  const I = (id: string, candidateId: string, interviewerId: string, round: string, date: number, time: string, mode: Interview['mode'], done?: [number, 'hire' | 'no_hire', string]): Interview => ({
    // Interviews never fall on a Sunday.
    id, candidateId, interviewerId, round, date: weekday(d(date)) === 0 ? d(date + 1) : d(date), time, mode,
    ...(done ? { status: 'completed' as const, rating: done[0], recommendation: done[1], feedback: done[2] } : { status: 'scheduled' as const }),
  })
  const interviews: Interview[] = [
    I('I1', 'C1', 'e14', 'Technical', -20, '11:00', 'Video', [5, 'hire', 'Excellent component design and testing practices.']),
    I('I2', 'C1', 'e04', 'Manager', -14, '15:00', 'In person', [4, 'hire', 'Good communication, clear ownership. Recommend offer at 66k.']),
    I('I3', 'C2', 'e14', 'Technical', -6, '12:00', 'Video', [3, 'hire', 'Solid basics, weaker on performance tuning.']),
    I('I4', 'C2', 'e04', 'Manager', 1, '16:00', 'In person'),
    I('I5', 'C3', 'e04', 'Technical', 2, '11:30', 'Video'),
    I('I6', 'C5', 'e14', 'Technical', -26, '10:00', 'Phone', [2, 'no_hire', 'Not enough hands-on React experience.']),
    I('I7', 'C7', 'e03', 'Manager', -5, '10:30', 'In person', [4, 'hire', 'Knows the North Goa market well.']),
    I('I8', 'C7', 'e01', 'HR', 1, '12:00', 'In person'),
    I('I9', 'C11', 'e02', 'Manager', -8, '10:00', 'In person', [4, 'hire', 'Handled 30-operator shift at Godrej; calm under pressure.']),
    I('I10', 'C12', 'e02', 'Manager', 3, '14:00', 'In person'),
  ]
  return { jobs, candidates, interviews }
}

// ---------- PMS ----------

const GOAL_TEMPLATES: Record<string, [string, string][]> = {
  Operations: [
    ['Reduce line downtime by 15%', 'Track stoppages daily and fix the top 3 causes.'],
    ['Zero lost-time safety incidents', 'Weekly toolbox talks and PPE audits.'],
    ['First-pass quality yield of 98%', 'Measured from QA batch reports.'],
  ],
  Sales: [
    ['Achieve 100% of sales target', 'Half-yearly target as per the sales plan.'],
    ['Open 10 new key accounts', 'HoReCa and modern trade in North Goa.'],
    ['Collections within 45 days: 90%', 'Reduce overdue receivables.'],
  ],
  Technology: [
    ['Ship customer portal v2', 'Ordering and invoice download for distributors.'],
    ['Cut production bugs by 30%', 'Add automated tests to critical flows.'],
    ['Complete a cloud certification', 'Any associate-level cloud certification.'],
  ],
  Finance: [
    ['Close monthly books in 5 working days', 'From month end to signed-off P&L.'],
    ['Zero statutory filing delays', 'GST, TDS and PF filed on time.'],
    ['Automate vendor reconciliation', 'Replace the manual Excel process.'],
  ],
  'Human Resources': [
    ['Reduce time-to-hire to 30 days', 'From job approval to offer acceptance.'],
    ['Run the employee engagement survey', 'Share results and an action plan.'],
    ['POSH training for all employees', '100% completion tracked in HRMS.'],
  ],
}
const WEIGHTS = [40, 35, 25]

export function seedPerformance(employees: Employee[], today: string): Pick<HRMSData, 'cycles' | 'goals' | 'reviews'> {
  const y = today.slice(0, 4)
  const cycles: ReviewCycle[] = [
    { id: 'PC1', name: `H1 ${y}`, from: `${y}-01-01`, to: `${y}-06-30`, phase: 'closed' },
    { id: 'PC2', name: `H2 ${y}`, from: `${y}-07-01`, to: `${y}-12-31`, phase: 'review' },
  ]
  const r = rng(99)
  const rate = (base: number) => Math.max(1, Math.min(5, base + (r() < 0.3 ? -1 : r() > 0.75 ? 1 : 0)))
  const goals: Goal[] = []
  const reviews: Review[] = []
  let g = 1
  const before = (d: string) => (d < today ? d : today)
  for (const cycle of cycles) {
    for (const e of cycleParticipants(cycle, employees)) {
      const t = GOAL_TEMPLATES[e.department] ?? GOAL_TEMPLATES.Operations
      const base = 2 + Math.floor(r() * 3) + (r() > 0.85 ? 1 : 0) // 2..5
      const closed = cycle.phase === 'closed'
      // H2: a few have submitted self reviews; some of those also have manager reviews.
      const idx = Number(e.id.slice(1))
      const selfDone = closed || [5, 6, 10, 11, 14, 15, 18].includes(idx)
      const mgrDone = closed || [5, 10, 14].includes(idx)
      const mine: Goal[] = t.map(([title, description], i) => ({
        id: `G${g++}`, cycleId: cycle.id, employeeId: e.id, title, description, weight: WEIGHTS[i],
        progress: closed ? 100 : Math.min(100, Math.round((40 + r() * 55) / 5) * 5), approved: true,
        selfRating: selfDone ? rate(base + (r() > 0.6 ? 1 : 0)) : undefined,
        managerRating: mgrDone ? rate(base) : undefined,
      }))
      goals.push(...mine)
      const rev: Review = { cycleId: cycle.id, employeeId: e.id }
      if (selfDone) Object.assign(rev, { selfRating: weightedRating(mine, 'selfRating')!, selfComments: 'Delivered my key goals; would like more ownership next cycle.', selfSubmittedOn: before(closed ? `${y}-07-05` : addDays(today, -6)) })
      if (mgrDone) Object.assign(rev, { managerRating: weightedRating(mine, 'managerRating')!, managerComments: 'Consistent performer. Focus on documentation and mentoring.', managerSubmittedOn: before(closed ? `${y}-07-12` : addDays(today, -2)), reviewerId: e.managerId ?? 'e01' })
      if (closed) {
        const fin = Math.round(rev.managerRating!)
        Object.assign(rev, { finalRating: fin, incrementPct: [0, 0, 3, 6, 10, 15][fin], finalisedOn: `${y}-07-20` })
      }
      if (selfDone || mgrDone) reviews.push(rev)
    }
  }
  return { cycles, goals, reviews }
}
