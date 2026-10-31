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
}
