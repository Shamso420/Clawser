# Clawser

Leads and follow-ups for a small sales team. A product by a1nnovate (Beirut), built by Ali Shamsedine. Sister app: The Running Account (repo Shamso420/Running-account), same stack.

## Stack

- Next.js 14 (app router, plain JavaScript, no TypeScript), deployed on Vercel from `main`
- Supabase for auth (email + password) and Postgres, called straight from the browser with the anon key
- No other runtime dependencies. Keep it that way unless there is a clear reason.

## Layout

- `app/page.js` is the real app, `app/demo/page.js` runs the same UI on in-memory sample data (no account)
- `components/Root.js` handles session, team picking and onboarding, then renders `Workspace`
- `components/Workspace.js` loads team data and holds the shared store (`components/store.js`)
- Screens: `Today.js` (follow-ups due + daily outreach bars), `Pipeline.js`, `Leads.js`, `Team.js`, plus `LeadSheet.js` (add/edit a lead, history)
- `lib/api.js` has every database call twice: `makeSupabaseApi` (live) and `makeDemoApi` (demo). Any new data feature needs both.
- `lib/constants.js` channels and stages, `lib/dates.js` date and money helpers
- `supabase/schema.sql` tables, RPCs (`create_workspace`, `join_workspace`, `reset_join_code`), row level security and column grants

## Data rules

- A team is a `workspaces` row. People join with a 6-letter code. Everyone on a team shares one pipeline.
- Anyone on the team can see and edit any lead and assign it to a teammate. Only the creator or the owner can delete a lead.
- Each person sets their own daily outreach targets (`targets`). Outreach counts are `activities` rows of kind `message` or `follow_up` for today.
- Updates are limited by column grants. If you add a column users should edit, add it to the `grant update (...)` list in the schema and to `LEAD_FIELDS` in `lib/constants.js`.
- Schema changes after the first setup go in new files, `supabase/migrations/NNN_name.sql`, written to run safely on the live database. Ali pastes them into the Supabase SQL Editor by hand, so tell him when one needs running.

## Setup status (as of 3 Nov 2026)

- Code pushed to GitHub. Repo is public on purpose.
- Supabase project "Clawser" created (Central EU, URL https://uobuvxbrkrnpqtaryntd.supabase.co) and `schema.sql` has been run successfully.
- Not done yet: Vercel import with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then setting Supabase Auth > URL Configuration > Site URL to the Vercel address.
- Planned later: invoices for won deals (left out of v1).

## Working with Ali

- He works mostly from an iPhone or iPad, so give click-by-click steps for anything in Supabase, Vercel or GitHub, and ask for a screenshot after each step.
- Never ask for, print or commit the Supabase service_role / secret key. The anon or publishable key is fine.
- Run `npm run build` before pushing. A broken build means a broken Vercel deploy.
- Writing style for all UI copy and messages to him: plain, human English. Sentence case, no em dashes, no emojis, minimal bold. Avoid words like delve, crucial, seamless, robust, leverage, enhance, and "key" as an adjective.

## Design

White and near-black like the Clawser launch reel: black rounded "C" tile logo, Inter, blue accent `#2b55c4`, green for won. Mobile first with a bottom tab bar; top tabs from 860px up. Check new screens at 390px wide.
