export const CHANNELS = [
  { id: 'instagram', label: 'Instagram', color: '#d6336c' },
  { id: 'whatsapp', label: 'WhatsApp', color: '#1f9d55' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2' },
  { id: 'email', label: 'Email', color: '#7a5af8' },
  { id: 'call', label: 'Calls', color: '#b54708' },
  { id: 'referral', label: 'Referral', color: '#0e7490' },
  { id: 'other', label: 'Other', color: '#8a8984' },
];

// Channels you can set a daily outreach target for.
export const OUTREACH = CHANNELS.slice(0, 5);

export const channelById = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));

export const STAGES = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'replied', label: 'Replied' },
  { id: 'call_booked', label: 'Call booked' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

export const stageById = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export const isOpen = (stage) => stage !== 'won' && stage !== 'lost';

// Columns a lead may be updated on (matches the database grants).
export const LEAD_FIELDS = [
  'name', 'company', 'channel', 'contact', 'need', 'value',
  'stage', 'owner_id', 'next_follow_up', 'notes',
];
