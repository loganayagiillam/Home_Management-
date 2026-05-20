'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/server';
import { getErrorMessage } from '@/lib/flash';

function safeNextPath(nextValue: unknown) {
  if (typeof nextValue !== 'string') return '/app';
  if (!nextValue.startsWith('/')) return '/app';
  // Never allow redirecting back to onboarding loop
  if (nextValue.startsWith('/app/onboarding')) return '/app';
  return nextValue;
}

function toOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toOptionalDate(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  // Keep as YYYY-MM-DD
  return trimmed;
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isSupportedImage(file: File) {
  const t = file.type;
  if (t === 'image/jpeg' || t === 'image/png' || t === 'image/webp') return true;
  const name = file.name.toLowerCase();
  return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
}

function imageExt(file: File) {
  if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) return 'png';
  if (file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp')) return 'webp';
  return 'jpg';
}

export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser();

  const nextPath = safeNextPath(formData.get('next'));

  try {
    const { data: existingKyc } = await supabase
      .from('tenant_kyc')
      .select('aadhaar_file_path, aadhaar_last4, aadhaar_uploaded_at, photo_file_path, photo_uploaded_at')
      .eq('tenant_id', user.id)
      .maybeSingle();

    const fullName = String(formData.get('full_name') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const dateOfBirth = toOptionalDate(formData.get('date_of_birth'));
    const address = toOptionalString(formData.get('address'));
    const aadhaarLast4Input = String(formData.get('aadhaar_last4') ?? '').trim();
    const aadhaarLast4 = aadhaarLast4Input || (existingKyc?.aadhaar_last4 ?? '');

    const file = formData.get('aadhaar_pdf');
    const aadhaarPdf = file instanceof File ? file : null;

    const photoValue = formData.get('photo');
    const photoFile = photoValue instanceof File ? photoValue : null;

    if (!fullName) throw new Error('Full name is required');
    if (!phone) throw new Error('Phone number is required');

    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      throw new Error('Enter a valid phone number');
    }

    if (!/^[0-9]{4}$/.test(aadhaarLast4)) {
      throw new Error('Aadhaar last 4 digits must be exactly 4 numbers');
    }

    const hasExistingProof = Boolean((existingKyc?.aadhaar_file_path ?? '').trim());
    const hasExistingPhoto = Boolean((existingKyc?.photo_file_path ?? '').trim());

    if (!aadhaarPdf || aadhaarPdf.size === 0) {
      if (!hasExistingProof) {
        throw new Error('Aadhaar PDF is required');
      }
    } else {
      if (!isPdf(aadhaarPdf)) {
        throw new Error('Only PDF files are allowed for Aadhaar proof');
      }

      // 5MB limit (adjust later if needed)
      if (aadhaarPdf.size > 5 * 1024 * 1024) {
        throw new Error('PDF is too large (max 5MB)');
      }
    }

    if (!photoFile || photoFile.size === 0) {
      if (!hasExistingPhoto) {
        throw new Error('Profile photo is required');
      }
    } else {
      if (!isSupportedImage(photoFile)) {
        throw new Error('Only JPG/PNG/WebP files are allowed for photo');
      }
      // 2MB limit
      if (photoFile.size > 2 * 1024 * 1024) {
        throw new Error('Photo is too large (max 2MB)');
      }
    }

    // Update basic profile info
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone })
      .eq('id', user.id);

    if (profileError) throw new Error(profileError.message);

    // Upload Aadhaar proof (private bucket) if provided
    const proofPath = `${user.id}/aadhaar.pdf`;
    const photoPath = `${user.id}/photo.${photoFile && photoFile.size > 0 ? imageExt(photoFile) : 'jpg'}`;
    const nowIso = new Date().toISOString();

    if (aadhaarPdf && aadhaarPdf.size > 0) {
      const buffer = Buffer.from(await aadhaarPdf.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('tenant-proofs')
        .upload(proofPath, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);
    }

    if (photoFile && photoFile.size > 0) {
      const buffer = Buffer.from(await photoFile.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('tenant-proofs')
        .upload(photoPath, buffer, {
          contentType: photoFile.type || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);
    }

    // Upsert tenant_kyc record
    const { error: kycError } = await supabase
      .from('tenant_kyc')
      .upsert(
        {
          tenant_id: user.id,
          date_of_birth: dateOfBirth,
          address,
          aadhaar_last4: aadhaarLast4,
          aadhaar_file_path: aadhaarPdf && aadhaarPdf.size > 0 ? proofPath : (existingKyc?.aadhaar_file_path ?? proofPath),
          aadhaar_uploaded_at: aadhaarPdf && aadhaarPdf.size > 0 ? nowIso : (existingKyc?.aadhaar_uploaded_at ?? null),
          photo_file_path: photoFile && photoFile.size > 0 ? photoPath : (existingKyc?.photo_file_path ?? photoPath),
          photo_uploaded_at: photoFile && photoFile.size > 0 ? nowIso : (existingKyc?.photo_uploaded_at ?? null),
          completed_at: nowIso,
        },
        { onConflict: 'tenant_id' },
      );

    if (kycError) throw new Error(kycError.message);

    redirect(`${nextPath}?success=${encodeURIComponent('Profile completed.')}`);
  } catch (e) {
    redirect(`/app/onboarding?error=${encodeURIComponent(getErrorMessage(e))}&next=${encodeURIComponent(String(formData.get('next') ?? '/app'))}`);
  }
}
