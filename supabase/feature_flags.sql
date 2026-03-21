-- ── Feature Flags ────────────────────────────────────────────────────────────

create table if not exists public.feature_flags (
  key              text primary key,           -- e.g. 'ai_report_writer'
  label            text not null default '',   -- Human label: 'AI Report Writer'
  description      text not null default '',   -- What it does
  enabled          boolean not null default false, -- Global on/off
  allowed_tiers    text[] not null default '{}',   -- e.g. '{intelligence_ii,command_iii}'
  allowed_org_ids  uuid[] not null default '{}',   -- Specific org overrides
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Public read (app needs to fetch flags on load for all users incl. anon)
alter table public.feature_flags enable row level security;
create policy "public_read_flags" on public.feature_flags for select using (true);

-- Super admin write only
create policy "super_admin_write_flags" on public.feature_flags
  for all using (
    exists (select 1 from public.profiles where user_id = auth.uid() and role = 'super_admin')
  );

-- Seed default flags
insert into public.feature_flags (key, label, description, enabled, allowed_tiers) values
  ('ai_report_writer',    'AI Report Writer',        'Generate reports using Claude AI',                    true,  '{capture_i,intelligence_ii,command_iii}'),
  ('client_portal',       'Client Portal',           'Share project portal with clients',                   true,  '{command_iii}'),
  ('before_after',        'Before & After Comparison','Side-by-side photo comparison slider',               true,  '{intelligence_ii,command_iii}'),
  ('video_capture',       'Video Capture',           'Record video walkthroughs',                           true,  '{capture_i,intelligence_ii,command_iii}'),
  ('team_chat',           'Team Chat',               'In-app messaging between team members',               true,  '{capture_i,intelligence_ii,command_iii}'),
  ('calendar',            'Calendar',                'Team calendar and scheduling',                        true,  '{capture_i,intelligence_ii,command_iii}'),
  ('voice_notes',         'Voice Notes',             'Record voice memos on jobsite',                       true,  '{capture_i,intelligence_ii,command_iii}'),
  ('sketch_tool',         'Sketch Tool',             'Draw on photos and create site sketches',             true,  '{capture_i,intelligence_ii,command_iii}'),
  ('dispatch',            'Dispatch Board',          'Job dispatch and crew assignment',                    true,  '{capture_i,intelligence_ii,command_iii}'),
  ('beta_features',       'Beta Features',           'Early access to features in development',             false, '{}')
on conflict (key) do nothing;
