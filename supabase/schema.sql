-- Clawser database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- Safe to run once on a fresh project.

-- ---------- Tables ----------

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  join_code   text not null unique,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.members (
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 60),
  role          text not null default 'member' check (role in ('owner', 'member')),
  joined_at     timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index members_user_idx on public.members (user_id);

create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  company         text,
  channel         text not null default 'instagram'
                  check (channel in ('instagram', 'whatsapp', 'linkedin', 'email', 'call', 'referral', 'other')),
  contact         text,
  need            text,
  value           numeric(12,2) not null default 0 check (value >= 0),
  stage           text not null default 'new'
                  check (stage in ('new', 'contacted', 'replied', 'call_booked', 'won', 'lost')),
  owner_id        uuid references auth.users(id) on delete set null,
  next_follow_up  date,
  notes           text,
  won_at          timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index leads_ws_stage_idx on public.leads (workspace_id, stage);
create index leads_ws_follow_idx on public.leads (workspace_id, next_follow_up);

-- Every message sent, call made, note or stage change.
-- Outreach targets count rows with kind 'message' or 'follow_up' for the day.
create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  lead_id       uuid references public.leads(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('message', 'follow_up', 'note', 'stage')),
  channel       text check (channel in ('instagram', 'whatsapp', 'linkedin', 'email', 'call', 'referral', 'other')),
  body          text,
  created_at    timestamptz not null default now()
);
create index activities_ws_user_time_idx on public.activities (workspace_id, user_id, created_at desc);
create index activities_lead_idx on public.activities (lead_id, created_at desc);

-- Daily outreach target per person per channel.
create table public.targets (
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  channel       text not null check (channel in ('instagram', 'whatsapp', 'linkedin', 'email', 'call')),
  daily         integer not null default 0 check (daily between 0 and 500),
  primary key (workspace_id, user_id, channel)
);

-- ---------- Helpers ----------

create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where workspace_id = ws and user_id = auth.uid());
$$;

create or replace function public.is_owner(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where workspace_id = ws and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.user_in_workspace(ws uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where workspace_id = ws and user_id = uid);
$$;

create or replace function public.lead_in_workspace(lid uuid, ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.leads where id = lid and workspace_id = ws);
$$;

create or replace function public.touch_lead()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.stage = 'won' and (old.stage is distinct from 'won') then
    new.won_at := now();
  elsif new.stage <> 'won' then
    new.won_at := null;
  end if;
  return new;
end $$;

create trigger leads_touch before update on public.leads
  for each row execute function public.touch_lead();

create or replace function public.stamp_new_lead()
returns trigger language plpgsql as $$
begin
  if new.stage = 'won' then new.won_at := now(); end if;
  return new;
end $$;

create trigger leads_stamp before insert on public.leads
  for each row execute function public.stamp_new_lead();

-- Short join code without look-alike characters (no 0/O, 1/I/L).
create or replace function public.new_join_code()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.workspaces where join_code = code);
  end loop;
  return code;
end $$;

-- ---------- Team actions (called from the app) ----------

create or replace function public.create_workspace(ws_name text, my_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  ws_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.workspaces (name, join_code, created_by)
    values (trim(ws_name), public.new_join_code(), auth.uid())
    returning id into ws_id;
  insert into public.members (workspace_id, user_id, display_name, role)
    values (ws_id, auth.uid(), trim(my_name), 'owner');
  return ws_id;
end $$;

create or replace function public.join_workspace(code text, my_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  ws_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into ws_id from public.workspaces where join_code = upper(trim(code));
  if ws_id is null then raise exception 'No team found with that code'; end if;
  insert into public.members (workspace_id, user_id, display_name, role)
    values (ws_id, auth.uid(), trim(my_name), 'member')
    on conflict (workspace_id, user_id) do nothing;
  return ws_id;
end $$;

create or replace function public.reset_join_code(ws uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  code text;
begin
  if not public.is_owner(ws) then raise exception 'Only the team owner can do this'; end if;
  code := public.new_join_code();
  update public.workspaces set join_code = code where id = ws;
  return code;
end $$;

revoke all on function public.create_workspace(text, text) from public, anon;
revoke all on function public.join_workspace(text, text) from public, anon;
revoke all on function public.reset_join_code(uuid) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.join_workspace(text, text) to authenticated;
grant execute on function public.reset_join_code(uuid) to authenticated;

-- ---------- Row level security ----------

alter table public.workspaces enable row level security;
alter table public.members    enable row level security;
alter table public.leads      enable row level security;
alter table public.activities enable row level security;
alter table public.targets    enable row level security;

-- Workspaces: members can see theirs, only the owner can rename.
create policy ws_select on public.workspaces for select to authenticated using (public.is_member(id));
create policy ws_update on public.workspaces for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

-- Members: see your teammates, edit your own name, leave the team.
-- The owner can remove other people. Joining happens through join_workspace().
create policy members_select on public.members for select to authenticated using (public.is_member(workspace_id));
create policy members_update_self on public.members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_delete on public.members for delete to authenticated
  using ((user_id = auth.uid() and role <> 'owner') or (public.is_owner(workspace_id) and user_id <> auth.uid()));

-- Leads: the whole team shares one pipeline. A lead can only be assigned to a teammate.
create policy leads_select on public.leads for select to authenticated using (public.is_member(workspace_id));
create policy leads_insert on public.leads for insert to authenticated
  with check (public.is_member(workspace_id)
              and created_by = auth.uid()
              and (owner_id is null or public.user_in_workspace(workspace_id, owner_id)));
create policy leads_update on public.leads for update to authenticated
  using (public.is_member(workspace_id))
  with check (public.is_member(workspace_id)
              and (owner_id is null or public.user_in_workspace(workspace_id, owner_id)));
create policy leads_delete on public.leads for delete to authenticated
  using (created_by = auth.uid() or public.is_owner(workspace_id));

-- Activities: everyone sees the team's history, you only write and delete your own.
create policy act_select on public.activities for select to authenticated using (public.is_member(workspace_id));
create policy act_insert on public.activities for insert to authenticated
  with check (public.is_member(workspace_id)
              and user_id = auth.uid()
              and (lead_id is null or public.lead_in_workspace(lead_id, workspace_id)));
create policy act_delete on public.activities for delete to authenticated using (user_id = auth.uid());

-- Targets: everyone sees the team's targets, you set your own.
create policy targets_select on public.targets for select to authenticated using (public.is_member(workspace_id));
create policy targets_insert on public.targets for insert to authenticated
  with check (public.is_member(workspace_id) and user_id = auth.uid());
create policy targets_update on public.targets for update to authenticated
  using (user_id = auth.uid()) with check (public.is_member(workspace_id) and user_id = auth.uid());
create policy targets_delete on public.targets for delete to authenticated using (user_id = auth.uid());

revoke all on public.workspaces, public.members, public.leads, public.activities, public.targets from anon, authenticated;

-- Column-level update rights, so nobody can promote themselves to owner,
-- move a lead to another team, or change who created it.
grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;
grant select, delete on public.members to authenticated;
grant update (display_name) on public.members to authenticated;
grant select, insert, delete on public.leads to authenticated;
grant update (name, company, channel, contact, need, value, stage, owner_id, next_follow_up, notes)
  on public.leads to authenticated;
grant select, insert, delete on public.activities to authenticated;
grant select, insert, update, delete on public.targets to authenticated;
