# Clawser

Leads and follow-ups for a sales team, in one place. A product by a1nnovate.

Everyone on a team shares one pipeline. Each person gets a Today screen with the follow-ups they owe, plus daily outreach targets per channel (Instagram, WhatsApp, LinkedIn, email, calls).

Built the same way as The Running Account: Next.js on Vercel, Supabase for login and the database.

## Try it without an account

Open `/demo` on any deployment. It runs on sample data in the browser and nothing is saved.

## Setup

1. Create a new Supabase project. In SQL Editor, paste all of `supabase/schema.sql` and run it.
2. In Supabase, go to Authentication, then URL Configuration, and set Site URL to the Vercel address once you have it. Confirmation emails link there.
3. Import this repo in Vercel and add two environment variables from Supabase (Project Settings, then API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. The first person to sign up creates the team and gets a 6-letter code to share.

## Local development

```
cp .env.example .env.local   # fill in the two keys
npm install
npm run dev
```

## How it is organised

- `app/` pages: `/` is the real app, `/demo` the sample team
- `components/` screens: Today, Pipeline, Leads, Team, and the lead sheet
- `lib/api.js` every database call, with an in-memory copy for the demo
- `supabase/schema.sql` tables, team join codes and the row level security rules

## Who can do what

- Anyone on the team can see and edit every lead, and assign leads to teammates.
- Only the person who added a lead, or the team owner, can delete it.
- Everyone sets their own outreach targets.
- Only the owner can rename the team, make a new join code, or remove people.
