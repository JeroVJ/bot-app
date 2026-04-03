import { cn } from '../../lib/utils';

export function Table({ className, children }) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-sm', className)}>{children}</table>
    </div>
  );
}
export function TableHeader({ className, children }) {
  return <thead className={cn('[&_tr]:border-b [&_tr]:border-zinc-800', className)}>{children}</thead>;
}
export function TableBody({ className, children }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)}>{children}</tbody>;
}
export function TableRow({ className, children, onClick }) {
  return (
    <tr onClick={onClick} className={cn(
      'border-b border-zinc-800/60 transition-colors',
      onClick && 'cursor-pointer hover:bg-zinc-800/50',
      !onClick && 'hover:bg-zinc-800/30',
      className
    )}>{children}</tr>
  );
}
export function TableHead({ className, children }) {
  return <th className={cn('h-10 px-4 text-left align-middle text-xs font-medium text-zinc-500 uppercase tracking-wider', className)}>{children}</th>;
}
export function TableCell({ className, children }) {
  return <td className={cn('px-4 py-3 align-middle text-sm text-zinc-300', className)}>{children}</td>;
}
