import { ArrowRight, Briefcase, CalendarClock, CheckCircle2, Mail, MapPin, Phone, Plus, Star, UserPlus, Users, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, Textarea, cx, useToast } from '../components/ui'
import { fmtDate, fmtDay, todayIST } from '../lib/date'
import {
  JOB_STATUS_META, PIPELINE, STAGE_META, averageInterviewRating, canManageJob, inr, nextStage, pipelineCounts, visibleInterviews, visibleJobs,
} from '../lib/rules'
import { CANDIDATE_SOURCES, DEPARTMENTS, LOCATIONS } from '../lib/seed'
import { useStore, type CandidateInput, type JobInput } from '../lib/store'
import type { Candidate, CandidateStage, Interview, Job } from '../lib/types'

type Res = { ok: true } | { ok: false; error: string }

function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" role={onChange ? 'radiogroup' : undefined} aria-label={onChange ? 'Rating' : `Rated ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          role={onChange ? 'radio' : undefined}
          aria-checked={onChange ? value === n : undefined}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange?.(n)}
          className={cx(onChange && 'cursor-pointer', 'disabled:cursor-default')}
        >
          <Star size={size} className={n <= value ? 'fill-warn text-warn' : 'text-line'} />
        </button>
      ))}
    </span>
  )
}

// ---------- Jobs ----------

function JobForm({ job, onClose }: { job?: Job; onClose: () => void }) {
  const { data, session, saveJob } = useStore()
  const toast = useToast()
  const isHR = session!.role === 'hr'
  const me = data.employees.find((e) => e.id === session!.employeeId)!
  const [f, setF] = useState<JobInput>(
    job ?? {
      title: '', department: isHR ? DEPARTMENTS[1] : me.department, location: me.location, openings: 1,
      hiringManagerId: isHR ? '' : me.id, description: '', minSalary: 25000, maxSalary: 35000,
    },
  )
  const [error, setError] = useState('')
  const managers = data.employees.filter((e) => e.active && (e.id === 'e01' || data.employees.some((x) => x.managerId === e.id && x.active)))
  const set = <K extends keyof JobInput>(k: K, v: JobInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const submit = () => {
    if (!f.hiringManagerId) return setError('Choose a hiring manager.')
    const r = saveJob(f, job?.id)
    if (!r.ok) return setError(r.error)
    toast(job ? 'Job updated' : isHR ? 'Job opened' : 'Hiring request sent to HR')
    onClose()
  }
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={job ? 'Edit job' : isHR ? 'New job opening' : 'Request a new hire'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>{job ? 'Save' : isHR ? 'Open job' : 'Send request'}</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job title" className="sm:col-span-2"><Input value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus /></Field>
        <Field label="Department">
          <Select value={f.department} onChange={(e) => set('department', e.target.value)} disabled={!isHR}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</Select>
        </Field>
        <Field label="Location">
          <Select value={f.location} onChange={(e) => set('location', e.target.value)}>{LOCATIONS.map((d) => <option key={d}>{d}</option>)}</Select>
        </Field>
        <Field label="Hiring manager">
          <Select value={f.hiringManagerId} onChange={(e) => set('hiringManagerId', e.target.value)} disabled={!isHR}>
            <option value="">Select…</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.designation}</option>)}
          </Select>
        </Field>
        <Field label="Openings"><Input type="number" min={1} value={f.openings} onChange={(e) => set('openings', Number(e.target.value) || 0)} /></Field>
        <Field label="Salary from (₹ / month)"><Input type="number" min={0} value={f.minSalary} onChange={(e) => set('minSalary', Number(e.target.value) || 0)} /></Field>
        <Field label="Salary up to (₹ / month)"><Input type="number" min={0} value={f.maxSalary} onChange={(e) => set('maxSalary', Number(e.target.value) || 0)} /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Responsibilities and requirements" /></Field>
      </div>
      {!isHR && !job && <p className="mt-4 text-xs text-muted">HR will review your request before the job opens for candidates.</p>}
      {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{error}</p>}
    </Modal>
  )
}

