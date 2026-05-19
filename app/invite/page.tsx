import { InviteClient } from './invite-client';
import { resolveSearchParams } from '@/lib/flash';

export const dynamic = 'force-dynamic';

export default async function InvitePage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }> | { token?: string };
}) {
  const sp = await resolveSearchParams(searchParams);
  return <InviteClient initialToken={sp?.token ?? ''} />;
}
