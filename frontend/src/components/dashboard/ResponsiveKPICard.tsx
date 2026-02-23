import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ResponsiveKPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  /** Se informado, o card torna-se clicável e navega para o path */
  onClick?: () => void;
}

/**
 * Card de KPI responsivo que se adapta a mobile/tablet/desktop
 * Mobile: largura total
 * Tablet: 2 colunas
 * Desktop: 4 colunas
 */
export const ResponsiveKPICard: React.FC<ResponsiveKPICardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  className,
  isLoading = false,
  emptyMessage,
  onClick,
}) => {
  if (isLoading) {
    return (
      <Card className={cn('animate-slide-up', className)}>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              {description && <Skeleton className="h-3 w-32" />}
            </div>
            <Skeleton className="h-12 w-12 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isEmpty = value === 0 || value === '0' || !value;
  const displayValue = isEmpty && emptyMessage ? emptyMessage : value;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={onClick ? 'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl' : undefined}
    >
    <Card className={cn('animate-slide-up hover:shadow-md transition-shadow', onClick && 'cursor-pointer hover:ring-2 hover:ring-primary/20', className)}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p
              className={cn(
                'text-2xl sm:text-3xl font-bold tracking-tight',
                isEmpty ? 'text-muted-foreground' : 'text-foreground'
              )}
            >
              {displayValue}
            </p>
            {description && !isEmpty && (
              <p className="text-xs text-muted-foreground truncate">{description}</p>
            )}
            {trend && (
              <p
                className={cn(
                  'text-xs font-medium',
                  trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}
              >
                {trend.isPositive ? '+' : '-'}
                {Math.abs(trend.value)}% em relação ao mês anterior
              </p>
            )}
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  );
};

