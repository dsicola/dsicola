import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const STAR_AMBER = 'text-amber-500 fill-amber-500';
const STAR_EMPTY = 'text-muted-foreground/35 fill-muted/25';

type Size = 'sm' | 'md' | 'lg';

const sizePx: Record<Size, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-[1.125rem] w-[1.125rem]',
  lg: 'h-5 w-5',
};

export interface StarRatingDisplayProps {
  /** Média 0–5 (inclui décimos para preenchimento parcial). */
  value: number;
  size?: Size;
  className?: string;
}

/**
 * Cinco estrelas com preenchimento parcial (ex.: 4,6 → quatro cheias e ~60% na quinta).
 */
export const StarRatingDisplay: React.FC<StarRatingDisplayProps> = ({ value, size = 'md', className }) => {
  const clamped = Math.min(5, Math.max(0, value));
  const dim = sizePx[size];
  const label = `${clamped.toFixed(1).replace('.', ',')} em 5 estrelas`;

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      role="img"
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.min(1, Math.max(0, clamped - (i - 1)));
        return (
          <div key={i} className={cn('relative shrink-0', dim)} aria-hidden>
            <Star className={cn('absolute inset-0', dim, STAR_EMPTY)} strokeWidth={0} />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star className={cn(dim, STAR_AMBER)} strokeWidth={0} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export interface CompactRatingBarProps {
  average: number | null;
  count: number;
  className?: string;
  /** Estilo “mini” (uma estrela + número | N avaliações), tipo vitrine. */
  variant?: 'mini' | 'full';
}

/**
 * Barra horizontal alinhada: estrela(s) + valor + divisor + texto de contagem.
 */
export const CompactRatingBar: React.FC<CompactRatingBarProps> = ({
  average,
  count,
  className,
  variant = 'mini',
}) => {
  if (!count || average == null) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        Sem avaliações ainda
      </p>
    );
  }

  const display = Math.round(average * 10) / 10;

  if (variant === 'mini') {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-none',
          className,
        )}
      >
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-500" aria-hidden strokeWidth={0} />
          <span className="font-semibold tabular-nums text-foreground">{display.toFixed(1).replace('.', ',')}</span>
        </span>
        <span className="hidden sm:inline h-3 w-px bg-border shrink-0" aria-hidden />
        <span className="text-muted-foreground tabular-nums">
          {count} {count === 1 ? 'avaliação' : 'avaliações'}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <StarRatingDisplay value={display} size="sm" />
      <span className="text-sm font-bold tabular-nums text-foreground">
        {display.toFixed(1).replace('.', ',')}
      </span>
      <span className="text-sm text-muted-foreground tabular-nums">
        {count} {count === 1 ? 'avaliação' : 'avaliações'}
      </span>
    </div>
  );
};
