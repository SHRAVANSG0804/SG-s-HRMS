export type Role = 'hr' | 'manager' | 'employee'

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | 'wfh' | 'holiday'

export type LeaveType = 'CL' | 'SL' | 'EL'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface Employee {
  id: string
  code: string
  name: string
  email: string
  phone: string
  department: string
  designation: string
  location: string
  managerId: string | null
  joinDate: string
  active: boolean
  pan: string
  bankAccount: string
  salary: SalaryStructure
}

export interface SalaryStructure {
  basic: number
  hra: number
  allowances: number
}

export interface AttendanceRecord {
  employeeId: string
  date: string
  status: AttendanceStatus
  checkIn?: string
  checkOut?: string
  remarks?: string
  markedBy: string
  markedAt: string
}

export interface LeaveRequest {
  id: string
  employeeId: string
  type: LeaveType
  from: string
  to: string
  days: number
  reason: string
  status: LeaveStatus
  appliedOn: string
  decidedBy?: string
  decidedOn?: string
  comment?: string
}

export interface Holiday {
  date: string
  name: string
}

export interface Session {
  role: Role
  /** The employee profile this session acts as. HR acts as the HR admin profile. */
  employeeId: string
}

export interface HRMSData {
  version: number
  employees: Employee[]
  attendance: AttendanceRecord[]
  leaves: LeaveRequest[]
  holidays: Holiday[]
  jobs: Job[]
  candidates: Candidate[]
  interviews: Interview[]
  cycles: ReviewCycle[]
  goals: Goal[]
  reviews: Review[]
}

// ---------- ATS (recruitment) ----------

export type JobStatus = 'requested' | 'open' | 'on_hold' | 'closed'
export type CandidateStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'

export interface Job {
  id: string
  title: string
  department: string
  location: string
  openings: number
  hiringManagerId: string
  status: JobStatus
  description: string
  minSalary: number
  maxSalary: number
  createdBy: string
  createdOn: string
}

export interface Candidate {
  id: string
  jobId: string
  name: string
  email: string
  phone: string
  experience: number
  currentCompany: string
  expectedSalary: number
  source: string
  stage: CandidateStage
  appliedOn: string
  notes: string
  employeeId?: string
}

export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled'

export interface Interview {
  id: string
  candidateId: string
  interviewerId: string
  round: string
  date: string
  time: string
  mode: 'In person' | 'Video' | 'Phone'
  status: InterviewStatus
  rating?: number
  recommendation?: 'hire' | 'no_hire'
  feedback?: string
}

// ---------- PMS (performance) ----------

export type CyclePhase = 'goal_setting' | 'review' | 'closed'

export interface ReviewCycle {
  id: string
  name: string
  from: string
  to: string
  phase: CyclePhase
}

export interface Goal {
  id: string
  cycleId: string
  employeeId: string
  title: string
  description: string
  weight: number
  progress: number
  approved: boolean
  selfRating?: number
  managerRating?: number
}

export interface Review {
  cycleId: string
  employeeId: string
  selfRating?: number
  selfComments?: string
  selfSubmittedOn?: string
  managerRating?: number
  managerComments?: string
  managerSubmittedOn?: string
  reviewerId?: string
  finalRating?: number
  incrementPct?: number
  finalisedOn?: string
}
