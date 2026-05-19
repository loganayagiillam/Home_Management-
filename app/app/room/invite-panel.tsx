'use client';

import { useActionState } from 'react';
import { createInvite } from './actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type State = {
  token: string | null;
  error: string | null;
};

const initialState: State = { token: null, error: null };

export function InvitePanel() {
  const [state, formAction, pending] = useActionState(createInvite, initialState);

  const inviteUrl = state.token ? `${window.location.origin}/invite?token=${encodeURIComponent(state.token)}` : null;

  return (
    <Card className="space-y-4">
      <div>
        <div className="text-sm font-semibold">Invite a new member</div>
        <p className="mt-1 text-xs text-slate-600">Optionally lock the invite to an email for security.</p>
      </div>

      <form action={formAction}>
        <div className="space-y-3">
          <Field label="Roommate email (optional)">
            <Input name="invited_email" type="email" placeholder="roommate@example.com" autoComplete="email" />
          </Field>

          <Button disabled={pending} type="submit" id="generate-invite-btn">
            {pending ? 'Generating…' : 'Generate invite link'}
          </Button>
        </div>
      </form>

        {state.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</div>
        )}

        {state.token && (
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-slate-700">Invite token</div>
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 break-all">
                {state.token}
              </div>
            </div>
            {inviteUrl && (
              <div>
                <div className="text-xs font-medium text-slate-700">Invite URL</div>
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 break-all">
                  {inviteUrl}
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Share this URL with the new member. They must be logged in before opening it.
                </p>
              </div>
            )}
          </div>
        )}
    </Card>
  );
}
