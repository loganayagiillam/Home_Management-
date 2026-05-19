import { requireUser } from '@/lib/auth/server';
import { getActiveMembershipForCurrentUser } from '@/lib/room/server';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Announcements' };
export const dynamic = 'force-dynamic';

type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  room_id: string | null;
  created_at: string;
};

export default async function TenantAnnouncementsPage() {
  const { supabase, user } = await requireUser();
  const membership = await getActiveMembershipForCurrentUser(supabase, user.id);

  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, title, message, room_id, created_at')
    .or(
      membership
        ? `room_id.is.null,room_id.eq.${membership.roomId}`
        : 'room_id.is.null'
    )
    .order('created_at', { ascending: false })
    .limit(20);

  const announcementsSafe = (announcements ?? []) as AnnouncementRow[];

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Messages from your property admin." />

      {announcementsSafe.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 mx-auto mb-3">
              <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No announcements yet. Check back later.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcementsSafe.map((a) => (
            <Card key={a.id} className="space-y-2 border-l-4 border-l-indigo-400">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {a.room_id ? <Badge>Your room</Badge> : <Badge>All tenants</Badge>}
                  <span>{new Date(a.created_at).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{a.message}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
