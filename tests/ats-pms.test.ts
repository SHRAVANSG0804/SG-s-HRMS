import { describe, expect, it } from 'vitest'
import { answer } from '../src/lib/chatbot'
import {
  applyIncrement, canReview, cycleParticipants, nextStage, pipelineCounts, reviewStage, reviewerOf, suggestedIncrement, visibleInterviews, visibleJobs, weightedRating,
} from '../src/lib/rules'
import { seedData } from '../src/lib/seed'
import type { Goal } from '../src/lib/types'

const data = seedData(new Date('2026-10-30T06:00:00Z'))
const hr = { role: 'hr' as const, employeeId: 'e01' }
const ops = { role: 'manager' as const, employeeId: 'e02' }
const tech = { role: 'manager' as const, employeeId: 'e04' }
const emp = { role: 'employee' as const, employeeId: 'e05' }

describe('ATS rules', () => {
  it('scopes jobs by role', () => {
    expect(visibleJobs(hr, data.jobs)).toHaveLength(data.jobs.length)
    expect(visibleJobs(ops, data.jobs).map((j) => j.id)).toEqual(['J3', 'J4'])
    expect(visibleJobs(emp, data.jobs)).toEqual([])
  })
  it('shows managers interviews they conduct or own', () => {
    const ivs = visibleInterviews(tech, data.interviews, data.candidates, data.jobs)
    expect(ivs.every((i) => i.interviewerId === 'e04' || data.candidates.find((c) => c.id === i.candidateId)!.jobId === 'J1')).toBe(true)
    expect(ivs.some((i) => i.id === 'I7')).toBe(false) // Sales interview
  })
  it('moves along the pipeline', () => {
    expect(nextStage('applied')).toBe('screening')
    expect(nextStage('offer')).toBe('hired')
    expect(nextStage('hired')).toBeNull()
    expect(nextStage('rejected')).toBeNull()
  })
  it('counts candidates per stage', () => {
    expect(pipelineCounts('J1', data.candidates)).toMatchObject({ applied: 1, screening: 1, interview: 2, offer: 1, rejected: 1, hired: 0 })
  })
})

describe('PMS rules', () => {
  const g = (weight: number, selfRating?: number): Goal => ({ id: String(weight), cycleId: 'x', employeeId: 'e05', title: '', description: '', weight, progress: 0, approved: true, selfRating })
  it('computes a weighted rating', () => {
    expect(weightedRating([g(40, 5), g(35, 3), g(25, 4)], 'selfRating')).toBe(4.1)
    expect(weightedRating([g(50, 5), g(50)], 'selfRating')).toBeNull()
  })
  it('derives the review stage', () => {
    expect(reviewStage([{ ...g(100), approved: false }], undefined)).toBe('goals_pending')
    expect(reviewStage([g(100)], undefined)).toBe('self_pending')
    expect(reviewStage([g(100)], { cycleId: 'x', employeeId: 'e05', selfRating: 4 })).toBe('manager_pending')
    expect(reviewStage([g(100)], { cycleId: 'x', employeeId: 'e05', selfRating: 4, managerRating: 4 })).toBe('hr_pending')
    expect(reviewStage([g(100)], { cycleId: 'x', employeeId: 'e05', finalRating: 4 })).toBe('finalised')
  })
  it('routes reviews to the manager, or HR when there is none', () => {
    const byId = (id: string) => data.employees.find((e) => e.id === id)!
    expect(reviewerOf(byId('e05'))).toBe('e02')
    expect(reviewerOf(byId('e02'))).toBe('e01')
    expect(reviewerOf(byId('e01'))).toBeNull()
    expect(canReview(ops, byId('e05'))).toBe(true)
    expect(canReview(ops, byId('e10'))).toBe(false)
    expect(canReview(ops, byId('e02'))).toBe(false) // not your own
    expect(cycleParticipants(data.cycles[1], data.employees).some((e) => e.id === 'e01')).toBe(false)
  })
  it('suggests and applies increments', () => {
    expect([1, 2, 3, 4, 5].map(suggestedIncrement)).toEqual([0, 3, 6, 10, 15])
    expect(applyIncrement({ basic: 30000, hra: 12000, allowances: 6000 }, 10)).toEqual({ basic: 33000, hra: 13200, allowances: 6600 })
  })
  it('seeds a closed and an in-review cycle with consistent reviews', () => {
    expect(data.cycles.map((c) => c.phase)).toEqual(['closed', 'review'])
    const h1 = data.reviews.filter((r) => r.cycleId === 'PC1')
    expect(h1.every((r) => r.finalRating && r.incrementPct === suggestedIncrement(r.finalRating))).toBe(true)
    const goals = data.goals.filter((x) => x.cycleId === 'PC2' && x.employeeId === 'e05')
    expect(goals.reduce((s, x) => s + x.weight, 0)).toBe(100)
  })
})

describe('chatbot: ATS & PMS', () => {
  const ask = (s: { role: 'hr' | 'manager' | 'employee'; employeeId: string }, q: string) => answer(q, { session: s, data, today: '2026-10-30' }).text
  it('HR sees all open positions', () => {
    const t = ask(hr, 'open positions')
    expect(t).toMatch(/Senior Developer/)
    expect(t).toMatch(/Sales Executive/)
  })
  it('managers only see their own hiring', () => {
    const t = ask(ops, 'my hiring pipeline')
    expect(t).toMatch(/Production Supervisor/)
    expect(t).not.toMatch(/Senior Developer/)
  })
  it('lists a manager’s interviews', () => {
    expect(ask(tech, 'my upcoming interviews')).toMatch(/Akash Naik|Farhan Shaikh/)
  })
  it('keeps recruitment away from employees', () => {
    expect(ask(emp, 'show candidates for the developer job')).toMatch(/handled by HR/)
  })
  it('gives employees their own goals and last rating', () => {
    const t = ask(emp, 'my goals and review')
    expect(t).toMatch(/Reduce line downtime/)
    expect(t).toMatch(/Last cycle/)
  })
  it('summarises team reviews and HR queue', () => {
    expect(ask(ops, 'team review status')).toMatch(/Sneha Pai/)
    expect(ask(hr, 'reviews awaiting HR')).toMatch(/Awaiting HR/)
    expect(ask(hr, 'rating distribution')).toMatch(/H1 2026/)
  })
  it('looks up a candidate by name for HR', () => {
    expect(ask(hr, 'candidate Neha Bhat')).toMatch(/Stage: Offer/)
  })
})
