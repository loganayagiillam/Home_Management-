'use client';

import { useEffect, useState } from 'react';

export function RealtimeClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={className ?? ''} aria-label="Current date and time">
      {now.toLocaleString('en-IN')}
    </div>
  );
}
