import { requireAdmin } from '@/lib/auth/server';
import { createAnnouncement, deleteAnnouncement } from './actions';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { decodeSearchParam, resolveSearchParams } from '@/lib/flash';

export const metadata: Metadata = { title: 'Announcements' };
export const dynamic = 'force-dynamic';

type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  room_id: string | null;
  created_at: string;
  rooms?: { room_number: string }[] | null;
};

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }> | { error?: string };
}) {
  const { supabase } = await requireAdmin();

  const sp = await resolveSearchParams(searchParams);
  const flashError = decodeSearchParam(sp?.error);

  const [{ data: rooms }, { data: announcements }] = await Promise.all([
    supabase.from('rooms').select('id, room_number').order('room_number', { ascending: true }),
    supabase
      .from('announcements')
      .select('id, title, message, room_id, created_at, rooms(room_number)')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const roomsSafe = rooms ?? [];
  const announcementsSafe = (announcements ?? []) as unknown as AnnouncementRow[];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header">
        <h1 className="page-title">Announcements</h1>
        <p className="page-subtitle">Post messages to all tenants or specific rooms.</p>
      </div>

      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{flashError}</div>
      )}

      {/* Create Form */}
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Post new announcement</h2>
        <form action={createAnnouncement} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Title">
              <Input name="title" placeholder="Announcement title" required maxLength={120} />
            </Field>
            <Field label="Target room (optional — leave blank for all)">
              <Select name="room_id" defaultValue="">
                <option value="">📢 All rooms (broadcast)</option>
                {roomsSafe.map((r: { id: string; room_number: string }) => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_number}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Message">
            <textarea
              name="message"
              className="input min-h-[100px] resize-y"
              placeholder="Write your announcement here…"
              required
              maxLength={2000}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit">Post announcement</Button>
          </div>
        </form>
      </Card>

      {/* List */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          All announcements ({announcementsSafe.length})
        </h2>
        {announcementsSafe.length === 0 ? (
          <Card>
            <div className="py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 mx-auto mb-3">
                <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">No announcements yet. Create your first one above.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {announcementsSafe.map((a) => (
              <Card key={a.id} className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{new Date(a.created_at).toLocaleDateString('en-IN')}</span>
                      {a.room_id ? (
                        <Badge>Room {a.rooms?.[0]?.room_number ?? a.room_id.slice(0, 8)}</Badge>
                      ) : (
                        <Badge>All rooms</Badge>
                      )}
                    </div>
                  </div>
                  <form action={deleteAnnouncement}>
                    <input type="hidden" name="id" value={a.id} />
                    <Button variant="secondary" type="submit" className="text-red-600 hover:text-red-700">
                      Delete
                    </Button>
                  </form>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{a.message}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
