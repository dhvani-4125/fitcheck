-- FitCheck cloud sync schema for Supabase (free tier).
-- Run once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

-- One row per user holding their whole wardrobe document (items, looks, plans, preferences, profile).
create table if not exists public.wardrobes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.wardrobes enable row level security;

drop policy if exists "Users read own wardrobe" on public.wardrobes;
drop policy if exists "Users insert own wardrobe" on public.wardrobes;
drop policy if exists "Users update own wardrobe" on public.wardrobes;
drop policy if exists "Users delete own wardrobe" on public.wardrobes;
create policy "Users read own wardrobe" on public.wardrobes for select using (auth.uid() = user_id);
create policy "Users insert own wardrobe" on public.wardrobes for insert with check (auth.uid() = user_id);
create policy "Users update own wardrobe" on public.wardrobes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own wardrobe" on public.wardrobes for delete using (auth.uid() = user_id);

-- Private bucket for garment photos, stored as <user_id>/<item_id>.jpg
insert into storage.buckets (id, name, public)
values ('garments', 'garments', false)
on conflict (id) do nothing;

drop policy if exists "Users read own garments" on storage.objects;
drop policy if exists "Users upload own garments" on storage.objects;
drop policy if exists "Users update own garments" on storage.objects;
drop policy if exists "Users delete own garments" on storage.objects;
create policy "Users read own garments" on storage.objects for select
  using (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users upload own garments" on storage.objects for insert
  with check (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own garments" on storage.objects for update
  using (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own garments" on storage.objects for delete
  using (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Ask Friends polls (added later; safe to run the whole file again)
-- Anyone with a poll link can view it and vote without signing in; only the owner can create or delete.
create table if not exists public.polls (
  id text primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  question text not null check (char_length(question) <= 160),
  options jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.polls enable row level security;
drop policy if exists "Anyone with the link can view a poll" on public.polls;
drop policy if exists "Owners create polls" on public.polls;
drop policy if exists "Owners delete polls" on public.polls;
create policy "Anyone with the link can view a poll" on public.polls for select using (true);
create policy "Owners create polls" on public.polls for insert with check (auth.uid() = owner);
create policy "Owners delete polls" on public.polls for delete using (auth.uid() = owner);

create table if not exists public.poll_votes (
  id bigint generated always as identity primary key,
  poll_id text not null references public.polls (id) on delete cascade,
  option_index int not null check (option_index between 0 and 3),
  voter_name text check (char_length(voter_name) <= 40),
  comment text check (char_length(comment) <= 200),
  created_at timestamptz not null default now()
);
alter table public.poll_votes enable row level security;
drop policy if exists "Anyone can see poll votes" on public.poll_votes;
drop policy if exists "Anyone can vote" on public.poll_votes;
create policy "Anyone can see poll votes" on public.poll_votes for select using (true);
create policy "Anyone can vote" on public.poll_votes for insert with check (true);

-- Public bucket for poll images (outfit collages only; never the raw wardrobe photos)
insert into storage.buckets (id, name, public) values ('polls', 'polls', true) on conflict (id) do nothing;
drop policy if exists "Users upload own poll images" on storage.objects;
drop policy if exists "Users delete own poll images" on storage.objects;
create policy "Users upload own poll images" on storage.objects for insert
  with check (bucket_id = 'polls' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own poll images" on storage.objects for delete
  using (bucket_id = 'polls' and (storage.foldername(name))[1] = auth.uid()::text);