function JobsTab({ onOpenPipeline }: { onOpenPipeline: (jobId: string) => void }) {
  const { data, session, setJobStatus } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<Job | null | 'new'>(null)
  const [filter, setFilter] = useState<'active' | 'all'>('active')
  const isHR = session!.role === 'hr'
  const jobs = visibleJobs(session!, data.jobs).filter((j) => filter === 'all' || j.status !== 'closed')
  const name = (id: string) => data.employees.find((e) => e.id === id)?.name ?? '—'
  const run = (r: Res, msg: string) => toast(r.ok ? msg : r.error, r.ok ? 'ok' : 'bad')

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onChange={setFilter} items={[{ value: 'active', label: 'Active' }, { value: 'all', label: 'All jobs' }]} />
        <Button onClick={() => setEditing('new')}><Plus size={16} /> {isHR ? 'New job' : 'Request a hire'}</Button>
      </div>
      {jobs.length === 0 ? (
        <Card><Empty icon={<Briefcase size={22} />} title="No jobs yet" text={isHR ? 'Open a job to start receiving candidates.' : 'Request a hire and HR will open the job.'} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {jobs.map((j) => {
            const counts = pipelineCounts(j.id, data.candidates)
            const active = counts.applied + counts.screening + counts.interview + counts.offer
            return (
              <Card key={j.id} className="flex flex-col">
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-semibold">{j.title}</h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                        <span>{j.department}</span>
                        <span className="inline-flex items-center gap-1"><MapPin size={12} />{j.location}</span>
                        <span>{inr(j.minSalary)}–{inr(j.maxSalary)}</span>
                      </p>
                    </div>
                    <Badge tone={JOB_STATUS_META[j.status].tone}>{JOB_STATUS_META[j.status].label}</Badge>
                  </div>
                  {j.description && <p className="mt-3 line-clamp-2 text-sm text-ink-2">{j.description}</p>}
                  <div className="mt-4 grid grid-cols-5 gap-1.5 text-center">
                    {PIPELINE.map((s) => (
                      <div key={s} className="rounded-lg bg-canvas py-2">
                        <p className="font-display text-lg leading-none font-semibold">{counts[s]}</p>
                        <p className="mt-1 text-[10px] text-muted">{STAGE_META[s].label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    Hiring manager: <strong className="text-ink-2">{name(j.hiringManagerId)}</strong> · {counts.hired}/{j.openings} filled · {active} in progress · opened {fmtDate(j.createdOn, { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
                  {isHR && j.status === 'requested' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => run(setJobStatus(j.id, 'closed'), 'Request declined')}>Decline</Button>
                      <Button size="sm" variant="success" onClick={() => run(setJobStatus(j.id, 'open'), 'Job approved and opened')}>Approve &amp; open</Button>
                    </>
                  )}
                  {isHR && j.status === 'open' && <Button size="sm" variant="ghost" onClick={() => run(setJobStatus(j.id, 'on_hold'), 'Job put on hold')}>Put on hold</Button>}
                  {isHR && (j.status === 'on_hold' || j.status === 'closed') && <Button size="sm" variant="ghost" onClick={() => run(setJobStatus(j.id, 'open'), 'Job reopened')}>Reopen</Button>}
                  {isHR && j.status !== 'closed' && j.status !== 'requested' && <Button size="sm" variant="ghost" onClick={() => confirm(`Close "${j.title}"?`) && run(setJobStatus(j.id, 'closed'), 'Job closed')}>Close</Button>}
                  {canManageJob(session!, j) && j.status !== 'closed' && <Button size="sm" variant="secondary" onClick={() => setEditing(j)}>Edit</Button>}
                  <Button size="sm" onClick={() => onOpenPipeline(j.id)}>Pipeline <ArrowRight size={14} /></Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {editing && <JobForm job={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

// ---------- Candidates ----------

function CandidateForm({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { addCandidate } = useStore()
  const toast = useToast()
  const [f, setF] = useState<CandidateInput>({ jobId, name: '', email: '', phone: '', experience: 0, currentCompany: '', expectedSalary: 0, source: CANDIDATE_SOURCES[0], notes: '' })
  const [error, setError] = useState('')
  const set = <K extends keyof CandidateInput>(k: K, v: CandidateInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const submit = () => {
    const r = addCandidate({ ...f, email: f.email.trim() })
    if (!r.ok) return setError(r.error)
    toast('Candidate added')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Add candidate" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Add candidate</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2"><Input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 …" /></Field>
        <Field label="Experience (years)"><Input type="number" min={0} value={f.experience} onChange={(e) => set('experience', Number(e.target.value) || 0)} /></Field>
        <Field label="Current company"><Input value={f.currentCompany} onChange={(e) => set('currentCompany', e.target.value)} /></Field>
        <Field label="Expected salary (₹ / month)"><Input type="number" min={0} value={f.expectedSalary} onChange={(e) => set('expectedSalary', Number(e.target.value) || 0)} /></Field>
        <Field label="Source">
          <Select value={f.source} onChange={(e) => set('source', e.target.value)}>{CANDIDATE_SOURCES.map((s) => <option key={s}>{s}</option>)}</Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
      {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{error}</p>}
    </Modal>
  )
}

function ScheduleForm({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const { data, session, scheduleInterview } = useStore()
  const toast = useToast()
  const job = data.jobs.find((j) => j.id === candidate.jobId)!
  const [f, setF] = useState({ round: 'Technical', interviewerId: session!.role === 'manager' ? session!.employeeId : job.hiringManagerId, date: todayIST(), time: '11:00', mode: 'Video' as Interview['mode'] })
  const [error, setError] = useState('')
  const interviewers = data.employees.filter((e) => e.active && (e.department === job.department || e.id === 'e01' || e.id === job.hiringManagerId))
  const submit = () => {
    const r = scheduleInterview({ candidateId: candidate.id, ...f })
    if (!r.ok) return setError(r.error)
    toast('Interview scheduled')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={`Schedule interview · ${candidate.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Schedule</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Round"><Input value={f.round} onChange={(e) => setF({ ...f, round: e.target.value })} /></Field>
        <Field label="Interviewer">
          <Select value={f.interviewerId} onChange={(e) => setF({ ...f, interviewerId: e.target.value })}>
            {interviewers.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.designation}</option>)}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" min={todayIST()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Time"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Mode">
          <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as Interview['mode'] })}>
            {['Video', 'In person', 'Phone'].map((m) => <option key={m}>{m}</option>)}
          </Select>
        </Field>
      </div>
      {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{error}</p>}
    </Modal>
  )
}

function FeedbackForm({ interview, onClose }: { interview: Interview; onClose: () => void }) {
  const { data, submitInterviewFeedback } = useStore()
  const toast = useToast()
  const cand = data.candidates.find((c) => c.id === interview.candidateId)
  const [rating, setRating] = useState(0)
  const [rec, setRec] = useState<'hire' | 'no_hire'>('hire')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const submit = () => {
    const r = submitInterviewFeedback(interview.id, { rating, recommendation: rec, feedback })
    if (!r.ok) return setError(r.error)
    toast('Feedback submitted')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={`Interview feedback · ${cand?.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Submit feedback</Button></>}>
      <p className="mb-4 text-sm text-muted">{interview.round} round · {fmtDay(interview.date)} at {interview.time} · {interview.mode}</p>
      <div className="space-y-4">
        <Field label="Overall rating"><Stars value={rating} onChange={setRating} size={26} /></Field>
        <Field label="Recommendation">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={rec === 'hire' ? 'success' : 'secondary'} onClick={() => setRec('hire')}><CheckCircle2 size={14} /> Hire</Button>
            <Button type="button" size="sm" variant={rec === 'no_hire' ? 'danger' : 'secondary'} onClick={() => setRec('no_hire')}><XCircle size={14} /> Do not hire</Button>
          </div>
        </Field>
        <Field label="Notes"><Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Strengths, concerns, suggested salary…" /></Field>
      </div>
      {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{error}</p>}
    </Modal>
  )
}

function HireForm({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const { data, hireCandidate } = useStore()
  const toast = useToast()
  const job = data.jobs.find((j) => j.id === candidate.jobId)!
  const basic = Math.round((candidate.expectedSalary || job.minSalary) / 1.6)
  const [f, setF] = useState({
    designation: job.title.replace(/\s*\(.*\)$/, ''), managerId: job.hiringManagerId as string | null, joinDate: todayIST(), location: job.location,
    salary: { basic, hra: Math.round(basic * 0.4), allowances: Math.round(basic * 0.2) },
  })
  const [error, setError] = useState('')
  const managers = data.employees.filter((e) => e.active)
  const setSal = (k: keyof typeof f.salary, v: string) => setF({ ...f, salary: { ...f.salary, [k]: Number(v) || 0 } })
  const submit = () => {
    const r = hireCandidate(candidate.id, f)
    if (!r.ok) return setError(r.error)
    toast(`${candidate.name} added to the employee directory`)
    onClose()
  }
  return (
    <Modal open wide onClose={onClose} title={`Hire ${candidate.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="success" onClick={submit}><UserPlus size={16} /> Hire &amp; create employee</Button></>}>
      <p className="mb-4 text-sm text-muted">This creates an employee record in <strong>{job.department}</strong>. PAN and bank details can be added later from the directory.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Designation"><Input value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></Field>
        <Field label="Reports to">
          <Select value={f.managerId ?? ''} onChange={(e) => setF({ ...f, managerId: e.target.value || null })}>
            <option value="">— No manager (reports to HR) —</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.designation}</option>)}
          </Select>
        </Field>
        <Field label="Joining date"><Input type="date" value={f.joinDate} onChange={(e) => setF({ ...f, joinDate: e.target.value })} /></Field>
        <Field label="Location">
          <Select value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })}>{LOCATIONS.map((l) => <option key={l}>{l}</option>)}</Select>
        </Field>
        <Field label="Basic (₹)"><Input type="number" min={0} value={f.salary.basic} onChange={(e) => setSal('basic', e.target.value)} /></Field>
        <Field label="HRA (₹)"><Input type="number" min={0} value={f.salary.hra} onChange={(e) => setSal('hra', e.target.value)} /></Field>
        <Field label="Other allowances (₹)"><Input type="number" min={0} value={f.salary.allowances} onChange={(e) => setSal('allowances', e.target.value)} /></Field>
        <div className="flex items-end pb-2 text-sm">Gross: <strong className="ml-1">{inr(f.salary.basic + f.salary.hra + f.salary.allowances)}</strong>/month</div>
      </div>
      {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{error}</p>}
    </Modal>
  )
}

function CandidateDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, session, moveCandidate, updateCandidateNotes, cancelInterview } = useStore()
  const toast = useToast()
  const c = data.candidates.find((x) => x.id === id)!
  const job = data.jobs.find((j) => j.id === c.jobId)!
  const [notes, setNotes] = useState(c.notes)
  const [sub, setSub] = useState<'schedule' | 'hire' | Interview | null>(null)
  const manage = canManageJob(session!, job)
  const ivs = data.interviews.filter((i) => i.candidateId === c.id).sort((a, b) => a.date.localeCompare(b.date))
  const avg = averageInterviewRating(c.id, data.interviews)
  const next = nextStage(c.stage)
  const name = (eid: string) => data.employees.find((e) => e.id === eid)?.name ?? '—'
  const run = (r: Res, msg: string) => toast(r.ok ? msg : r.error, r.ok ? 'ok' : 'bad')
  const closedStage = c.stage === 'hired' || c.stage === 'rejected'

  if (sub === 'schedule') return <ScheduleForm candidate={c} onClose={() => setSub(null)} />
  if (sub === 'hire') return <HireForm candidate={c} onClose={() => setSub(null)} />
  if (sub) return <FeedbackForm interview={sub} onClose={() => setSub(null)} />

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Candidate"
      footer={
        manage && !closedStage ? (
          <>
            <Button variant="secondary" onClick={() => confirm(`Reject ${c.name}?`) && run(moveCandidate(c.id, 'rejected'), 'Candidate rejected')}><XCircle size={16} /> Reject</Button>
            <Button variant="secondary" onClick={() => setSub('schedule')}><CalendarClock size={16} /> Schedule interview</Button>
            {next && next !== 'hired' && <Button onClick={() => run(moveCandidate(c.id, next), `Moved to ${STAGE_META[next].label}`)}>Move to {STAGE_META[next].label} <ArrowRight size={16} /></Button>}
            {c.stage === 'offer' && session!.role === 'hr' && <Button variant="success" onClick={() => setSub('hire')}><UserPlus size={16} /> Hire</Button>}
          </>
        ) : manage && c.stage === 'rejected' ? (
          <Button variant="secondary" onClick={() => run(moveCandidate(c.id, 'screening'), 'Candidate moved back to Screening')}>Reconsider</Button>
        ) : undefined
      }
    >
      <div className="flex items-start gap-4">
        <Avatar name={c.name} size="lg" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-semibold">{c.name}</h3>
            <Badge tone={STAGE_META[c.stage].tone}>{STAGE_META[c.stage].label}</Badge>
          </div>
          <p className="text-sm text-muted">{job.title} · applied {fmtDate(c.appliedOn)} via {c.source}</p>
          {avg !== null && <p className="mt-1 flex items-center gap-2 text-sm"><Stars value={Math.round(avg)} size={14} /> <span className="text-muted">{avg} avg. interview rating</span></p>}
        </div>
      </div>
      <div className="mt-5 grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
        <p className="flex items-center gap-2"><Mail size={15} className="text-muted" /> {c.email}</p>
        <p className="flex items-center gap-2"><Phone size={15} className="text-muted" /> {c.phone || '—'}</p>
        <p><span className="text-muted">Experience:</span> {c.experience} yr{c.experience === 1 ? '' : 's'} · {c.currentCompany || '—'}</p>
        <p><span className="text-muted">Expected:</span> {c.expectedSalary ? `${inr(c.expectedSalary)}/month` : '—'} <span className="text-xs text-muted">(band {inr(job.minSalary)}–{inr(job.maxSalary)})</span></p>
        {c.employeeId && <p className="sm:col-span-2"><Badge tone="ok">Employee {data.employees.find((e) => e.id === c.employeeId)?.code}</Badge></p>}
      </div>

      {!closedStage && (
        <div className="mt-5 flex flex-wrap items-center gap-1">
          {PIPELINE.map((s, i) => {
            const reached = PIPELINE.indexOf(c.stage) >= i
            return (
              <span key={s} className="flex items-center gap-1">
                <span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', reached ? 'bg-ink text-white' : 'bg-soft text-muted')}>{STAGE_META[s].label}</span>
                {i < PIPELINE.length - 1 && <span className="h-px w-3 bg-line" />}
              </span>
            )
          })}
        </div>
      )}

      <p className="mt-6 mb-2 text-xs font-bold tracking-wide text-muted uppercase">Interviews</p>
      {ivs.length === 0 ? (
        <p className="text-sm text-muted">No interviews yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {ivs.map((iv) => (
            <li key={iv.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p><strong>{iv.round}</strong> · {name(iv.interviewerId)} · {fmtDay(iv.date)} {iv.time} · {iv.mode}</p>
                <div className="flex items-center gap-2">
                  {iv.status === 'completed' && <><Stars value={iv.rating ?? 0} size={14} /><Badge tone={iv.recommendation === 'hire' ? 'ok' : 'bad'}>{iv.recommendation === 'hire' ? 'Hire' : 'No hire'}</Badge></>}
                  {iv.status === 'scheduled' && <Badge tone="info">Scheduled</Badge>}
                  {iv.status === 'cancelled' && <Badge>Cancelled</Badge>}
                  {iv.status === 'scheduled' && (iv.interviewerId === session!.employeeId || session!.role === 'hr') && <Button size="sm" variant="secondary" onClick={() => setSub(iv)}>Add feedback</Button>}
                  {iv.status === 'scheduled' && manage && <Button size="sm" variant="ghost" onClick={() => run(cancelInterview(iv.id), 'Interview cancelled')}>Cancel</Button>}
                </div>
              </div>
              {iv.feedback && <p className="mt-1 text-ink-2">“{iv.feedback}”</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 mb-2 text-xs font-bold tracking-wide text-muted uppercase">Notes</p>
      {manage ? (
        <div className="flex gap-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="flex-1" />
          <Button variant="secondary" disabled={notes === c.notes} onClick={() => run(updateCandidateNotes(c.id, notes), 'Notes saved')}>Save</Button>
        </div>
      ) : (
        <p className="text-sm text-ink-2">{c.notes || '—'}</p>
      )}
    </Modal>
  )
}

// ---------- Pipeline ----------

const COLUMNS: CandidateStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']

function PipelineTab({ jobId, setJobId }: { jobId: string; setJobId: (id: string) => void }) {
  const { data, session, moveCandidate } = useStore()
  const toast = useToast()
  const jobs = visibleJobs(session!, data.jobs).filter((j) => j.status !== 'requested')
  const job = jobs.find((j) => j.id === jobId) ?? jobs[0]
  const [viewing, setViewing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  if (!job) return <Card><Empty icon={<Users size={22} />} title="No open jobs" text="Candidates appear here once a job is open." /></Card>
  const cands = data.candidates.filter((c) => c.jobId === job.id)
  const manage = canManageJob(session!, job)

  const drop = (stage: CandidateStage) => {
    if (!dragId) return
    const c = cands.find((x) => x.id === dragId)
    setDragId(null)
    if (!c || c.stage === stage) return
    const r = moveCandidate(dragId, stage)
    toast(r.ok ? `${c.name} moved to ${STAGE_META[stage].label}` : r.error, r.ok ? 'ok' : 'bad')
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={job.id} onChange={(e) => setJobId(e.target.value)} className="w-80" aria-label="Job">
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} · {JOB_STATUS_META[j.status].label}</option>)}
        </Select>
        <span className="text-sm text-muted">{cands.length} candidate{cands.length === 1 ? '' : 's'}</span>
        {manage && job.status === 'open' && <Button className="ml-auto" onClick={() => setAdding(true)}><Plus size={16} /> Add candidate</Button>}
      </div>
      <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-6">
        {COLUMNS.map((stage) => {
          const col = cands.filter((c) => c.stage === stage)
          return (
            <div
              key={stage}
              onDragOver={(e) => manage && stage !== 'hired' && e.preventDefault()}
              onDrop={() => drop(stage)}
              className={cx('min-h-48 rounded-2xl border border-line bg-soft/60 p-2.5', dragId && stage !== 'hired' && 'border-dashed border-ink/30')}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <Badge tone={STAGE_META[stage].tone}>{STAGE_META[stage].label}</Badge>
                <span className="text-xs font-semibold text-muted">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map((c) => {
                  const avg = averageInterviewRating(c.id, data.interviews)
                  const upcoming = data.interviews.find((i) => i.candidateId === c.id && i.status === 'scheduled')
                  return (
                    <button
                      key={c.id}
                      draggable={manage && c.stage !== 'hired'}
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setViewing(c.id)}
                      className="w-full rounded-xl border border-line bg-white p-3 text-left shadow-[0_1px_2px_rgba(14,23,38,0.04)] transition-shadow hover:shadow-md cursor-pointer"
                    >
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="mt-0.5 text-xs text-muted">{c.experience} yrs · {c.currentCompany || c.source}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {avg !== null && <span className="inline-flex items-center gap-0.5 text-xs font-semibold"><Star size={12} className="fill-warn text-warn" />{avg}</span>}
                        {upcoming && <Badge tone="info"><CalendarClock size={11} />{fmtDate(upcoming.date, { day: 'numeric', month: 'short' })}</Badge>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {manage && <p className="mt-2 text-xs text-muted">Tip: drag a card to another column to move it, or open it for more actions.</p>}
      {adding && <CandidateForm jobId={job.id} onClose={() => setAdding(false)} />}
      {viewing && <CandidateDetail id={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

// ---------- Interviews ----------

function InterviewsTab() {
  const { data, session } = useStore()
  const today = todayIST()
  const [fb, setFb] = useState<Interview | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const all = visibleInterviews(session!, data.interviews, data.candidates, data.jobs).filter((i) => i.status !== 'cancelled')
  const upcoming = all.filter((i) => i.status === 'scheduled').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const past = all.filter((i) => i.status === 'completed').sort((a, b) => b.date.localeCompare(a.date))
  const cand = (id: string) => data.candidates.find((c) => c.id === id)!
  const job = (id: string) => data.jobs.find((j) => j.id === cand(id).jobId)!
  const name = (id: string) => data.employees.find((e) => e.id === id)?.name ?? '—'

  const Row = ({ iv }: { iv: Interview }) => (
    <tr className="cursor-pointer hover:bg-canvas/70" onClick={() => setViewing(iv.candidateId)}>
      <td className="px-5 py-3">
        <p className="font-semibold">{cand(iv.candidateId).name}</p>
        <p className="text-xs text-muted">{job(iv.candidateId).title}</p>
      </td>
      <td className="px-3 py-3">{iv.round}</td>
      <td className="px-3 py-3 whitespace-nowrap">
        {fmtDay(iv.date)} · {iv.time}
        {iv.status === 'scheduled' && iv.date < today && <p className="text-xs font-semibold text-bad">Feedback overdue</p>}
      </td>
      <td className="px-3 py-3 text-muted">{iv.mode}</td>
      <td className="px-3 py-3">{iv.interviewerId === session!.employeeId ? <Badge tone="brand">You</Badge> : name(iv.interviewerId)}</td>
      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        {iv.status === 'completed' ? (
          <span className="inline-flex items-center gap-2"><Stars value={iv.rating ?? 0} size={13} /><Badge tone={iv.recommendation === 'hire' ? 'ok' : 'bad'}>{iv.recommendation === 'hire' ? 'Hire' : 'No hire'}</Badge></span>
        ) : (iv.interviewerId === session!.employeeId || session!.role === 'hr') ? (
          <Button size="sm" variant="secondary" onClick={() => setFb(iv)}>Add feedback</Button>
        ) : <Badge tone="info">Scheduled</Badge>}
      </td>
    </tr>
  )
  const Table = ({ rows, empty }: { rows: Interview[]; empty: string }) =>
    rows.length === 0 ? <Empty icon={<CalendarClock size={22} />} title={empty} /> : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-muted">
              <th className="px-5 py-3">Candidate</th><th className="px-3 py-3">Round</th><th className="px-3 py-3">When</th><th className="px-3 py-3">Mode</th><th className="px-3 py-3">Interviewer</th><th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">{rows.map((iv) => <Row key={iv.id} iv={iv} />)}</tbody>
        </table>
      </div>
    )

  return (
    <div className="space-y-6">
      <Card title="Upcoming interviews" subtitle={`${upcoming.length} scheduled`}><Table rows={upcoming} empty="No interviews scheduled" /></Card>
      <Card title="Completed interviews" subtitle="With interviewer feedback"><Table rows={past} empty="No completed interviews yet" /></Card>
      {fb && <FeedbackForm interview={fb} onClose={() => setFb(null)} />}
      {viewing && <CandidateDetail id={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

// ---------- Page ----------

export function Recruitment() {
  const { data, session } = useStore()
  const [tab, setTab] = useState<'jobs' | 'pipeline' | 'interviews'>('jobs')
  const [jobId, setJobId] = useState('')
  const jobs = visibleJobs(session!, data.jobs)
  const jobIds = new Set(jobs.map((j) => j.id))
  const cands = data.candidates.filter((c) => jobIds.has(c.jobId))
  const ivs = visibleInterviews(session!, data.interviews, data.candidates, data.jobs)
  const isHR = session!.role === 'hr'

  return (
    <>
      <PageHeader
        title="Recruitment"
        subtitle={isHR ? 'Applicant tracking: jobs, candidate pipeline, interviews and hiring.' : 'Your hiring requests, candidates and interviews.'}
        actions={<Tabs value={tab} onChange={setTab} items={[{ value: 'jobs', label: 'Jobs' }, { value: 'pipeline', label: 'Pipeline' }, { value: 'interviews', label: 'Interviews' }]} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open positions" value={jobs.filter((j) => j.status === 'open').reduce((s, j) => s + j.openings, 0)} hint={`${jobs.filter((j) => j.status === 'requested').length} awaiting HR approval`} icon={<Briefcase size={18} />} tone="info" />
        <StatCard label="Active candidates" value={cands.filter((c) => !['hired', 'rejected'].includes(c.stage)).length} hint={`${cands.filter((c) => c.stage === 'applied').length} new applications`} icon={<Users size={18} />} tone="plum" />
        <StatCard label="Interviews scheduled" value={ivs.filter((i) => i.status === 'scheduled').length} hint={`${ivs.filter((i) => i.status === 'scheduled' && i.interviewerId === session!.employeeId).length} with you`} icon={<CalendarClock size={18} />} tone="warn" />
        <StatCard label="Offers / hired" value={`${cands.filter((c) => c.stage === 'offer').length} / ${cands.filter((c) => c.stage === 'hired').length}`} hint="Across visible jobs" icon={<UserPlus size={18} />} tone="ok" />
      </div>
      {tab === 'jobs' && <JobsTab onOpenPipeline={(id) => { setJobId(id); setTab('pipeline') }} />}
      {tab === 'pipeline' && <PipelineTab jobId={jobId} setJobId={setJobId} />}
      {tab === 'interviews' && <InterviewsTab />}
    </>
  )
}
