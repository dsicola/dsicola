import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface SearchableSelectOption {
  value: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  maxHeight?: string;
  showCount?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado encontrado.",
  disabled = false,
  loading = false,
  className,
  maxHeight = "300px",
  showCount = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((option) => option.value === value);

  // Filtrar opções desabilitadas para contagem
  const availableOptions = options.filter((opt) => !opt.disabled);
  const count = availableOptions.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal",
            !selectedOption && "text-muted-foreground",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
          disabled={disabled || loading}
        >
          <span className="truncate">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </span>
            ) : selectedOption ? (
              <div className="flex flex-col items-start">
                <span>{selectedOption.label}</span>
                {selectedOption.subtitle && (
                  <span className="text-xs text-muted-foreground">
                    {selectedOption.subtitle}
                  </span>
                )}
              </div>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList style={{ maxHeight }}>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Carregando...</span>
              </div>
            ) : (
              <>
                {showCount && count > 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground border-b">
                    {count} {count === 1 ? 'opção disponível' : 'opções disponíveis'}
                  </div>
                )}
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => {
                    const searchableText = [option.label, option.subtitle].filter(Boolean).join(' ').trim() || String(option.value ?? '');
                    return (
                    <CommandItem
                      key={String(option.value ?? '')}
                      value={searchableText}
                      disabled={option.disabled}
                      onSelect={() => {
                        onValueChange(option.value === value ? "" : option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "cursor-pointer",
                        option.disabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="truncate">{option.label}</span>
                        {option.subtitle && (
                          <span className="text-xs text-muted-foreground truncate">
                            {option.subtitle}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

