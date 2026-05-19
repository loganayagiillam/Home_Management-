import type { Metadata } from 'next';
import Link from 'next/link';
import { signIn } from './actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { resolveSearchParams } from '@/lib/flash';

export const metadata: Metadata = { title: 'Login' };

function safeNextPath(nextValue: unknown) {
  if (typeof nextValue !== 'string') return '/';
  if (!nextValue.startsWith('/')) return '/';
  return nextValue;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; error?: string }> | { next?: string; error?: string };
}) {
  const sp = await resolveSearchParams(searchParams);
  const nextPath = safeNextPath(sp?.next);
  const error = sp?.error ? decodeURIComponent(sp.error) : null;

  return (
    <main className="p-6">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Login</h1>
          <p className="mt-1 text-sm text-slate-500">Login using email and password.</p>
        </div>

        <Card className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <form action={signIn} className="space-y-4">
            <input type="hidden" name="next" value={nextPath} />

            <Field label="Email">
              <Input name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
            </Field>

            <Field label="Password">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>

            <Button className="w-full" type="submit">
              Sign in
            </Button>
          </form>

          <div className="text-sm text-slate-600">
            New tenant?{' '}
            <Link className="font-medium text-indigo-600 hover:underline" href={`/signup?next=${encodeURIComponent(nextPath)}`}>
              Create account
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
