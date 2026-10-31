import { Award, CheckCircle2, ClipboardCheck, Pencil, Plus, Star, Target, Trash2, TrendingUp, Users } from 'lucide-react'
import { useState } from 'react'
import { HBars } from '../components/charts'
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, Textarea, cx, useToast } from '../components/ui'
import { fmtDate } from '../lib/date'
import {
  PHASE_META, RATING_LABEL, REVIEW_STAGE_META, applyIncrement, canReview, cycleParticipants, goalWeightTotal, inr, reviewStage, reviewerOf, scopeEmployees, suggestedIncrement, weightedRating,
} from '../lib/rules'
import { useStore, type GoalInput } from '../lib/store'
import type { Employee, Goal, ReviewCycle } from '../lib/types'

type Res = { ok: true } | { ok: false; error: string }

function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? 'Rating' : `Rated ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          role={onChange ? 'radio' : undefined}
          aria-checked={onChange ? value === n : undefined}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          title={RATING_LABEL[n]}
          onClick={() => onChange?.(n)}
          className={cx(onChange && 'cursor-pointer', 'disabled:cursor-default')}
        >
          <Star size={size} className={n <= Math.round(value) ? 'fill-warn text-warn' : 'text-line'} />
        </button>
      ))}
    </span>
  )
}

const Rating = ({ v }: { v?: number }) => (v ? <span className="inline-flex items-center gap-1 font-semibold tabular-nums"><Star size={13} className="fill-warn text-warn" />{v}</span> : <span className="text-muted">—</span>)

function useCycle() {
  const { data } = useStore()
  const def = data.cycles.find((c) => c.phase !== 'closed') ?? data.cycles[data.cycles.length - 1]
  return useState(def?.id ?? '')
}

// ---------- Goals ----------

function GoalForm({ cycleId, employeeId, goal, onClose }: { cycleId: string; employeeId: string; goal?: Goal; onClose: () => void }) {
  const { data, saveGoal } = useStore()
  const toast = useToast()
  const left = 100 - goalWeightTotal(data.goals.filter((g) => g.cycleId === cycleId && g.employeeId === employeeId && g.id !== goal?.id))
  const [f, setF] = useState<GoalInput>(goal ? { title: goal.title, description: goal.description, weight: goal.weight } : { title: '', description: '', weight: Math.min(left, 30) })
  const [error, setError] = useState('')
  const submit = () => {
    const r = saveGoal(cycleId, employeeId, f, goal?.id)
    if (!r.ok) return setError(r.error)
    toast(goal ? 'Goal updated' : 'Goal added')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={goal ? 'Edit goal' : 'Add goal'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Save goal</Button></>}>
      <div className="space-y-4">
        <Field label="Goal / KRA"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Reduce line downtime by 15%" autoFocus /></Field>
        <Field label="How it will be measured"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Weightage (%)" hint={`${left}% of 100% still unassigned`}><Input type="number" min={1} max={100} value={f.weight} onChange={(e) => setF({ ...f, weight: Number(e.target.value) || 0 })} /></Field>
        <p className="text-xs text-muted">Changing goals sends them back for approval.</p>
      </div>
      {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{error}</p>}
    </Modal>
  )
}

function GoalList({ cycle, employeeId, editable, ownProgress }: { cycle: ReviewCycle; employeeId: string; editable: boolean; ownProgress: boolean }) {
  const { data, deleteGoal, updateGoalProgress } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const goals = data.goals.filter((g) => g.cycleId === cycle.id && g.employeeId === employeeId)
  const total = goalWeightTotal(goals)
  return (
    <>
      {goals.length === 0 ? (
        <Empty icon={<Target size={22} />} title="No goals yet" text={editable ? 'Add 3–5 goals that add up to 100% weightage.' : undefined} />
      ) : (
        <ul className="divide-y divide-line">
          {goals.map((g) => (
            <li key={g.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{g.title}</p>
                  {g.description && <p className="mt-0.5 text-xs text-muted">{g.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="info">{g.weight}%</Badge>
                  {g.approved ? <Badge tone="ok"><CheckCircle2 size={11} /> Approved</Badge> : <Badge tone="warn">Awaiting approval</Badge>}
                  {editable && (
                    <>
                      <button className="rounded p-1 text-muted hover:text-ink cursor-pointer" aria-label="Edit goal" onClick={() => setEditing(g)}><Pencil size={14} /></button>
                      <button className="rounded p-1 text-muted hover:text-bad cursor-pointer" aria-label="Delete goal" onClick={() => { if (!confirm('Delete this goal?')) return; const r = deleteGoal(g.id); toast(r.ok ? 'Goal deleted' : r.error, r.ok ? 'ok' : 'bad') }}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                {ownProgress ? (
                  <input
                    type="range" min={0} max={100} step={5} value={g.progress}
                    onChange={(e) => updateGoalProgress(g.id, Number(e.target.value))}
                    className="h-2 flex-1 cursor-pointer accent-ok" aria-label={`Progress for ${g.title}`}
                  />
                ) : (
                  <div className="h-2 flex-1 rounded-full bg-soft"><div className="h-2 rounded-full bg-ok" style={{ width: `${g.progress}%` }} /></div>
                )}
                <span className="w-10 text-right text-xs font-semibold tabular-nums">{g.progress}%</span>
              </div>
              {(g.selfRating || g.managerRating) && (
                <p className="mt-2 flex gap-4 text-xs text-muted">
                  {g.selfRating && <span>Self: <Rating v={g.selfRating} /></span>}
                  {g.managerRating && <span>Manager: <Rating v={g.managerRating} /></span>}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs">
        <span className={total === 100 ? 'text-ok font-semibold' : 'text-warn font-semibold'}>Total weightage: {total}%{total !== 100 && ' (must be 100%)'}</span>
        {editable && total < 100 && <Button size="sm" variant="secondary" onClick={() => setEditing('new')}><Plus size={14} /> Add goal</Button>}
      </div>
      {editing && <GoalForm cycleId={cycle.id} employeeId={employeeId} goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

// ---------- Rating form (self or manager) ----------

function RatingForm({ goals, onSubmit, submitLabel, commentsLabel }: { goals: Goal[]; onSubmit: (r: Record<string, number>, c: string) => Res; submitLabel: string; commentsLabel: string }) {
  const toast = useToast()
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [comments, setComments] = useState('')
  const [error, setError] = useState('')
  const preview = weightedRating(goals.map((g) => ({ ...g, selfRating: ratings[g.id] })), 'selfRating')
  return (
    <div className="space-y-4 p-5">
      {goals.map((g) => (
        <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{g.title}</p>
            <p className="text-xs text-muted">{g.weight}% · {g.progress}% complete{g.selfRating ? ` · self-rated ${g.selfRating}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <Stars value={ratings[g.id] ?? 0} onChange={(n) => setRatings({ ...ratings, [g.id]: n })} size={22} />
            <span className="hidden w-36 text-xs text-muted sm:block">{ratings[g.id] ? RATING_LABEL[ratings[g.id]] : 'Not rated'}</span>
          </div>
        </div>
      ))}
      <Field label={commentsLabel}><Textarea value={comments} onChange={(e) => setComments(e.target.value)} /></Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Weighted rating: <strong>{preview ?? '—'}</strong>{preview && <span className="text-muted"> · {RATING_LABEL[Math.round(preview)]}</span>}</p>
        <Button onClick={() => { const r = onSubmit(ratings, comments); if (!r.ok) setError(r.error); else toast('Review submitted') }}><ClipboardCheck size={16} /> {submitLabel}</Button>
      </div>
      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{error}</p>}
    </div>
  )
}

