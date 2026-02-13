import React, { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { anoLetivoApi } from '@/services/api';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';
import { AvisoInstitucional } from './AvisoInstitucional';

interface AnoLetivoSelectProps {
  value?: number | string;
  onValueChange: (value: number) => void;
  onIdChange?: (id: string) => void; // Callback para retornar o ID do ano letivo
  label?: string;
  required?: boolean;
  disabled?: boolean;
  showStatus?: boolean; // Mostrar status (Ativo, Encerrado, etc)
  placeholder?: string;
  className?: string;
}

/**
 * Componente reutilizável para seleção de Ano Letivo
 * Carrega apenas anos letivos criados no sistema (via API)
 */
export function AnoLetivoSelect({
  value,
  onValueChange,
  onIdChange,
  label = "Ano Letivo",
  required = false,
  disabled = false,
  showStatus = true,
  placeholder = "Selecione o ano letivo",
  className = "",
}: AnoLetivoSelectProps) {
  const { instituicaoId } = useInstituicao();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();

  // Buscar anos letivos disponíveis
  const { data: anosLetivos = [], isLoading } = useQuery({
    queryKey: ['anos-letivos', instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  const handleValueChange = (selectedValue: string) => {
    if (selectedValue && anosLetivos.length > 0) {
      const anoLetivoSelecionado = anosLetivos.find((al: any) => al.ano.toString() === selectedValue);
      if (anoLetivoSelecionado) {
        onValueChange(Number(selectedValue));
        if (onIdChange) {
          onIdChange(anoLetivoSelecionado.id);
        }
      }
    }
  };

  // Seleção automática: se houver apenas 1 ano letivo, selecionar automaticamente e garantir que o ID seja definido
  useEffect(() => {
    if (!isLoading && anosLetivos.length === 1) {
      const unicoAnoLetivo = anosLetivos[0];
      const valorASelecionar = unicoAnoLetivo.ano.toString();
      // Selecionar se não houver valor ou se o valor atual não corresponder ao único ano letivo
      if (!value || valorASelecionar !== value?.toString()) {
        onValueChange(unicoAnoLetivo.ano);
      }
      // IMPORTANTE: Sempre garantir que o ID seja definido quando há apenas 1 ano letivo
      if (onIdChange) {
        onIdChange(unicoAnoLetivo.id);
      }
    } else if (!isLoading && anosLetivos.length > 0 && value) {
      // Se há múltiplos anos letivos e um valor está selecionado, garantir que o ID correspondente seja definido
      const anoLetivoAtual = anosLetivos.find((al: any) => al.ano.toString() === value?.toString());
      if (anoLetivoAtual && onIdChange) {
        onIdChange(anoLetivoAtual.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, anosLetivos.length, anosLetivos, value]);

  // Encontrar o ano letivo selecionado para exibir no SelectValue
  const anoLetivoSelecionado = anosLetivos.find((al: any) => 
    al.ano.toString() === value?.toString() || al.id === value?.toString()
  );

  // Se não há anos letivos cadastrados, mostrar aviso institucional e ocultar o campo
  if (!isLoading && anosLetivos.length === 0) {
    return (
      <div className={className}>
        <AvisoInstitucional tipo="ano-letivo" />
      </div>
    );
  }

  // Se houver apenas 1 ano letivo, ocultar o select e mostrar apenas o valor (seleção automática)
  if (!isLoading && anosLetivos.length === 1) {
    const unicoAnoLetivo = anosLetivos[0];
    return (
      <div className={`space-y-2 ${className}`}>
        {label && (
          <Label>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <div className="px-3 py-2 border rounded-md bg-muted/50 text-sm">
          {showStatus
            ? `${unicoAnoLetivo.ano} - ${unicoAnoLetivo.status === 'ATIVO' ? '🟢 Ativo' : unicoAnoLetivo.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}`
            : String(unicoAnoLetivo.ano)}
        </div>
      </div>
    );
  }

  // Se houver mais de 1 ano letivo, mostrar select
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select
        value={value?.toString() || ""}
        onValueChange={handleValueChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder}>
            {anoLetivoSelecionado 
              ? (showStatus
                  ? `${anoLetivoSelecionado.ano} - ${anoLetivoSelecionado.status === 'ATIVO' ? '🟢 Ativo' : anoLetivoSelecionado.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}`
                  : String(anoLetivoSelecionado.ano))
              : placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Carregando...</div>
          ) : (
            anosLetivos.map((al: any) => {
              const displayText = showStatus
                ? `${al.ano} - ${al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}`
                : String(al.ano);

              return (
                <SelectItem key={al.id} value={al.ano.toString()}>
                  {displayText}
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>
      {anoLetivoAtivo && !value && (
        <p className="text-xs text-muted-foreground">
          Ano letivo ativo: {anoLetivoAtivo.ano}
        </p>
      )}
    </div>
  );
}

