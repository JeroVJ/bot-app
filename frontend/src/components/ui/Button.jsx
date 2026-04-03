import { cn } from '../../lib/utils';

const variants = {
  default: 'bg-white text-zinc-900 hover:bg-zinc-100 shadow-sm',
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
  destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  outline: 'border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white',
  ghost: 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
  secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
};

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-9 px-4 text-sm rounded-lg',
  lg: 'h-10 px-6 text-sm rounded-lg',
  icon: 'h-8 w-8 rounded-md',
};

export function Button({ variant = 'default', size = 'md', className, disabled, children, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        'disabled:pointer-events-none disabled:opacity-50',
        'cursor-pointer select-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