function ReviewSummary({ cycleId, emp, showFinal }: { cycleId: string; emp: Employee; showFinal: boolean }) {
  const { data } = useStore()
  const rev = data.reviews.find((r) => r.cycleId === cycleId && r.employeeId === emp.id)
  const reviewer = data.employees.find((e) => e.id === (rev?.reviewerId ?? reviewerOf(emp)))
  if (!rev?.selfRating && !rev?.managerRating) return null
  return (
    <div className="grid gap-4 p-5 md:grid-cols-3">
      <div className="rounded-xl border border-line p-4">
        <p className="text-xs font-bold tracking-wide text-muted uppercase">Self review</p>
        {rev.selfRating ? (
          <>
            <p className="mt-2 flex items-center gap-2"><Stars value={rev.selfRating} /> <strong>{rev.selfRating}</strong></p>
            {rev.selfComments && <p className="mt-2 text-sm text-ink-2">“{rev.selfComments}”</p>}
            <p className="mt-2 text-xs text-muted">Submitted {fmtDate(rev.selfSubmittedOn!)}</p>
          </>
        ) : <p className="mt-2 text-sm text-muted">Not submitted</p>}
      </div>
      <div className="rounded-xl border border-line p-4">
        <p className="text-xs font-bold tracking-wide text-muted uppercase">Manager review</p>
        {rev.managerRating ? (
          <>
            <p className="mt-2 flex items-center gap-2"><Stars value={rev.managerRating} /> <strong>{rev.managerRating}</strong></p>
            {rev.managerComments && <p className="mt-2 text-sm text-ink-2">“{rev.managerComments}”</p>}
            <p className="mt-2 text-xs text-muted">By {reviewer?.name ?? '—'} · {fmtDate(rev.managerSubmittedOn!)}</p>
          </>
        ) : <p className="mt-2 text-sm text-muted">Pending with {reviewer?.name ?? 'reviewer'}</p>}
      </div>
      <div className={cx('rounded-xl border p-4', rev.finalRating && showFinal ? 'border-ok bg-ok-soft/40' : 'border-line')}>
        <p className="text-xs font-bold tracking-wide text-muted uppercase">Final (HR)</p>
        {rev.finalRating && showFinal ? (
          <>
            <p className="mt-2 flex items-center gap-2"><Stars value={rev.finalRating} /> <strong>{rev.finalRating}</strong></p>
            <p className="mt-1 text-sm font-semibold">{RATING_LABEL[rev.finalRating]}</p>
            <p className="mt-2 text-sm">Increment: <strong className="text-ok">{rev.incrementPct}%</strong></p>
            <p className="mt-1 text-xs text-muted">Finalised {fmtDate(rev.finalisedOn!)}</p>
          </>
        ) : <p className="mt-2 text-sm text-muted">{rev.finalRating ? 'Finalised' : 'Not finalised yet'}</p>}
      </div>
    </div>
  )
}

