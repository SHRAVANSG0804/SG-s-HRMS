# HRMS Research Notes — fact sheet for writing RESEARCH.md

> These are raw facts + sources for **you** to turn into RESEARCH.md **in your own words** (the PDF requires that).
> ⚠️ = conflicting or secondary sources — verify against the primary link before citing.
> Researched 30 Oct 2026. Primary government sites (goa.gov.in, indiacode) could not be opened from this session, so open them yourself.

---

## Big finding to lead with (good for the viva)

1. **India's four Labour Codes came into force on 21 Nov 2025.** The Maternity Benefit Act 1961 and the Factories Act 1948 are now folded into the *Code on Social Security 2020* and the *OSH Code 2020*. Old-act names are still widely used, but you should cite the Codes as the current law.
2. **Goa has a new Shops Act:** the *Goa Shops and Establishments (Regulation of Employment and Conditions of Service) Act, 2025* (Act 23 of 2025). It was assented to on 19 Sep 2025 and replaces the 1973 Act. Its commencement date is unclear ⚠️.
3. **The two Konkan sites fall under different laws.** The Panaji head office is a commercial establishment, so it comes under the **Shops Act**. The Verna food *plant* is a **factory**, so it comes under the **OSH Code / old Factories Act** for hours and leave. Saying this in the viva shows real understanding.

---

## Q1. Employee details an Indian HR team keeps

| Category | Fields | Mandatory? | Sensitive? |
|---|---|---|---|
| Identity | Full name, DOB, gender, photo, father/spouse name | Yes | DOB moderate |
| Contact | Mobile, personal email, current + permanent address, PIN, state | Yes | Moderate |
| Job | Employee code, DOJ, designation, department, location, reporting manager, grade, employment type, probation end, last working day | Yes | Grade/salary: yes |
| Statutory | **PAN** (needed for TDS), **Aadhaar** (needed for EPFO KYC), **UAN** (PF; 12 digits; carries over between jobs), ESIC number if salary is under the ESI ceiling | PAN/Aadhaar yes; UAN optional for first job | **Highly sensitive** |
| Bank | Account number, IFSC, bank name, account holder name | Yes (for salary) | **Highly sensitive** |
| Emergency | Name, relation, phone | Yes | Moderate |
| Other | Education, previous employer, nominee details (PF/gratuity) | Varies | Nominee: yes |

**Format rules (needed for your regexes):**
- **PAN:** 5 letters, 4 digits, 1 letter, e.g. `ABCDE1234F`. The 4th letter is the holder type (P = individual, C = company…). For individuals, the 5th letter is the first letter of the surname. Regex: `^[A-Z]{5}[0-9]{4}[A-Z]$`
- **Aadhaar:** 12 digits. The standard practice (RBI/UIDAI "masked Aadhaar") is to hide the first 8 digits and show the last 4. Do not store scans of the full Aadhaar.
- **UAN:** 12 digits, issued by EPFO. It stays the same for life when someone changes jobs, and a new employer should *reuse* it, not create a new one.
- **IFSC:** 4 letters (bank code), then `0`, then 6 letters or digits (branch code). Regex: `^[A-Z]{4}0[A-Z0-9]{6}$`. Source is unverified ⚠️; cross-check on rbi.org.in.

