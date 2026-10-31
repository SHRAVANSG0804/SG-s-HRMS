# Account setup checklist (for checkpoint 3, "Fresh setup")

Do this after sign-off. Everything is on free tiers. Dashboards change often, so if a menu name differs, look for the closest match.
**Never paste keys into chat, commits or screenshots.** They go only in `.env.local` (git-ignored) and in Vercel's environment variables.

---

## 0. Before you start
- [ ] **Make a new Gmail account just for the project** (e.g. `tarang.hr.demo@gmail.com`). The app sends email from it, and you can sign up for the other services with it.
- [ ] **Test logins without 20 inboxes:** Gmail ignores anything after a `+`, so `tarang.hr.demo+hr@gmail.com`, `+mgr1@`, `+emp5@` and so on all land in one inbox. Use these as the seed employees' emails. Every role can then log in, and you can *see* the leave emails arrive.
- [ ] Install Node.js LTS and Git on your laptop.

## 1. GitHub ✅
- [x] Repo: `SHRAVANSG0804/SG-s-HRMS` (exists; `main` is empty apart from the README).
- [ ] Keep `main` for the build; the working notes are on the `docs/working-notes` branch.

## 2. Supabase (database)
- [ ] supabase.com → sign in with GitHub → **New project**.
- [ ] Name `tarang-hr`. Region **Mumbai (ap-south-1)**, the closest to Goa. **Save the database password** in a password manager.
- [ ] Project Settings → **API keys**: copy the **Project URL**, the **publishable / anon key** and the **secret / service_role key**.
  - The secret key bypasses RLS. Use it **only** in the seed script and server-only jobs, never in browser code, and never give it to the AI agent.
- [ ] Database → Extensions: enable **`btree_gist`** (for the no-overlapping-leave constraint).
- [ ] ⚠️ **Free projects pause after about a week with no activity.** Open the app (or the dashboard) every few days, and especially the day before your demo.

## 3. Clerk (login)
- [ ] clerk.com → **Create application** `Tarang HR`. Sign-in method: **Email** (email code or password; pick one and note it in ARCHITECTURE.md).
- [ ] Copy the **Publishable key** and **Secret key** (API keys page).
- [ ] **Connect Clerk to Supabase (native integration, not the old JWT template):**
  1. Clerk dashboard → **Integrations → Supabase** → activate it, and copy the **Clerk domain** it shows.
  2. Supabase → **Authentication → Sign In / Providers → Third-Party Auth → Add provider → Clerk** → paste the domain.
  3. Check: Clerk session tokens now carry `"role": "authenticated"`, and RLS can read the user's ID with `auth.jwt()->>'sub'`.
- [ ] Decide who can sign up. Recommended: leave sign-up open in Clerk; the app shows **Access denied** to anyone whose email isn't an active employee. (Optional extra: Clerk's allowlist restrictions.)
- [ ] Create a Clerk user for each test login (the `+hr`, `+mgr1`, `+emp1`… emails), or let them sign up themselves on first login.

## 4. Gmail SMTP (email)
- [ ] Google Account of the project Gmail → **Security → 2-Step Verification → turn on** (App Passwords need it).
- [ ] Security → **App passwords** → create one named `Tarang HR` → copy the 16-character password (shown only once).
- [ ] SMTP settings: host `smtp.gmail.com`, port `465` (SSL), user = the Gmail address, password = the app password.
- [ ] Limits: a personal Gmail sends about 500 emails a day, plenty for this project. The first emails may land in **Spam**: open one and mark it "Not spam" before the demo.

## 5. AI model keys
- [ ] **Gemini:** aistudio.google.com → **Get API key** → create a key in a new project. Open the **rate limits** page and write today's free limits for the Flash model into ARCHITECTURE.md, with the date.
- [ ] **Groq (fallback):** console.groq.com → **API Keys** → create a key. Write down its free limits too.
- [ ] Don't run the 15-prompt attack test suite in a loop. Each run uses quota.

## 6. Vercel (hosting)
- [ ] vercel.com → sign up **with GitHub** → **Add New → Project** → import `SG-s-HRMS`. Framework: **Next.js**.
- [ ] Add every variable from the list below under **Settings → Environment Variables** (Production and Preview).
- [ ] Deploy, then copy the **live URL** into `README.md` and into `APP_URL`.
- [ ] Clerk → **Domains / allowed origins**: add the Vercel URL so sign-in works on the live site.

## 7. Environment variables
`.env.example` (committed, **blank values**) and `.env.local` (**never committed**, real values) use the same names:

```bash
# App
APP_URL=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only: seed script / admin jobs

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_APP_PASSWORD=
EMAIL_FROM_NAME=Tarang HR

# AI
AI_PROVIDER=gemini                # or groq
GOOGLE_GENERATIVE_AI_API_KEY=
GROQ_API_KEY=
```
- [ ] Check `.gitignore` contains `.env*` with an exception for `!.env.example` **before the first commit of the app**.

## 8. Final checks before checkpoint 4
- [ ] The live URL loads and sign-in works on the Vercel URL.
- [ ] `git log` and the GitHub repo search show **no keys** (search the repo for `sk_`, `eyJ`, `AIza`, `gsk_`).
- [ ] `README.md` lists setup steps, the live URL, and a test login (email + password) for each role: HR, manager, employee. The brief requires this. Use a demo-only password that you use nowhere else, on seed accounts that hold only fake data. If the repo is public, anyone can log in with them, so never put real people's data in this app.