// ---------- Review modal (manager / HR) ----------

function FinaliseForm({ cycleId, emp }: { cycleId: string; emp: Employee }) {
  const { data, finaliseReview } = useStore()
  const toast = useToast()
  const rev = data.reviews.find((r) => r.cycleId === cycleId && r.employeeId === emp.id)!
  const [rating, setRating] = useState(Math.round(rev.managerRating!))
  const [pct, setPct] = useState(suggestedIncrement(Math.round(rev.managerRating!)))
  const [error, setError] = useState('')
  const after = applyIncrement(emp.salary, pct)
  const gross = (s: Employee['salary']) => s.basic + s.hra + s.allowances
  return (
    <div className="space-y-4 border-t border-line p-5">
      <p className="text-xs font-bold tracking-wide text-muted uppercase">Finalise &amp; appraisal</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Final rating" hint={RATING_LABEL[rating]}>
          <Select value={rating} onChange={(e) => { const n = Number(e.target.value); setRating(n); setPct(suggestedIncrement(n)) }}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} · {RATING_LABEL[n]}</option>)}
          </Select>
        </Field>
        <Field label="Increment (%)" hint={`Suggested for rating ${rating}: ${suggestedIncrement(rating)}%`}>
          <Input type="number" min={0} max={50} step={0.5} value={pct} onChange={(e) => setPct(Number(e.target.value) || 0)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3 text-sm">
        <span>Monthly gross: <strong>{inr(gross(emp.salary))}</strong> → <strong className="text-ok">{inr(gross(after))}</strong></span>
        <Button variant="success" onClick={() => {
          if (!confirm(`Finalise ${emp.name} at rating ${rating} with a ${pct}% increment? Their salary will be updated in payroll.`)) return
          const r = finaliseReview(cycleId, emp.id, rating, pct)
          if (!r.ok) setError(r.error); else toast('Review finalised and salary updated')
        }}><Award size={16} /> Finalise &amp; apply increment</Button>
      </div>
      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{error}</p>}
    </div>
  )
}

