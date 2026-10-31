# SG HRMS

A Human Resource Management System for HR, managers and employees: manual attendance, employee directory, leave management, payroll overview, reports, and a role-specific chat assistant.

## Sign-in

Each role has its own password:

| Role | Password | What they can do |
|---|---|---|
| Manager | `1234` | Mark attendance and approve leave for their direct reports, view team reports, own payslip |
| HR | `5678` | Everything: employees, attendance for all, leave approvals, holidays, payroll, reports |
| Employee | `9101` | Own attendance calendar, apply for/cancel leave, own payslip |

Managers and employees pick their profile from a list after choosing the role.

> These passwords are checked in the browser. They separate the three views but are **not real security**: anyone who opens the site's code can read them. Use a real auth provider before putting real employee data in this app.

## Features

- **Manual attendance:** daily sheet with Present / WFH / Half day / Absent / Leave, check-in and check-out times, remarks, "mark all unmarked present", and back-dating. Includes a monthly register grid with CSV export. Employees see a personal calendar.
- **Employee directory:** HR can add, edit, deactivate and reactivate employees. PAN and bank numbers are masked, with an HR-only reveal.
- **Leave management:** CL 8, SL 7 and EL 15 days per year. Balances are computed, not stored. Overlap and balance checks run on every request. Requests go to the manager (HR for managers). Approved leave is written into attendance. HR maintains the holiday calendar.
- **Payroll overview:** Basic + HRA + allowances, PF at 12% of earned basic (capped at ₹1,800) and ₹200 professional tax. Loss of pay comes from absent days and half days. Includes printable payslips and a CSV export.
- **Dashboards and reports:** attendance trend, headcount and department attendance rates, with CSV exports.
- **Chat assistants:** *HR Copilot*, *Manager Assistant* and *My HR Assistant*. Each answers from live data and only within what that role is allowed to see.

All dates are handled in IST (Asia/Kolkata).

## Data storage

Data is kept in the browser's `localStorage`, so each browser or device has its own copy. It starts with 20 demo employees and 60 days of attendance. HR can restore the demo data with **Reset demo data** in the sidebar.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # business-rule and chatbot tests
npm run build    # production build in dist/
```

Stack: Vite, React 19, TypeScript, Tailwind CSS v4, lucide-react and Vitest.

## Deploying to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the `SHRAVANSG0804/SG-s-HRMS` repository.
2. Vercel detects **Vite** automatically (build: `npm run build`, output: `dist`). Click **Deploy**.
3. After that, every push to `main` redeploys automatically.
