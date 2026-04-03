import { cn } from '../../lib/utils';
import { Card, CardContent } from './Card';

export function Stat({ title, value, description, icon: Icon, trend, trendLabel, iconColor = 'text-blue-400', iconBg = 'bg-blue-500/10' }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</p>
            <p className="mt-2 text-2xl font-bold text-zinc-100 tabular-nums">{value}</p>
            {description && <p className="mt-1 text-xs text-zinc-500 truncate">{description}</p>}
            {trendLabel && (
              <p className={cn('mt-1 text-xs font-medium', trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-400')}>
                {trendLabel}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0', iconBg)}>
              <Icon className={cn('w-4 h-4', iconColor)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
