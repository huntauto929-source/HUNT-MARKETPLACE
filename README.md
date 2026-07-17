# Deploying HunT

This turns the Claude-artifact version of HunT into a real, publicly
reachable website with a real database behind it. The UI and features
are unchanged — only the storage layer is now a real Postgres database
(via Supabase) instead of Claude's demo storage.

I can't deploy this for you directly (I don't have internet access
from where I run), but every step below is copy/paste and should take
about 15–20 minutes the first time.

## 1. Create a Supabase project (free tier is enough)

1. Go to https://supabase.com → sign up → **New project**.
2. Pick any name/region, set a database password (save it somewhere).
3. Wait ~2 minutes for it to provision.

## 2. Create the database table

1. In your new project, open **SQL Editor** → **New query**.
2. Paste in everything from `supabase/schema.sql` in this project.
3. Click **Run**. You should see "Success. No rows returned."

## 3. Get your API keys

1. Go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.

## 4. Configure the app

1. In this project folder, copy `.env.example` to a new file named `.env`.
2. Paste your Project URL and anon key into it.

## 5. Run it locally to test

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Create an
account, post a listing, message yourself from a second browser
window — confirm it all persists.

## 6. Put the code on GitHub

```bash
git init
git add .
git commit -m "HunT marketplace"
```

Create a new empty repo on https://github.com/new, then follow the
"push an existing repository" instructions it shows you.

## 7. Deploy to Vercel (free tier)

1. Go to https://vercel.com → sign up with GitHub → **Add New Project**.
2. Import the repo you just pushed.
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (same values as your `.env`)
4. Click **Deploy**. In about a minute you'll get a live URL like
   `hunt-marketplace.vercel.app`.

## 8. (Optional) Custom domain

In the Vercel project → **Settings → Domains**, add a domain you own
and follow the DNS instructions it gives you. HTTPS is automatic.

---

## What's real now vs. still worth upgrading

**Now real:**
- A real Postgres database (Supabase) — data persists for real, for everyone
- A real public URL anyone can visit
- Passwords hashed before storage

**Still worth doing before treating this as production for real users
and real money:**
- **Auth**: replace the app's own username/password table with
  Supabase Auth (`supabase.auth.signUp` / `signInWithPassword`). It
  handles sessions, password resets, and real email verification for
  you, and lets you write Row Level Security policies tied to
  `auth.uid()` instead of the fully-open policies in `schema.sql`.
- **Payments**: the checkout flow is still simulated — no card is
  actually charged. Wiring up Stripe needs a small server function
  (Vercel supports these) since secret keys can't live in frontend code.
- **Real email/SMS**: the signup verification code is currently shown
  on-screen instead of sent. Twilio (SMS) or Resend/SendGrid (email)
  would send it for real — also needs a small server function so the
  API secret isn't exposed in the browser.

Happy to build any of these next — Supabase Auth is the natural next
step since it unlocks proper RLS security too.