Sources: [PAN – Wikipedia](https://en.wikipedia.org/wiki/Permanent_account_number) · [PAN structure – TaxGuru](https://taxguru.in/income-tax/understanding-permanent-account-number-pan-structure.html) · [Aadhaar masking – Cashfree](https://www.cashfree.com/blog/why-is-aadhaar-masking-mandatory-for-businesses/) · [UAN – Lenvica](https://lenvica.com/provident-fund-universal-account-number-pf-uan/) · [UAN – DBS](https://www.dbs.com/digibank/in/articles/save/what-is-uan-number)

## Q2. Employee code

- The usual format is a company prefix plus a running number (e.g. `KCF0001`). Some companies add a location or year (`KCF-VRN-0042`). Best practice is to keep it **meaningless**: no department or location in it, because people move between them.
- **Why it must never change:**
  - It is the key the payroll vendor, PF/ESI filings, the attendance device and the audit log all use to refer to the person.
  - Changing it breaks history and creates duplicates.
  - Codes are **never reused** after someone exits. A rehire either keeps the old code or gets a new one, as a policy decision.
- *Your design point:* generate it in the **database** (sequence + unique constraint), not in browser code, so two HR users adding employees at once can't get the same code.

## Q3. Leave types, and statutory vs company policy

- **Statutory** means required by law; the company cannot give less. Examples: earned/annual leave under the OSH Code or Shops Act, maternity leave, national/festival holidays.
- **Company policy** means voluntary or above the legal minimum. Examples: paternity leave in the private sector (no central law requires it), comp-off, bereavement, birthday leave, and CL/SL quotas above the state minimum.
- Typical set: CL (casual), SL (sick), EL/PL (earned/privilege), maternity, paternity, LOP (loss of pay, unpaid), comp-off (for working on a holiday/weekly off).
- **Maternity:** 26 weeks for the first two children, of which at most 8 weeks can be before delivery. From the third child it is 12 weeks. Adopting or commissioning mothers get 12 weeks. The 2017 amendment raised it from 12 to 26 weeks. It now sits under **Code on Social Security 2020, Ch. VI (ss. 59–72)**. Eligibility is **80 days worked in the 12 months before delivery** ⚠️ (verify in the Code text).
- **The Goa Shops Act 2025** reportedly gives 15 EL (accumulating up to 45), 6 CL and 9 SL; CL and SL lapse at year end ⚠️. **Konkan's policy (8 CL, 7 SL) would then be *below* the Goa statutory SL figure for head-office staff.** This is a strong point for your research. Mention it, but implement the PDF policy exactly, as the brief instructs.

Sources: [Maternity – labour.gov.in PIB](https://labour.gov.in/sites/default/files/pib1898874.pdf) · [Maternity under SS Code – Taxmann](https://www.taxmann.com/post/blog/analysis-maternity-benefit-under-code-on-social-security/) · [Goa Act 23 of 2025 – PRS](https://prsindia.org/files/bills_acts/acts_states/goa/2025/Act23of2025GA.pdf) · [Digital Goa report](https://digitalgoa.com/goa-government-notifies-new-shops-and-establishments-act-2025-modernising-labour-regulations/)

## Q4. How leave accrues

- **Front-loaded:** the full quota is credited on 1 Jan (Konkan uses this for CL and SL). Joiners get a **pro-rated** share for the months remaining.
- **Monthly accrual:** a fixed amount per completed month (Konkan's EL is 1.25 a month, so 15 a year).
- **Earned by days worked:** the legal minimum under the OSH Code / Factories Act is **1 day per 20 days worked**, if the worker has done **180 days** in the year (the old Factories Act required 240). Carry-forward cap is 30.
- **Year end:**
  - *Lapse:* the balance becomes 0 (Konkan: CL and SL).
  - *Carry forward:* up to a cap (Konkan: EL up to 30).
  - *Encashment:* unused leave is paid out at exit or at year end. Payroll handles this, so it is out of scope, but mention it.

Sources: [Factories Act s.79 – AdvocateKhoj](https://www.advocatekhoj.com/library/bareacts/factories/79.php) · [Labour Codes overview – Bar & Bench](https://www.barandbench.com/law-firms/leading-questions/indias-new-labour-codes-a-concise-overview-of-changes-implementation-and-impact) · [KPMG flash news](https://www.in.kpmg.com/taxflashnews/KPMG-Flash-News-GOI-notifies-implementation-of-Labour-Codes.pdf) · [greytHR Labour Codes guide](https://www.greythr.com/blog/labour-codes-2025/)

## Q5. Shops and Establishments Act: Goa (recommended, since Konkan is in Goa)

- **Old law:** Goa, Daman & Diu Shops and Establishments Act 1973. Hours are s.5, rest interval s.6, holidays s.14, leave s.23.
- **New law:** Goa Shops and Establishments Act 2025 (Act 23 of 2025). Reported figures ⚠️:
  - **10 hours a day and 48 hours a week**, with a spread-over of at most 12 hours (14 for urgent work).
  - A **rest break after 5 hours**.
  - **Weekly holiday** of 24 consecutive hours. If it is denied, a compensatory off must be given within 2 months.
  - **Overtime** beyond 48 hours a week is paid at 2× wages, capped at 144 hours a quarter.
  - **Leave:** 15 EL (after 240 days, accumulating to 45), 6 CL, 9 SL, and **9 paid public holidays**.
  - The full Act applies to establishments with **20 or more workers**; smaller ones only send an online intimation.
- The sources conflict (Keka says 9 hours a day). Quote the PRS / India Code text.

Sources: [Goa Act 2025 – PRS](https://prsindia.org/files/bills_acts/acts_states/goa/2025/Act23of2025GA.pdf) · [Goa Act 2025 – India Code](https://upload.indiacode.nic.in/view-casepdf?type=act&id=AC_GA_65_1387_00004_00004_1776852051253) · [1973 Act – Goa Labour Dept](https://labour.goa.gov.in/wp-content/uploads/2020/07/7475-31-SI-EOG-1-GDD-Shops-Establishment-Act-1973-31-10-1974.pdf) · [Complinity](https://complinity.com/legal-update/government-of-goa-encated-goa-shops-and-establishments-regulation-of-employment-and-conditions-of-service-act-2025-20640/)

## Q6. National vs state vs restricted (optional) holidays

- **National:** Republic Day (26 Jan), Independence Day (15 Aug), Gandhi Jayanti (2 Oct). These are compulsory everywhere in India.
- **State:** declared by the state government, e.g. **Goa Statehood Day (30 May)** and **Goa Liberation Day (19 Dec)**. They apply only to locations in that state. For Konkan, both sites are in Goa, but the PDF still wants holidays per location.
- **Restricted / optional:** a list published every year from which each employee **picks a limited number** (central government staff pick 2). The office stays open.
- The **Goa 2026 list** was notified on 13 Oct 2025 (public, restricted and special holidays). Get the exact dates from the official PDF for your seed data.
- *Design question the PDF leaves open:* how does an employee "take" an optional holiday? Options are a leave type, a selection table, or treating it simply as a holiday. Record your choice in ARCHITECTURE.md.

Sources: [Goa 2026 holidays – goa.gov.in](https://www.goa.gov.in/wp-content/uploads/2025/10/GOVT-NOTIFIES-PUBLIC-HOLIDAYS.pdf) · [DIP Goa press release](https://dip.goa.gov.in/?p=8655) · [Restricted holiday – Hyring](https://hyring.com/free-hr-toolkit/hr-glossary/restricted-holiday-india) · [Gazetted holiday – Hyring](https://hyring.com/free-hr-toolkit/hr-glossary/gazetted-holiday-india)

## Q7. Late arrivals, half days, WFH, missed punches

- **Late:** the common private-sector rule is **3 late marks a month = deduction of a half day**, which is Konkan's rule. The DoPT rule for central government is stricter: each late arrival costs half a day of CL, with 2 exempted per month.
- **Half day:** based on hours worked (Konkan: 4 to under 8 hours).
- **WFH:** recorded separately from office attendance but counted as present. A good policy says who approves it and how it is logged.
- **Missed punch:** the record stays incomplete (Absent or Half Day) until a **regularisation** request is approved. Policies usually set a time window (e.g. within 7 days) and a monthly cap.

Sources: [factoHR attendance policy](https://factohr.com/policy/attendance-policy-for-employees/) · [DoPT punctuality instructions 2024](https://dopt.gov.in/sites/default/files/Punctualityinstructionsdated15062024.pdf) · [Regularisation – IndPayroll](https://www.indpayroll.com/blog/attendance-regularization-how-to-fix-missed-punches-without-payroll-errors) · [Corrida Legal drafting guide](https://corridalegal.com/attendance-and-working-hours-policy-for-indian-companies-practical-drafting-guide-for-employers/)

## Sandwich rule (the PDF asks you to explain it)

- If leave is taken on both sides of a weekend or holiday (e.g. Friday and Monday), the days in between are **also counted as leave**. That makes Friday-to-Monday 4 days instead of 2.
- **It is company policy, not law.** It can only be enforced if it is written into the policy or contract. It is usually applied to CL only.
- **Konkan does not use the sandwich rule**, so Friday-to-Monday at head office = **2 days** (this is in the PDF's testing checklist).

Sources: [Keka – sandwich leave](https://www.keka.com/sandwich-leave-policy) · [PocketHRMS](https://www.pockethrms.com/blog/what-is-sandwich-leave-policy/) · [factoHR](https://factohr.com/policy/sandwich-leave-policy/)

## Q8. Interview: you must do this yourself

Suggested questions for the person you interview:
1. Which HR system do you use (Keka, Zoho People, greytHR, Darwinbox, SAP…)?
2. How do you apply for leave and check your balance, and how many clicks does it take?
3. How is attendance captured (biometric, app, web)? What happens when you forget to punch?
4. What is the most annoying thing about it? What do you wish it did?
5. Does your manager approve quickly? Do you get notifications?
6. Is there a sandwich rule, or a late-coming rule, in your company?

---

## Decisions the PDF leaves open (write your rule for each in RESEARCH.md)

These are where the viva and the testing checklist will catch you if you haven't decided:

1. **Pro-rating rounding.** Joining on 1 July gives CL 8 × 6/12 = **4** and SL 7 × 6/12 = **3.5**. Round to the nearest 0.5? Round down? Decide whether "months remaining" counts the joining month (join 15 July: is that 6 months or 5.5?).
2. **EL for joiners.** Is it 1.25 per *completed* month from the date of joining? Is it credited on the 1st of the next month?
3. **Late → LOP.** Three lates give a half-day LOP. Do 6 lates give 1 day? Which day of the month gets marked?
4. **Maternity is 26 *weeks*** (calendar days, since the law counts weeks), but the PDF says "leave days are working days only". Pick one and explain why. Most HRMSs count maternity in calendar days.
5. **A holiday on a weekly off.** No substitute holiday is given (DoPT practice).
6. **A half-day leave plus a half day worked:** what status does the day get?
7. **Optional holidays:** how many each employee may take, and how they're recorded.
8. **Regularisation window:** how many days back can it be requested? (Leave has a 30-day limit.)
9. **Sick-leave certificate:** "more than 2 consecutive days" counts working days, not calendar days.
10. **Exits:** is the leave balance frozen at the last working day? And can a pending request extend past the last working day?
11. **Calendar year boundary:** how is leave spanning 31 Dec to 1 Jan split across the two leave years?
