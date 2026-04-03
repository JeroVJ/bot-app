import { cn } from '../../lib/utils';

export function Spinner({ size = 'md', className }) {
  const sizes = { sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-6 h-6', xl: 'w-8 h-8' };
  return (
    <div className={cn('animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500', sizes[size], className)} />
  );
}
