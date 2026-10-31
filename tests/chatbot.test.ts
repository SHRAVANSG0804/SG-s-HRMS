import { describe, expect, it } from 'vitest'
import { answer } from '../src/lib/chatbot'
import { seedData } from '../src/lib/seed'

const now = new Date('2026-10-30T06:00:00Z') // Friday, 11:30 IST
const data = seedData(now)
const today = '2026-10-30'
const ask = (role: 'hr' | 'manager' | 'employee', employeeId: string, q: string) => answer(q, { session: { role, employeeId }, data, today }).text

describe('role-specific chatbot', () => {
  it('gives employees their own balance', () => {
    expect(ask('employee', 'e05', 'what is my leave balance?')).toMatch(/Casual Leave/)
  })
  it('refuses employees information about others', () => {
    expect(ask('employee', 'e05', 'what is the salary of my colleague?')).toMatch(/only share your own/)
  })
  it('shows managers only their own team', () => {
    const t = ask('manager', 'e02', 'pending leave approvals')
    expect(t).toMatch(/Meera Fernandes/) // e07 reports to e02
    expect(t).not.toMatch(/Nikhil Borkar/) // e12 reports to e03
  })
  it('keeps salaries away from managers', () => {
    expect(ask('manager', 'e02', 'payroll cost')).toMatch(/confidential/)
  })
  it('gives HR company-wide headcount and payroll', () => {
    expect(ask('hr', 'e01', 'headcount by department')).toMatch(/Active headcount: \*\*20\*\*/)
    expect(ask('hr', 'e01', 'payroll cost this month')).toMatch(/Net payout/)
  })
  it('looks up a named team member', () => {
    expect(ask('manager', 'e02', 'attendance of Sneha')).toMatch(/Sneha Pai/)
    expect(ask('manager', 'e02', 'attendance of Aditya')).not.toMatch(/Aditya Rao/)
  })
})
