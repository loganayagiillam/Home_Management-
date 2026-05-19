'use client';

import { useActionState } from 'react';
import { createRoomInviteAction } from './actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type State = {
  token: string | null;
  error: string | null;
};

const initialState: State = { token: null, error: null };

export function RoomInvitePanel({ roomId, disabled }: { roomId: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(createRoomInviteAction, initialState);

  const inviteUrl = state.token ? `${window.location.origin}/invite?token=${encodeURIComponent(state.token)}` : null;

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="room_id" value={roomId} />

        <Field label="Lock invite to email (optional)">
          <Input name="invited_email" type="email" placeholder="leader/tenant email" autoComplete="email" />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={disabled || pending}
            type="submit"
            name="is_leader_invite"
            value="false"
            variant="secondary"
          >
            {pending ? 'Generating…' : 'Generate member invite'}
          </Button>

          <Button
            disabled={pending}
            type="submit"
            name="is_leader_invite"
            value="true"
            variant="secondary"
          >
            {pending ? 'Generating…' : 'Generate leader invite'}
          </Button>
        </div>
      </form>

      {disabled ? (
        <div className="text-xs text-slate-600">Room is full — remove a member to add another.</div>
      ) : null}

      {state.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</div>
      ) : null}

      {state.token ? (
        <div className="space-y-2">
          <div>
            <div className="text-xs font-medium text-slate-700">Invite token</div>
            <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 break-all">
              {state.token}
            </div>
          </div>
          {inviteUrl ? (
            <div>
              <div className="text-xs font-medium text-slate-700">Invite URL</div>
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 break-all">
                {inviteUrl}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
