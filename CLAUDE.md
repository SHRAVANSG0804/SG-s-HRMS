# SG HRMS

A browser-only HRMS (Vite + React + TypeScript + Tailwind v4) deployed on Vercel. It combines core HR with an ATS (Recruitment page) and a PMS (Performance page). There are three roles with fixed passwords: Manager `1234`, HR `5678` and Employee `9101`. Data lives in `localStorage` and is seeded from `src/lib/seed.ts`.

The earlier "Tarang HR" plan (Next.js, Supabase, Clerk) and its notes were replaced by this app at the owner's request on 31 Oct 2026.

## Layout
```
src/lib/date.ts      the only place that deals with time zones (IST); dates are 'YYYY-MM-DD' strings
src/lib/rules.ts     pure business rules: access scope, leave balance/validation, attendance summary, payslip, masks
src/lib/store.tsx    state + localStorage + every mutating action (each action re-checks the role)
src/lib/chatbot.ts   rule-based, role-specific assistant; answers only from rules.ts over the role's scope
src/lib/seed.ts      demo data (20 employees, holidays, 60 days attendance)
src/components/      Layout, ChatBot, charts, ui primitives
src/pages/           Login, Dashboard, Employees, Attendance, Leave, Recruitment (ATS), Performance (PMS), Payroll, Reports
tests/               Vitest: rules, ATS/PMS rules, chatbot
```

## Rules
- Business rules live only in `src/lib/rules.ts` and are reused by screens, CSV exports and the chatbot.
- Never use the browser's local date for business dates; use `todayIST()` / helpers in `date.ts`.
- Every store action checks the role (`canActOn`, HR-only checks) and does not rely on hidden buttons.
- Leave balance is always computed (quota − approved − pending) and never stored.
- ATS: HR sees all jobs; a manager sees only jobs where they are hiring manager (`visibleJobs`). Only HR can hire; hiring creates the employee record.
- PMS: the reviewer is the employee's manager, or HR if they have none (`reviewerOf`); the HR admin is not reviewed in-app. Goal weights must total 100% before approval; review stage is derived (`reviewStage`), never stored. Finalising applies the increment to salary.
- PAN and bank numbers are masked everywhere, including CSVs; only HR can reveal them in the profile.
- Use the theme colours in `src/index.css`; chart series colours are in `src/components/charts.tsx` (palette validated for colour-blind safety).
- If you change the data shape, bump `DATA_VERSION` in `seed.ts` so stale browser data is reseeded.
- Run `npm test` and `npm run build` before committing.
