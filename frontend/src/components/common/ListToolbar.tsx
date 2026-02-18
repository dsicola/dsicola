/**
 * Toolbar reutilizável para listagens (estudantes, professores, funcionários)
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, RotateCcw } from 'lucide-react';

export interface ListToolbarFilter {
  key: string;
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export interface ListToolbarProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters?: ListToolbarFilter[];
  onClearFilters?: () => void;
  pageSize?: number;
  onPageSizeChange?: (v: number) => void;
  pageSizeOptions?: number[];
  hasActiveFilters?: boolean;
}

export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar por nome, email ou nº...',
  filters = [],
  onClearFilters,
  pageSize = 20,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  hasActiveFilters = false,
}: ListToolbarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
        {filters.map((f) => (
          <Select key={f.key} value={f.value} onValueChange={f.onValueChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={f.placeholder ?? f.label} />
            </SelectTrigger>
            <SelectContent>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {onClearFilters && hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>
      {onPageSizeChange && (
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} por página
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