function ReviewModal({ cycle, emp, onClose }: { cycle: ReviewCycle; emp: Employee; onClose: () => void }) {
  const { data, session, approveGoals, submitManagerReview } = useStore()
  const toast = useToast()
  const goals = data.goals.filter((g) => g.cycleId === cycle.id && g.employeeId === emp.id)
  const rev = data.reviews.find((r) => r.cycleId === cycle.id && r.employeeId === emp.id)
  const stage = reviewStage(goals, rev)
  const reviewer = canReview(session!, emp)
  return (
    <Modal open wide onClose={onClose} title={`${emp.name} · ${cycle.name}`}>
      <div className="-mx-5 -my-5">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <Avatar name={emp.name} />
          <div className="flex-1">
            <p className="font-semibold">{emp.name}</p>
            <p className="text-xs text-muted">{emp.designation} · {emp.department}</p>
          </div>
          <Badge tone={REVIEW_STAGE_META[stage].tone}>{REVIEW_STAGE_META[stage].label}</Badge>
        </div>
        <div className="border-t border-line">
          <div className="flex items-center justify-between px-5 pt-4">
            <p className="text-xs font-bold tracking-wide text-muted uppercase">Goals</p>
            {reviewer && cycle.phase === 'goal_setting' && goals.length > 0 && goals.some((g) => !g.approved) && (
              <Button size="sm" variant="success" onClick={() => { const r = approveGoals(cycle.id, emp.id); toast(r.ok ? 'Goals approved' : r.error, r.ok ? 'ok' : 'bad') }}><CheckCircle2 size={14} /> Approve goals</Button>
            )}
          </div>
          <GoalList cycle={cycle} employeeId={emp.id} editable={reviewer && cycle.phase === 'goal_setting'} ownProgress={false} />
        </div>
        <div className="border-t border-line"><ReviewSummary cycleId={cycle.id} emp={emp} showFinal /></div>
        {reviewer && cycle.phase === 'review' && stage === 'manager_pending' && (
          <div className="border-t border-line">
            <p className="px-5 pt-4 text-xs font-bold tracking-wide text-muted uppercase">Your review</p>
            <RatingForm goals={goals} submitLabel="Submit manager review" commentsLabel="Overall feedback for the employee" onSubmit={(r, c) => submitManagerReview(cycle.id, emp.id, r, c)} />
          </div>
        )}
        {session!.role === 'hr' && stage === 'hr_pending' && <FinaliseForm cycleId={cycle.id} emp={emp} />}
        {cycle.phase === 'review' && stage === 'self_pending' && <p className="border-t border-line px-5 py-4 text-sm text-muted">Waiting for {emp.name.split(' ')[0]} to submit a self review.</p>}
      </div>
    </Modal>
  )
}

// ---------- Views ----------

function MyPerformance({ cycle }: { cycle: ReviewCycle }) {
  const { data, me, submitSelfReview } = useStore()
  const goals = data.goals.filter((g) => g.cycleId === cycle.id && g.employeeId === me!.id)
  const rev = data.reviews.find((r) => r.cycleId === cycle.id && r.employeeId === me!.id)
  const stage = reviewStage(goals, rev)
  const inCycle = cycleParticipants(cycle, data.employees).some((e) => e.id === me!.id)
  if (!inCycle) return <Card><Empty icon={<Target size={22} />} title="You are not part of this review cycle" text="Your goals and reviews are handled outside the app." /></Card>
  return (
    <div className="space-y-6">
      <Card title="My goals" subtitle={cycle.phase === 'goal_setting' ? 'Set your goals and send them for approval. Update progress any time.' : 'Keep your progress up to date.'} action={<Badge tone={REVIEW_STAGE_META[stage].tone}>{REVIEW_STAGE_META[stage].label}</Badge>}>
        <GoalList cycle={cycle} employeeId={me!.id} editable={cycle.phase === 'goal_setting'} ownProgress={cycle.phase !== 'closed'} />
      </Card>
      {cycle.phase === 'review' && stage === 'self_pending' && (
        <Card title="Self review" subtitle="Rate yourself on each goal. You can submit once.">
          <RatingForm goals={goals} submitLabel="Submit self review" commentsLabel="Highlights, challenges and support you need" onSubmit={(r, c) => submitSelfReview(cycle.id, r, c)} />
        </Card>
      )}
      {(rev?.selfRating || rev?.managerRating) && <Card title="Review summary"><ReviewSummary cycleId={cycle.id} emp={me!} showFinal /></Card>}
    </div>
  )
}

