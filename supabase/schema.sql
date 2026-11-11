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
