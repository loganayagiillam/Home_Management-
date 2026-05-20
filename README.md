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

## Razorpay (optional)

If you use online payments:

Client (public):

- `NEXT_PUBLIC_RAZORPAY_KEY_ID`

Server (secret):

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run the SQL migrations in order from `supabase/migrations/`.
3. In Supabase Auth, create users for your admin and tenants (email + password).

### Storage bucket

This app expects a private Supabase Storage bucket:

- Bucket: `tenant-proofs` (private)

It is used for tenant uploads (Aadhaar PDF + tenant photo) and admin-only downloads via signed URLs.

### Notes on latest migrations

- `0010_tenant_photo_upload.sql` adds `tenant_kyc.photo_file_path` and is required for the onboarding photo upload flow.

### Make a user an admin

After the admin user exists in Auth, set the role in `profiles`:

- `update public.profiles set role = 'admin' where id = '<auth_user_uuid>';`

## Run locally

- `npm install`
- `npm run dev`
