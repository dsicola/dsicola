import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface Column {
  key: string;
  label: string;
  className?: string;
  render?: (value: any, row: any) => React.ReactNode;
  hideOnMobile?: boolean;
  priority?: 'high' | 'medium' | 'low'; // Para decidir o que mostrar em mobile
}

interface ResponsiveTableProps {
  columns: Column[];
  data: any[];
  keyExtractor?: (row: any) => string;
  /** Mensagem simples quando vazio (comportamento antigo) */
  emptyMessage?: string;
  /** UX-100: título do empty state (se definido, usa componente EmptyState) */
  emptyTitle?: string;
  /** Descrição opcional do empty state */
  emptyDescription?: string;
  /** Label do botão de ação (ex.: "Criar aluno") */
  emptyActionLabel?: string;
  /** Callback do botão de ação */
  onEmptyAction?: () => void;
  className?: string;
  mobileCardClassName?: string;
}

/**
 * Componente de tabela responsiva
 * - Desktop: Tabela tradicional
 * - Mobile/Tablet: Cards com informações principais
 */
export function ResponsiveTable({
  columns,
  data,
  keyExtractor = (row) => row.id,
  emptyMessage = 'Nenhum registro encontrado',
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  className,
  mobileCardClassName,
}: ResponsiveTableProps) {
  if (data.length === 0) {
    if (emptyTitle) {
      return (
        <EmptyState
          icon="inbox"
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      );
    }
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  // Colunas principais para mobile (high priority ou sem priority)
  const mobileColumns = columns.filter(
    (col) => !col.hideOnMobile && (col.priority === 'high' || !col.priority)
  );

  return (
    <>
      {/* Desktop Table - hidden on mobile */}
      <div className={cn("hidden md:block overflow-x-auto", className)}>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={column.className}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={keyExtractor(row)}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={column.className}
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key] || '-'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Cards - visible only on mobile */}
      <div className={cn("md:hidden space-y-3", className)}>
        {data.map((row) => (
          <Card key={keyExtractor(row)} className={mobileCardClassName}>
            <CardContent className="p-4 space-y-3">
              {mobileColumns.map((column) => {
                const value = column.render
                  ? column.render(row[column.key], row)
                  : row[column.key] || '-';

                return (
                  <div
                    key={column.key}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                  >
                    <span className="text-sm font-medium text-muted-foreground">
                      {column.label}:
                    </span>
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                );
              })}
              {/* Mostrar colunas secundárias em seção expandida se necessário */}
              {columns.some((col) => col.priority === 'medium' || col.priority === 'low') && (
                <div className="pt-2 border-t space-y-2">
                  {columns
                    .filter((col) => col.priority === 'medium' || col.priority === 'low')
                    .map((column) => {
                      const value = column.render
                        ? column.render(row[column.key], row)
                        : row[column.key] || '-';

                      return (
                        <div
                          key={column.key}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                        >
                          <span className="text-xs text-muted-foreground">
                            {column.label}:
                          </span>
                          <span className="text-xs">{value}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

