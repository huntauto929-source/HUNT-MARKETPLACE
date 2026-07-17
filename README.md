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

## 2. Create the database tables

1. In your new project, open **SQL Editor** → **New query**.
2. Paste in everything from `supabase/schema.sql` in this project — this
   includes both the marketplace data table and the real-accounts
   (`profiles`) table with its auto-create trigger.
3. Click **Run**. You should see "Success. No rows returned."

## 2b. Turn on real accounts (Supabase Auth)

HunT now uses Supabase's built-in auth system for signup, login, and
password reset — no more on-screen fake verification codes.

1. In your Supabase project, go to **Authentication → Sign In / Providers**
   and make sure **Email** is enabled (it is by default).
2. Go to **Authentication → URL Configuration**:
   - **Site URL**: set this to your live site's URL once you have it
     from Vercel (step 7 below) — e.g. `https://hunt-marketplace-xxxx.vercel.app`
   - **Redirect URLs**: add the same URL here too (you can use a
     wildcard like `https://hunt-marketplace-xxxx.vercel.app/**`)
   - You'll need to come back and update these once your Vercel URL
     exists — chicken-and-egg, that's normal, just don't skip it.
3. Supabase's free tier sends confirmation/reset emails from its own
   shared address with a low rate limit (a few per hour) — perfectly
   fine for testing and a small number of real users. If you outgrow
   that, **Authentication → Providers → Email → SMTP Settings** lets
   you plug in your own sender (Resend, Postmark, etc.) for
   unlimited, branded emails.

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
- A real public URL anyone can visit — including anyone in Canada or anywhere else, no extra setup needed for that part
- **Real accounts**: Supabase Auth handles signup, login, sessions, email confirmation, and self-service "Forgot password" — people manage their own passwords without you doing anything
- **Public profiles, no personal info leaked**: tapping any "@username" (on a listing or in a chat) opens their profile — name, username, member-since date, and their active listings. Date of birth, linked contact info, and email are never sent to other people's browsers at all: the database itself only allows the `profiles` table's full row to be read by its own owner, and a separate `public_profiles` view exposes just the three safe fields to everyone else. This is enforced in Postgres, not just hidden in the UI.
- **Moderation**: members can report a listing/seller. Nobody gets restricted from a single complaint — the database automatically restricts an account (pauses buying/selling) only once 3 *different* people have reported it. That threshold is enforced by a Postgres trigger, not app code, so it can't be bypassed from the browser.
- **Pickup locations**: sellers can search an address or use their current location when posting; it's geocoded for free (OpenStreetMap, no API key needed) and shown to buyers as a live Google Maps preview and a one-tap directions link. Nothing extra to configure — this works as soon as you redeploy.
- **Remove listings**: sellers can delete their own active (unsold) listings from their Profile page any time.
- **Amendments/bug fixes**: since this is now a real database, you can directly edit, unrestrict, or delete any row (a listing, a user's `restricted` flag, etc.) any time from Supabase's **Table Editor** — no code change or redeploy needed for one-off fixes. To change the report threshold, re-run the `report_threshold()` function in `schema.sql` with a different number.

**Still worth doing before treating this as production for real users
and real money:**
- **Payments**: the checkout flow is still simulated — no card is
  actually charged. Wiring up Stripe needs a small server function
  (Vercel supports these) since secret keys can't live in frontend code.
- **Email volume**: Supabase's default shared email sender is rate-limited
  (a few emails/hour) — fine for testing, but add your own SMTP provider
  (Resend, Postmark) in Supabase's Auth settings before real launch traffic.
- **The `kv_store` table** (listings, chats, orders) still has fully open
  read/write policies since HunT doesn't check `auth.uid()` there yet.
  Now that real accounts exist, tightening these to check the logged-in
  user's identity is the natural next security upgrade.
