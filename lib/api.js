import { createClient } from '@supabase/supabase-js';
import { LEAD_FIELDS } from './constants';
import { addDays, todayStr } from './dates';

const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

let client = null;
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

// ---------- Live backend (Supabase) ----------

export function makeSupabaseApi(sb) {
  return {
    demo: false,

    async getSession() {
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw new Error(error.message);
      return { needsConfirm: !data.session };
    },
    async signOut() {
      await sb.auth.signOut();
    },

    async myWorkspaces(uid) {
      const rows = check(
        await sb
          .from('members')
          .select('workspace_id, display_name, role, workspaces(id, name, join_code)')
          .eq('user_id', uid)
          .order('joined_at'),
      );
      return rows
        .filter((r) => r.workspaces)
        .map((r) => ({
          id: r.workspace_id,
          name: r.workspaces.name,
          joinCode: r.workspaces.join_code,
          myName: r.display_name,
          role: r.role,
        }));
    },
    async createWorkspace(name, myName) {
      return check(await sb.rpc('create_workspace', { ws_name: name, my_name: myName }));
    },
    async joinWorkspace(code, myName) {
      return check(await sb.rpc('join_workspace', { code, my_name: myName }));
    },
    async resetCode(ws) {
      return check(await sb.rpc('reset_join_code', { ws }));
    },
    async renameWorkspace(ws, name) {
      check(await sb.from('workspaces').update({ name }).eq('id', ws));
    },
    async updateMyName(ws, uid, name) {
      check(await sb.from('members').update({ display_name: name }).eq('workspace_id', ws).eq('user_id', uid));
    },
    async removeMember(ws, uid) {
      const rows = check(
        await sb.from('members').delete().eq('workspace_id', ws).eq('user_id', uid).select('user_id'),
      );
      if (!rows.length) throw new Error('You can only remove yourself, or others if you own the team.');
    },

    async loadAll(ws, sinceISO) {
      const [members, leads, targets, acts] = await Promise.all([
        sb.from('members').select('user_id, display_name, role, joined_at').eq('workspace_id', ws).order('joined_at'),
        sb.from('leads').select('*').eq('workspace_id', ws).order('updated_at', { ascending: false }).limit(2000),
        sb.from('targets').select('user_id, channel, daily').eq('workspace_id', ws),
        sb
          .from('activities')
          .select('id, user_id, lead_id, kind, channel, created_at')
          .eq('workspace_id', ws)
          .in('kind', ['message', 'follow_up'])
          .gte('created_at', sinceISO)
          .limit(5000),
      ]);
      return {
        members: check(members),
        leads: check(leads),
        targets: check(targets),
        acts: check(acts),
      };
    },
    async leadActivities(leadId) {
      return check(
        await sb.from('activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(100),
      );
    },
    async insertLead(row) {
      return check(await sb.from('leads').insert(row).select().single());
    },
    async updateLead(id, patch) {
      return check(await sb.from('leads').update(pick(patch, LEAD_FIELDS)).eq('id', id).select().single());
    },
    async deleteLead(id) {
      const rows = check(await sb.from('leads').delete().eq('id', id).select('id'));
      if (!rows.length) throw new Error('Only the person who added this lead, or the team owner, can delete it.');
    },
    async addActivity(row) {
      return check(await sb.from('activities').insert(row).select().single());
    },
    async deleteActivity(id) {
      check(await sb.from('activities').delete().eq('id', id));
    },
    async setTarget(ws, uid, channel, daily) {
      check(
        await sb
          .from('targets')
          .upsert({ workspace_id: ws, user_id: uid, channel, daily }, { onConflict: 'workspace_id,user_id,channel' }),
      );
    },
  };
}

// ---------- Demo backend (in memory, no account needed) ----------

const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

export function makeDemoApi() {
  const ME = 'demo-ali';
  const WS = 'demo-ws';
  const t = todayStr();
  const now = Date.now();
  const hoursAgo = (h) => new Date(now - h * 3600000).toISOString();

  const db = {
    workspace: { id: WS, name: 'a1nnovate sales', join_code: 'K7MQ2X' },
    members: [
      { user_id: ME, display_name: 'Ali', role: 'owner', joined_at: hoursAgo(900) },
      { user_id: 'demo-rami', display_name: 'Rami', role: 'member', joined_at: hoursAgo(800) },
      { user_id: 'demo-nour', display_name: 'Nour', role: 'member', joined_at: hoursAgo(700) },
    ],
    targets: [
      { user_id: ME, channel: 'instagram', daily: 20 },
      { user_id: ME, channel: 'whatsapp', daily: 10 },
      { user_id: ME, channel: 'call', daily: 5 },
      { user_id: 'demo-rami', channel: 'instagram', daily: 15 },
      { user_id: 'demo-rami', channel: 'linkedin', daily: 10 },
      { user_id: 'demo-nour', channel: 'email', daily: 15 },
    ],
    leads: [],
    acts: [],
  };

  const seed = [
    ['Cedar Phone Corner', 'Hamra', 'instagram', '@cedarphonecorner', 'Debt tracking for 40 regular customers', 150, 'replied', ME, 0],
    ['Abou Karim Hardware', 'Jdeideh', 'call', '+961 3 000 111', 'Wants staff to log sales without seeing totals', 240, 'call_booked', ME, 1],
    ['Lina Studio', 'Achrafieh', 'instagram', '@linastudio.lb', 'Bridal bookings and deposits', 90, 'contacted', ME, -2],
    ['Zeitoun Market', 'Jounieh', 'whatsapp', '+961 70 000 222', 'Two branches, one owner', 300, 'contacted', 'demo-rami', 0],
    ['Kasr Sweets', 'Saida', 'instagram', '@kasrsweets', 'Supplier tabs in dollars and lira', 120, 'new', ME, 0],
    ['Hadi Auto Parts', 'Dora', 'call', '+961 71 000 333', 'Garages buy on credit, pay end of month', 200, 'replied', 'demo-rami', -1],
    ['Maya Florals', 'Gemmayze', 'instagram', '@mayafloralsbey', 'Event orders and deposits', 80, 'new', 'demo-nour', 1],
    ['Nasr Pharmacy Supply', 'Tripoli', 'email', 'orders@example.com', 'Wholesale accounts, 60 pharmacies', 450, 'contacted', 'demo-nour', 0],
    ['Byblos Print House', 'Jbeil', 'linkedin', 'linkedin.com/in/example', 'Quotes and follow-ups for corporate clients', 180, 'new', 'demo-rami', 3],
    ['Sahel Mobile', 'Baabda', 'whatsapp', '+961 76 000 444', 'Reseller of 360 Cell, wants the same setup', 150, 'won', ME, null],
    ['Arz Electronics', 'Zahle', 'instagram', '@arzelectronics', 'Installments on TVs and fridges', 260, 'won', 'demo-rami', null],
    ['Marina Fish Shop', 'Batroun', 'call', '+961 3 000 555', 'Said maybe after the season', 70, 'lost', 'demo-nour', null],
    ['Tannour Bakery', 'Aley', 'whatsapp', '+961 78 000 666', 'Delivery drivers collect cash', 110, 'replied', ME, 5],
    ['Bustan Coffee Roasters', 'Mar Mikhael', 'email', 'hello@example.com', 'Cafe accounts on monthly terms', 160, 'call_booked', 'demo-nour', 2],
  ];
  seed.forEach(([name, company, channel, contact, need, value, stage, owner, fu], i) => {
    const id = `demo-lead-${i}`;
    db.leads.push({
      id, workspace_id: WS, name, company, channel, contact, need, value, stage,
      owner_id: owner, next_follow_up: fu === null ? null : addDays(t, fu), notes: '',
      won_at: stage === 'won' ? hoursAgo(30 + i * 10) : null,
      created_by: owner, created_at: hoursAgo(200 + i * 5), updated_at: hoursAgo(10 + i * 3),
    });
    db.acts.push({ id: uid(), workspace_id: WS, lead_id: id, user_id: owner, kind: 'note', channel: null,
      body: `Added from ${channel === 'call' ? 'a call' : channel}`, created_at: hoursAgo(200 + i * 5) });
  });
  const todays = [
    [ME, 'instagram', 9], [ME, 'whatsapp', 4], [ME, 'call', 2],
    ['demo-rami', 'instagram', 11], ['demo-rami', 'linkedin', 3], ['demo-nour', 'email', 8],
  ];
  todays.forEach(([u, ch, n]) => {
    for (let i = 0; i < n; i++)
      db.acts.push({ id: uid(), workspace_id: WS, lead_id: null, user_id: u, kind: 'message', channel: ch, body: null,
        created_at: new Date(new Date().setHours(0, 0, 0, 0) + (i + 1) * 60000).toISOString() });
  });

  const session = { user: { id: ME, email: 'demo@clawser.app' } };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const wait = () => new Promise((r) => setTimeout(r, 60));

  return {
    demo: true,
    async getSession() { return session; },
    onAuthChange() { return () => {}; },
    async signIn() {},
    async signUp() { return { needsConfirm: false }; },
    async signOut() { window.location.href = '/'; },

    async myWorkspaces() {
      return [{ id: WS, name: db.workspace.name, joinCode: db.workspace.join_code, myName: 'Ali', role: 'owner' }];
    },
    async createWorkspace() { return WS; },
    async joinWorkspace() { return WS; },
    async resetCode() {
      db.workspace.join_code = Math.random().toString(36).slice(2, 8).toUpperCase();
      return db.workspace.join_code;
    },
    async renameWorkspace(_ws, name) { db.workspace.name = name; },
    async updateMyName(_ws, u, name) { db.members.find((m) => m.user_id === u).display_name = name; },
    async removeMember(_ws, u) { db.members = db.members.filter((m) => m.user_id !== u); },

    async loadAll(_ws, sinceISO) {
      await wait();
      return clone({
        members: db.members,
        leads: [...db.leads].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
        targets: db.targets,
        acts: db.acts.filter((a) => (a.kind === 'message' || a.kind === 'follow_up') && a.created_at >= sinceISO),
      });
    },
    async leadActivities(leadId) {
      return clone(db.acts.filter((a) => a.lead_id === leadId).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async insertLead(row) {
      const lead = { notes: '', ...row, id: uid(), won_at: row.stage === 'won' ? new Date().toISOString() : null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      db.leads.push(lead);
      return clone(lead);
    },
    async updateLead(id, patch) {
      const lead = db.leads.find((l) => l.id === id);
      const p = pick(patch, LEAD_FIELDS);
      if (p.stage === 'won' && lead.stage !== 'won') lead.won_at = new Date().toISOString();
      if (p.stage && p.stage !== 'won') lead.won_at = null;
      Object.assign(lead, p, { updated_at: new Date().toISOString() });
      return clone(lead);
    },
    async deleteLead(id) {
      db.leads = db.leads.filter((l) => l.id !== id);
      db.acts = db.acts.filter((a) => a.lead_id !== id);
    },
    async addActivity(row) {
      const a = { ...row, id: uid(), created_at: new Date().toISOString() };
      db.acts.push(a);
      return clone(a);
    },
    async deleteActivity(id) { db.acts = db.acts.filter((a) => a.id !== id); },
    async setTarget(_ws, u, channel, daily) {
      const row = db.targets.find((x) => x.user_id === u && x.channel === channel);
      if (row) row.daily = daily;
      else db.targets.push({ user_id: u, channel, daily });
    },
  };
}
