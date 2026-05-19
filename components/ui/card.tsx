import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Props = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: Props) {
  return (
    <div
      className={cn('rounded-2xl border border-slate-100 bg-white p-6 shadow-sm', className)}
      {...props}
    />
  );
}
