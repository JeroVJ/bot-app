import { cn } from '../../lib/utils';

export function Progress({ value = 0, max = 100, className, color = 'bg-blue-500' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn('w-full bg-zinc-800 rounded-full overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ height: '100%', width: `${pct}%` }}
      />
    </div>
  );
}
