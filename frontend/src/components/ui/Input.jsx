import { cn } from '../../lib/utils';

export function Input({ className, label, error, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-zinc-300">{label}</label>}
      <input
        className={cn(
          'h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2',
          'text-sm text-zinc-100 placeholder:text-zinc-500',
          'transition-colors outline-none',
          'focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
