-- Tenant photo upload support (stored in tenant_kyc for onboarding)

alter table public.tenant_kyc
  add column if not exists photo_file_path text,
  add column if not exists photo_uploaded_at timestamptz;
