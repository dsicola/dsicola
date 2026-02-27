import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  /** Se true, o trigger é um input: digita e autocompleta (procura inteligente) */
  triggerVariant?: 'button' | 'input';
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
  triggerVariant = "button",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  const getDisplayLabel = (opt: SearchableSelectOption) =>
    [opt.label, opt.subtitle].filter(Boolean).join(' · ') || String(opt.value ?? '');

  const [displayText, setDisplayText] = useState('');
  useEffect(() => {
    if (value) {
      const sel = options.find((o) => o.value === value);
      if (sel) setDisplayText(getDisplayLabel(sel));
    } else {
      setDisplayText('');
    }
  }, [value, options.length]);

  const normalizeForSearch = (s: string) =>
    s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const searchNormalized = normalizeForSearch(displayText);
  const filteredOptions = useMemo(() => {
    if (!searchNormalized) return options;
    return options.filter((opt) => {
      const text = [opt.label, opt.subtitle].filter(Boolean).join(' ');
      return normalizeForSearch(text).includes(searchNormalized);
    });
  }, [options, searchNormalized]);

  const availableOptions = (triggerVariant === 'input' ? filteredOptions : options).filter((opt) => !opt.disabled);
  const count = availableOptions.length;

  const handleSelect = (option: SearchableSelectOption) => {
    const next = option.value === value ? '' : option.value;
    onValueChange(next);
    if (next) setDisplayText(getDisplayLabel(option));
    else setDisplayText('');
    setOpen(false);
  };

  const triggerInput = triggerVariant === 'input' && (
    <div className="relative flex-1 min-w-0" data-searchable-select-trigger>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={displayText}
        onChange={(e) => setDisplayText(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled || loading}
        className={cn("pl-9 pr-9", className)}
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
      />
      <ChevronsUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerVariant === 'input' ? (
          triggerInput
        ) : (
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
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if ((e.target as HTMLElement)?.closest?.('[data-searchable-select-trigger]')) e.preventDefault();
        }}
      >
        <Command shouldFilter={triggerVariant === 'button'}>
          {triggerVariant === 'button' ? (
            <CommandInput placeholder={searchPlaceholder} />
          ) : (
            <div className="hidden" aria-hidden>
              <CommandInput
                value={displayText}
                onValueChange={(v) => setDisplayText(v)}
                placeholder={searchPlaceholder}
              />
            </div>
          )}
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
                  {(triggerVariant === 'input' ? filteredOptions : options).map((option) => {
                    const searchableText = [option.label, option.subtitle].filter(Boolean).join(' ').trim() || String(option.value ?? '');
                    return (
                      <CommandItem
                        key={String(option.value ?? '')}
                        value={searchableText}
                        disabled={option.disabled}
                        onSelect={() => handleSelect(option)}
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

