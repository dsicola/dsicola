/**
 * Combobox para seleção de conta contábil com busca.
 * Usado em Integração Contábil e Configuração.
 */
import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const CAIXA_BANCO = 'CAIXA_BANCO';
const CAIXA_BANCO_LABEL = 'Caixa/Banco (conforme método de pagamento)';

export interface ContaOption {
  id: string;
  codigo: string;
  descricao: string;
  tipo?: string;
}

interface ContaSelectProps {
  contas: ContaOption[];
  value: string;
  onChange: (codigo: string) => void;
  placeholder?: string;
  allowCaixaBanco?: boolean;
  filterTipo?: string;
  className?: string;
}

export function ContaSelect({
  contas,
  value,
  onChange,
  placeholder = 'Selecione a conta',
  allowCaixaBanco = true,
  filterTipo,
  className,
}: ContaSelectProps) {
  const [open, setOpen] = useState(false);

  const filtered =
    filterTipo && contas.some((c) => c.tipo === filterTipo)
      ? contas.filter((c) => c.tipo === filterTipo)
      : contas;

  const options = allowCaixaBanco
    ? [{ id: CAIXA_BANCO, codigo: CAIXA_BANCO, descricao: CAIXA_BANCO_LABEL }, ...filtered]
    : filtered;

  const selected = options.find((c) => c.codigo === value);
  const displayValue = selected
    ? selected.codigo === CAIXA_BANCO
      ? CAIXA_BANCO_LABEL
      : `${selected.codigo} - ${selected.descricao}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar conta (código ou descrição)..." />
          <CommandList>
            <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
            <CommandGroup>
              {options.map((conta) => (
                <CommandItem
                  key={conta.id}
                  value={`${conta.codigo} ${conta.descricao}`}
                  onSelect={() => {
                    onChange(conta.codigo);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === conta.codigo ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono text-xs text-muted-foreground">{conta.codigo}</span>
                  <span className="ml-2 truncate">{conta.descricao}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
