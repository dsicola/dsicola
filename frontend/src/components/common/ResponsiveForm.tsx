import React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveFormProps {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

/**
 * Componente de formulário responsivo
 * - Mobile: Uma coluna
 * - Tablet: Duas colunas (se especificado)
 * - Desktop: Colunas especificadas
 */
export function ResponsiveForm({
  children,
  className,
  columns = 2,
}: ResponsiveFormProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', gridClasses[columns], className)}>
      {children}
    </div>
  );
}

/**
 * Componente para agrupar campos relacionados em mobile
 */
export function ResponsiveFormGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4', className)}>
      {children}
    </div>
  );
}

