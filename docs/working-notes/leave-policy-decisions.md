# Leave & attendance policy: decisions on the gaps the PDF leaves open

Decided 31 Oct 2026. These sit on top of the PDF's Konkan Coastal Foods policy, which is implemented exactly as written.
Write them into RESEARCH.md ("leave policy as rules") in your own words. Each worked example below should become an automated test.

| # | Rule | Decision | Worked examples (expected results) |
|---|---|---|---|
| 1 | Pro-rating CL/SL for joiners | `months` = months left in the year, counting the joining month only if joined on or before the 15th. Credit = quota × months / 12, **rounded to the nearest 0.5**. | Join 1 Jul → 6 months → CL **4**, SL **3.5**. Join 20 Jul → 5 months → CL 3.33 → **3.5**, SL 2.92 → **3**. Join 1 Jan or earlier → CL 8, SL 7. |
| 2 | EL accrual | **1.25 on each monthly anniversary** of the joining date. If the joining day doesn't exist in a month (29–31), use that month's last day. EL credited by 31 Dec carries into the next year, capped at 30. | Join 15 Jul 2026 → +1.25 on 15 Aug, 15 Sep, 15 Oct… → 3.75 by 30 Oct. Join 31 Jan → credits 28 Feb, 31 Mar, 30 Apr… Long-serving employee: 12 credits a year = 15. On 1 Jan: opening EL = min(unused EL, 30). |
| 3 | Late → LOP | LOP = floor(lates in calendar month ÷ 3) × 0.5. Resets every month; leftover lates don't carry over. | 2 lates → 0. 3 → **0.5**. 5 → 0.5. 6 → **1.0**. 2 in Oct + 1 in Nov → 0 for both months. |
| 4 | Maternity | **26 weeks = 182 calendar days**. This is the one exception to "leave counts working days only", following the Code on Social Security 2020. | Starting 2 Nov 2026 → ends 2 May 2027 (182 days inclusive). Weekends and holidays inside it are not skipped. |
| 5 | Holiday on a weekly off | No substitute day off. | Goa Liberation Day, Sat 19 Dec 2026, at Panaji HO gives no extra day off. At the Verna plant (Saturday is a working day) it is a holiday. |
| 6 | Half-day leave + work | The day = 0.5 leave + the other half judged on hours: **≥ 4h worked → 0.5 present**, under 4h → 0.5 LOP. The calendar shows "Half day leave". | 0.5 CL + worked 4h10m → 0.5 CL + 0.5 present. 0.5 CL + worked 2h → 0.5 CL + 0.5 LOP. 0.5 CL + no punch → 0.5 CL + 0.5 LOP. |
| 7 | Optional holidays | New leave type **OH "Optional Holiday", quota 2 a year**, credited 1 Jan and pro-rated like CL. It can only be applied on dates HR marked Optional for **the employee's location**, and lapses on 31 Dec. | Panaji employee applies OH on a Panaji optional date → allowed. On an ordinary working day → rejected. A third OH in the year → rejected (offering LOP doesn't apply here). |
| 8 | Regularisation window | Requests are allowed **only for dates within the last 7 calendar days** (today in IST counts as day 0). | Today 30 Oct: 23 Oct → allowed. 22 Oct → rejected with "Regularisation window (7 days) has passed — ask HR". HR can still correct any date, with a logged reason. |
| 9 | SL certificate | Needed when **one SL request covers 3 or more working days**. | Mon–Tue SL (2 days) → no certificate. Mon–Wed (3) → certificate required. Fri + Mon at HO = 2 working days → no certificate. |
| 10 | Exit | `to_date` must be on or before `last_working_day`. When HR deactivates someone, their pending and future approved requests are auto-cancelled (logged), and the balance is frozen. Encashment is payroll's job (out of scope). | LWD 15 Nov; leave 14–18 Nov → rejected. Approved CL on 20 Nov when HR sets LWD 15 Nov → auto-cancelled. |
| 11 | Leave crossing the year | **Blocked** with "Leave years run Jan–Dec: apply for 30–31 Dec and 1–2 Jan separately". Each part uses that year's balance. | 30 Dec 2026 – 2 Jan 2027 → rejected with that message. 28–31 Dec → allowed. |

## Knock-on changes to note in ARCHITECTURE.md / DESIGN.md
- **New leave type OH (rule 7):** seed it. It needs a check that the date is an Optional holiday at the employee's location, and the Settings → Leave types wireframe should show an OH row.
- **Maternity is counted differently (rule 4):** `count_working_days` must skip this leave type and count calendar days instead. The agent should explain this when asked.
- **Day status (rule 6):** half-day leave is a separate branch in the day-status order: Leave (full) › Holiday › Weekly off › **Half-day leave + hours** › WFH › hours.
- **Deactivation (rule 10):** it runs as one transaction that also cancels the person's leave, and each cancellation goes into the audit log.
- **Regularisation (rule 8):** the 7-day limit is checked on the server, not only in the form.
