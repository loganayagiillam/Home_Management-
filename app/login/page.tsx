import type { Metadata } from 'next';
import Link from 'next/link';
import { signIn } from './actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { resolveSearchParams } from '@/lib/flash';

export const metadata: Metadata = { title: 'Login | HomeHub' };

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
    <main className="flex min-h-screen items-center justify-center bg-slate-50/50 p-4 sm:p-8">
      <div className="flex w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-indigo-900/5 ring-1 ring-slate-100">
        
        {/* Left Side - Graphic */}
        <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-indigo-600 p-12 text-white lg:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-800 opacity-90" />
          {/* Abstract shapes */}
          <div className="absolute -left-12 -top-12 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl mix-blend-multiply" />
          <div className="absolute -bottom-12 -right-12 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl mix-blend-multiply" />
          
          <div className="relative z-10">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl tracking-tight transition-transform hover:scale-105 active:scale-95">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              HomeHub
            </Link>
          </div>
          
          <div className="relative z-10 mt-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-4xl font-bold tracking-tight">Manage your rentals with ease.</h2>
            <p className="mt-4 text-indigo-100 leading-relaxed text-lg">
              Streamline your property management experience. Bills, complaints, and tenant communication—all in one place.
            </p>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 p-8 sm:p-12 md:p-16 flex flex-col justify-center relative">
          {/* Mobile Logo */}
          <div className="absolute top-8 left-8 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              HomeHub
            </Link>
          </div>

          <div className="mx-auto w-full max-w-sm space-y-8 mt-12 lg:mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center lg:text-left">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
              <p className="mt-2 text-sm text-slate-500">Sign in to your HomeHub account.</p>
            </div>

            {error ? (
              <div className="animate-in fade-in zoom-in-95 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm flex items-start gap-3">
                <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            ) : null}

            <form action={signIn} className="space-y-5">
              <input type="hidden" name="next" value={nextPath} />

              <Field label="Email">
                <Input name="email" type="email" autoComplete="email" placeholder="name@example.com" required className="bg-slate-50/50 hover:bg-slate-50 focus:bg-white transition-colors" />
              </Field>

              <Field label="Password">
                <Input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required className="bg-slate-50/50 hover:bg-slate-50 focus:bg-white transition-colors" />
              </Field>

              <div className="pt-2">
                <Button className="w-full py-5 text-base" type="submit">
                  Sign in
                </Button>
              </div>
            </form>

            <div className="text-center text-sm text-slate-600">
              Don't have an account?{' '}
              <Link className="font-semibold text-indigo-600 hover:text-indigo-500 hover:underline transition-colors" href={`/signup?next=${encodeURIComponent(nextPath)}`}>
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
