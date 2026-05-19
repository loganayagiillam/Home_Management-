# Home Management (Shared Room MVP)

Next.js + Tailwind + Supabase MVP for shared rental room management.

Auth note: OTP login is currently disabled (quota limits). Login uses email + password.

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run start`

## Environment variables

Create `.env.local` with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional (server-only; do not expose to the browser):

- `SUPABASE_SERVICE_ROLE_KEY`

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run the SQL migrations in order from `supabase/migrations/`.
3. In Supabase Auth, create users for your admin and tenants (email + password).

### Make a user an admin

After the admin user exists in Auth, set the role in `profiles`:

- `update public.profiles set role = 'admin' where id = '<auth_user_uuid>';`

## Run locally

- `npm install`
- `npm run dev`