function ReviewTable({ cycle, people, onOpen }: { cycle: ReviewCycle; people: Employee[]; onOpen: (e: Employee) => void }) {
  const { data } = useStore()
  if (!people.length) return <Empty icon={<Users size={22} />} title="Nobody to review in this cycle" />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-muted">
            <th className="px-5 py-3">Employee</th>
            <th className="px-3 py-3">Goals</th>
            <th className="px-3 py-3">Avg. progress</th>
            <th className="px-3 py-3">Self</th>
            <th className="px-3 py-3">Manager</th>
            <th className="px-3 py-3">Final</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {people.map((e) => {
            const goals = data.goals.filter((g) => g.cycleId === cycle.id && g.employeeId === e.id)
            const rev = data.reviews.find((r) => r.cycleId === cycle.id && r.employeeId === e.id)
            const stage = reviewStage(goals, rev)
            const avg = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0
            return (
              <tr key={e.id} className="cursor-pointer hover:bg-canvas/70" onClick={() => onOpen(e)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={e.name} size="sm" />
                    <div className="min-w-0"><p className="font-semibold whitespace-nowrap">{e.name}</p><p className="truncate text-xs text-muted">{e.designation}</p></div>
                  </div>
                </td>
                <td className="px-3 py-3 tabular-nums">{goals.length} <span className="text-xs text-muted">({goalWeightTotal(goals)}%)</span></td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-soft"><div className="h-1.5 rounded-full bg-ok" style={{ width: `${avg}%` }} /></div><span className="text-xs tabular-nums">{avg}%</span></div>
                </td>
                <td className="px-3 py-3"><Rating v={rev?.selfRating} /></td>
                <td className="px-3 py-3"><Rating v={rev?.managerRating} /></td>
                <td className="px-3 py-3"><Rating v={rev?.finalRating} /></td>
                <td className="px-3 py-3"><Badge tone={REVIEW_STAGE_META[stage].tone}>{REVIEW_STAGE_META[stage].label}</Badge></td>
                <td className="px-5 py-3 text-right"><Button size="sm" variant="ghost">Open</Button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CyclesTab() {
  const { data, createCycle, setCyclePhase } = useStore()
  const toast = useToast()
  const [f, setF] = useState({ name: '', from: '', to: '' })
  const run = (r: Res, msg: string) => toast(r.ok ? msg : r.error, r.ok ? 'ok' : 'bad')
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card title="Review cycles" subtitle="Goal setting → Review → Closed">
        <ul className="divide-y divide-line">
          {[...data.cycles].reverse().map((c) => {
            const ppl = cycleParticipants(c, data.employees)
            const fin = data.reviews.filter((r) => r.cycleId === c.id && r.finalRating).length
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">{fmtDate(c.from)} – {fmtDate(c.to)} · {ppl.length} participants · {fin} finalised</p>
                </div>
                <Badge tone={PHASE_META[c.phase].tone}>{PHASE_META[c.phase].label}</Badge>
                {c.phase === 'goal_setting' && <Button size="sm" onClick={() => confirm(`Start the review phase for ${c.name}? Goals will be locked.`) && run(setCyclePhase(c.id, 'review'), 'Review phase started')}>Start reviews</Button>}
                {c.phase === 'review' && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => run(setCyclePhase(c.id, 'goal_setting'), 'Back to goal setting')}>Reopen goals</Button>
                    <Button size="sm" variant="secondary" onClick={() => confirm(`Close ${c.name}? No further reviews can be submitted.`) && run(setCyclePhase(c.id, 'closed'), 'Cycle closed')}>Close cycle</Button>
                  </>
                )}
                {c.phase === 'closed' && <Button size="sm" variant="ghost" onClick={() => run(setCyclePhase(c.id, 'review'), 'Cycle reopened')}>Reopen</Button>}
              </li>
            )
          })}
        </ul>
      </Card>
      <Card title="New cycle">
        <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); const r = createCycle(f); run(r, 'Cycle created in goal-setting phase'); if (r.ok) setF({ name: '', from: '', to: '' }) }}>
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. H1 2027" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          </div>
          <Button type="submit" className="w-full"><Plus size={16} /> Create cycle</Button>
        </form>
      </Card>
    </div>
  )
}

