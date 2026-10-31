import { describe, expect, it } from 'vitest'
import { addDays, daysInMonth, todayIST, weekday } from '../src/lib/date'
import { attendanceSummary, canActOn, leaveBalance, leaveDays, maskAccount, maskPAN, payslip, scopeEmployees, validateLeave } from '../src/lib/rules'
import { HOLIDAYS, seedEmployees } from '../src/lib/seed'
import type { AttendanceRecord, LeaveRequest } from '../src/lib/types'

const emps = seedEmployees()

describe('dates (IST)', () => {
  it('uses IST, not the machine time zone', () => {
    // 20:00 UTC on 31 Oct is already 1 Nov in India
    expect(todayIST(new Date('2026-10-31T20:00:00Z'))).toBe('2026-11-01')
    expect(todayIST(new Date('2026-10-31T18:00:00Z'))).toBe('2026-10-31')
  })
  it('does calendar arithmetic', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(daysInMonth('2028-02')).toHaveLength(29)
    expect(weekday('2026-11-01')).toBe(0) // Sunday
  })
})

describe('leave', () => {
  it('counts working days, skipping Sundays and holidays', () => {
    expect(leaveDays('2026-10-31', '2026-11-02', HOLIDAYS)).toBe(2) // Sat, (Sun), Mon
    expect(leaveDays('2026-10-02', '2026-10-02', HOLIDAYS)).toBe(0) // Gandhi Jayanti
  })
  const leaves: LeaveRequest[] = [
    { id: 'a', employeeId: 'e05', type: 'CL', from: '2026-03-02', to: '2026-03-03', days: 2, reason: 'x', status: 'approved', appliedOn: '2026-02-20' },
    { id: 'b', employeeId: 'e05', type: 'CL', from: '2026-04-06', to: '2026-04-06', days: 1, reason: 'x', status: 'pending', appliedOn: '2026-04-01' },
    { id: 'c', employeeId: 'e05', type: 'CL', from: '2026-05-04', to: '2026-05-04', days: 1, reason: 'x', status: 'rejected', appliedOn: '2026-05-01' },
  ]
  it('computes balance as quota − approved − pending', () => {
    expect(leaveBalance('e05', 'CL', leaves, '2026')).toMatchObject({ quota: 8, used: 2, pending: 1, available: 5 })
  })
  it('rejects overlaps and over-balance requests', () => {
    expect(validateLeave({ employeeId: 'e05', type: 'CL', from: '2026-03-03', to: '2026-03-04' }, leaves, HOLIDAYS)).toMatch(/already/)
    expect(validateLeave({ employeeId: 'e05', type: 'SL', from: '2026-06-01', to: '2026-06-13' }, leaves, HOLIDAYS)).toMatch(/Only 7/)
    expect(validateLeave({ employeeId: 'e05', type: 'CL', from: '2026-06-01', to: '2026-06-02' }, leaves, HOLIDAYS)).toBeNull()
  })
})

describe('access', () => {
  it('limits managers to direct reports', () => {
    const mgr = { role: 'manager' as const, employeeId: 'e02' }
    expect(scopeEmployees(mgr, emps).map((e) => e.id)).toEqual(['e05', 'e06', 'e07', 'e08', 'e09'])
    expect(canActOn(mgr, 'e10', emps)).toBe(false)
    expect(canActOn({ role: 'employee', employeeId: 'e05' }, 'e05', emps)).toBe(false)
    expect(canActOn({ role: 'hr', employeeId: 'e01' }, 'e10', emps)).toBe(true)
  })
})

describe('attendance & payroll', () => {
  const rec = (date: string, status: AttendanceRecord['status']): AttendanceRecord => ({ employeeId: 'e05', date, status, markedBy: 'e02', markedAt: '' })
  // Nov 2026: 30 days, 5 Sundays, Diwali on the 9th → 24 working days
  const att = [rec('2026-11-02', 'present'), rec('2026-11-03', 'absent'), rec('2026-11-04', 'half_day'), rec('2026-11-05', 'leave'), rec('2026-11-06', 'wfh')]
  it('summarises a month', () => {
    const s = attendanceSummary('e05', '2026-11-01', '2026-11-30', att, HOLIDAYS)
    expect(s).toMatchObject({ workingDays: 24, present: 1, absent: 1, halfDay: 1, leave: 1, wfh: 1, unmarked: 19, effective: 2.5 })
    expect(s.rate).toBe(62.5) // 2.5 of 4 marked non-leave days
  })
  it('deducts loss of pay for absent and half days', () => {
    const e = emps.find((x) => x.id === 'e05')! // basic 32000, gross 32000+12800+6400 = 51200
    const p = payslip(e, '2026-11', att, HOLIDAYS)
    expect(p.lopDays).toBe(1.5)
    expect(p.earnings.gross).toBe(51200)
    expect(p.deductions.lop).toBe(Math.round((51200 / 24) * 1.5))
    expect(p.deductions.pf).toBe(1800) // capped
    expect(p.net).toBe(51200 - 1800 - 200 - p.deductions.lop)
  })
})

describe('masking', () => {
  it('masks PAN and bank account', () => {
    expect(maskPAN('ABCDE1234F')).toBe('ABCDE****F')
    expect(maskAccount('123456789012')).toBe('XXXX9012')
  })
})
