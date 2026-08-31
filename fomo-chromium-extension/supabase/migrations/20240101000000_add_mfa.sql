-- 20240101000000_add_mfa.sql

alter table public.profiles
  add column if not exists mfa_enabled boolean default false;

create table if not exists public.mfa_codes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  code text not null,
  expires_at timestamp with time zone not null,
  used boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.mfa_codes enable row level security;

create policy "Users can view own MFA codes"
  on public.mfa_codes for select
  using (auth.uid() = user_id);

create policy "Users can insert own MFA codes"
  on public.mfa_codes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own MFA codes"
  on public.mfa_codes for update
  using (auth.uid() = user_id);
