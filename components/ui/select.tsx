import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: Props) {
  return (
    <select
      className={cn(
        'w-full appearance-none cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition',
        'focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
