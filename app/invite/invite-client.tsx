'use client';

import { useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function InviteClient({ initialToken }: { initialToken: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [token, setToken] = useState(initialToken);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    setStatus(null);

    try {
      if (!supabase) {
        setStatus('App not configured. Missing Supabase env vars.');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const next = `/invite?token=${encodeURIComponent(token.trim())}`;
        window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const trimmed = token.trim();
      if (!trimmed) {
        setStatus('Paste invite token.');
        return;
      }

      const { error } = await supabase.rpc('accept_room_invite', { token: trimmed });
      if (error) {
        setStatus(error.message);
        return;
      }

      window.location.assign('/app/onboarding?next=%2Fapp%2Froom');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Join room</h1>
          <p className="mt-1 text-sm text-slate-500">Paste the invite token you received.</p>
        </div>

        <Card className="space-y-4">
          {status ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{status}</div>
          ) : null}

          <Field label="Invite token">
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token"
              autoComplete="off"
            />
          </Field>

          <Button className="w-full" disabled={loading} onClick={accept} type="button">
            {loading ? 'Joining…' : 'Join'}
          </Button>
        </Card>
      </div>
    </main>
  );
}