export function Performance() {
  const { data, session } = useStore()
  const [cycleId, setCycleId] = useCycle()
  const role = session!.role
  const [tab, setTab] = useState<'team' | 'mine' | 'cycles'>(role === 'employee' ? 'mine' : 'team')
  const [open, setOpen] = useState<Employee | null>(null)
  const cycle = data.cycles.find((c) => c.id === cycleId)

  const participants = cycle ? cycleParticipants(cycle, data.employees) : []
  // HR sees everyone; a manager sees their direct reports.
  const people = role === 'hr' ? participants : participants.filter((e) => scopeEmployees(session!, data.employees).some((x) => x.id === e.id))
  const stages = people.map((e) => reviewStage(data.goals.filter((g) => g.cycleId === cycleId && g.employeeId === e.id), data.reviews.find((r) => r.cycleId === cycleId && r.employeeId === e.id)))
  const count = (s: string) => stages.filter((x) => x === s).length
  const finals = data.reviews.filter((r) => r.cycleId === cycleId && r.finalRating && people.some((p) => p.id === r.employeeId))
  const dist = [5, 4, 3, 2, 1].map((n) => ({ label: `${n} · ${RATING_LABEL[n]}`, value: finals.filter((r) => r.finalRating === n).length }))

  const tabs = [
    ...(role !== 'employee' ? [{ value: 'team' as const, label: role === 'hr' ? 'All reviews' : 'My team' }] : []),
    ...(role !== 'hr' ? [{ value: 'mine' as const, label: 'My goals & review' }] : []),
    ...(role === 'hr' ? [{ value: 'cycles' as const, label: 'Cycles' }] : []),
  ]

  return (
    <>
      <PageHeader
        title="Performance"
        subtitle={role === 'employee' ? 'Your goals, self review and final rating.' : role === 'manager' ? 'Set and approve goals, and review your team.' : 'Goals, review cycles, ratings and appraisals.'}
        actions={
          <div className="flex items-center gap-2">
            {cycle && <Badge tone={PHASE_META[cycle.phase].tone}>{PHASE_META[cycle.phase].label}</Badge>}
            <Select value={cycleId} onChange={(e) => setCycleId(e.target.value)} className="w-44" aria-label="Review cycle">
              {[...data.cycles].reverse().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
        }
      />
      {tabs.length > 1 && <div className="mb-6"><Tabs value={tab} onChange={setTab} items={tabs} /></div>}
      {!cycle ? (
        <Card><Empty icon={<Target size={22} />} title="No review cycles yet" text={role === 'hr' ? 'Create a cycle from the Cycles tab.' : 'HR has not started a review cycle.'} /></Card>
      ) : tab === 'cycles' && role === 'hr' ? (
        <CyclesTab />
      ) : tab === 'mine' || role === 'employee' ? (
        <MyPerformance cycle={cycle} />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="In this cycle" value={people.length} hint={`${count('goals_pending')} without approved goals`} icon={<Users size={18} />} tone="info" />
            <StatCard label="Self reviews done" value={people.length - count('goals_pending') - count('self_pending')} hint={`${count('self_pending')} pending`} icon={<ClipboardCheck size={18} />} tone="plum" />
            <StatCard label={role === 'hr' ? 'Awaiting HR' : 'Your reviews pending'} value={role === 'hr' ? count('hr_pending') : count('manager_pending')} hint={role === 'hr' ? `${count('manager_pending')} with managers` : 'Self review submitted'} icon={<TrendingUp size={18} />} tone="warn" />
            <StatCard label="Finalised" value={count('finalised')} hint={finals.length ? `Avg. rating ${(finals.reduce((s, r) => s + r.finalRating!, 0) / finals.length).toFixed(1)}` : 'None yet'} icon={<Award size={18} />} tone="ok" />
          </div>
          <div className={cx('grid gap-6', role === 'hr' && 'xl:grid-cols-3')}>
            <Card className={role === 'hr' ? 'xl:col-span-2' : ''} title={role === 'hr' ? 'All employees' : 'Team reviews'} subtitle="Open a row to approve goals, review or finalise">
              <ReviewTable cycle={cycle} people={people} onOpen={setOpen} />
            </Card>
            {role === 'hr' && (
              <Card title="Final rating distribution" subtitle={`${finals.length} finalised in ${cycle.name}`}>
                <div className="p-5">{finals.length ? <HBars data={dist} format={(n) => `${n}`} color="#2F4FC9" /> : <p className="text-sm text-muted">No reviews finalised yet.</p>}</div>
              </Card>
            )}
          </div>
        </>
      )}
      {open && cycle && <ReviewModal cycle={cycle} emp={data.employees.find((e) => e.id === open.id)!} onClose={() => setOpen(null)} />}
    </>
  )
}
