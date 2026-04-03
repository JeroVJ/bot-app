import { cn } from '../../lib/utils';

const variants = {
  default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  primary: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

export function Badge({ variant = 'default', className, children }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
