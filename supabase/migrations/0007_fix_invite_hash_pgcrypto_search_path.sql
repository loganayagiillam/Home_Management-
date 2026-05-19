-- Fix invite token hashing when pgcrypto is installed in the `extensions` schema (Supabase default).
-- Without this, calls from security definer functions that set search_path=public can fail
-- with: function digest(text, unknown) does not exist

create extension if not exists "pgcrypto";

create or replace function public.hash_invite_token(token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(convert_to(token, 'utf8'), 'sha256'), 'hex');
$$;
