import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { semestreApi, trimestreApi } from '@/services/api';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AvisoInstitucional } from './AvisoInstitucional';

interface PeriodoAcademicoSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  anoLetivo?: number;
  anoLetivoId?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /**
   * Se true, usa valores numéricos (1, 2 para semestre ou 1, 2, 3 para trimestre) em vez de IDs
   * Útil para casos onde o backend espera números em vez de IDs
   */
  useNumericValue?: boolean;
}

/**
 * Componente institucional para seleção de Semestre (Ensino Superior) ou Trimestre (Ensino Secundário)
 * 
 * COMPORTAMENTO UX INSTITUCIONAL:
 * - Só exibe o campo se existir pelo menos 1 registro cadastrado
 * - Se não existir, exibe aviso orientativo e botão para criar
 * - Respeita tipoInstituicao (SUPERIOR = Semestre, SECUNDARIO = Trimestre)
 */
export const PeriodoAcademicoSelect: React.FC<PeriodoAcademicoSelectProps> = ({
  value,
  onValueChange,
  anoLetivo,
  anoLetivoId,
  label,
  required = false,
  disabled = false,
  className = '',
  placeholder,
  useNumericValue = false,
}) => {
  const { isSuperior: isSuperiorContext, isSecundario: isSecundarioContext, instituicao } = useInstituicao();
  const { instituicaoId } = useTenantFilter();
  const navigate = useNavigate();

  // Usar valores do contexto (mais confiável) ou fallback para instituicao direta
  const isSuperior = isSuperiorContext || instituicao?.tipo_academico === 'SUPERIOR';
  const isSecundario = isSecundarioContext || instituicao?.tipo_academico === 'SECUNDARIO';

  // Buscar semestres (Ensino Superior)
  const { data: semestres = [], isLoading: isLoadingSemestres, isError: isErrorSemestres } = useQuery({
    queryKey: ['semestres', instituicaoId, anoLetivo, anoLetivoId],
    queryFn: async () => {
      if (anoLetivoId) {
        return await semestreApi.getAll({ anoLetivoId });
      }
      if (anoLetivo) {
        return await semestreApi.getAll({ anoLetivo });
      }
      return [];
    },
    enabled: isSuperior && !!instituicaoId && (!!anoLetivo || !!anoLetivoId),
    retry: 1,
    staleTime: 30000, // Cache por 30 segundos
  });

  // Buscar trimestres (Ensino Secundário)
  const { data: trimestres = [], isLoading: isLoadingTrimestres } = useQuery({
    queryKey: ['trimestres', instituicaoId, anoLetivo, anoLetivoId],
    queryFn: async () => {
      if (anoLetivoId) {
        return await trimestreApi.getAll({ anoLetivoId });
      }
      if (anoLetivo) {
        return await trimestreApi.getAll({ anoLetivo });
      }
      return await trimestreApi.getAll();
    },
    enabled: isSecundario && !!instituicaoId && (!!anoLetivo || !!anoLetivoId),
  });

  const isLoading = isLoadingSemestres || isLoadingTrimestres;
  const hasSemestres = Array.isArray(semestres) && semestres.length > 0;
  const hasTrimestres = Array.isArray(trimestres) && trimestres.length > 0;

  // Seleção automática: se houver apenas 1 período e não houver valor selecionado, selecionar automaticamente
  useEffect(() => {
    if (!isLoading && !disabled) {
      if (isSuperior && semestres.length === 1) {
        const unicoSemestre = semestres[0];
        const valorASelecionar = useNumericValue ? unicoSemestre.numero.toString() : unicoSemestre.id;
        // Só selecionar automaticamente se não houver valor ou se o valor atual não corresponder
        if (!value || (value !== valorASelecionar && value !== unicoSemestre.numero.toString() && value !== unicoSemestre.id)) {
          onValueChange(valorASelecionar);
        }
      } else if (isSecundario && trimestres.length === 1) {
        const unicoTrimestre = trimestres[0];
        const valorASelecionar = useNumericValue ? unicoTrimestre.numero.toString() : unicoTrimestre.id;
        // Só selecionar automaticamente se não houver valor ou se o valor atual não corresponder
        if (!value || (value !== valorASelecionar && value !== unicoTrimestre.numero.toString() && value !== unicoTrimestre.id)) {
          onValueChange(valorASelecionar);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, semestres.length, trimestres.length, isSuperior, isSecundario, useNumericValue, disabled]);

  // Ensino Superior - Semestre
  if (isSuperior) {
    // Se não há ano letivo selecionado, mostrar campo desabilitado com mensagem
    if (!anoLetivo && !anoLetivoId) {
      return (
        <div className={`space-y-2 ${className}`}>
          <Label className={required ? 'after:content-["*"] after:ml-0.5 after:text-destructive' : ''}>
            {label || 'Semestre'}
          </Label>
          <Select disabled required={required}>
            <SelectTrigger className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <SelectValue placeholder="Selecione um ano letivo primeiro" />
            </SelectTrigger>
          </Select>
          <p className="text-xs text-muted-foreground">
            Selecione um ano letivo no contexto do plano de ensino antes de criar a aula.
          </p>
        </div>
      );
    }
    
    // Se não há semestres cadastrados E não está carregando E não há erro, mostrar campo desabilitado com alerta orientativo
    if (!isLoading && !hasSemestres && !isErrorSemestres && (!!anoLetivo || !!anoLetivoId)) {
      return (
        <div className={`space-y-2 ${className}`}>
          <Label className={required ? 'after:content-["*"] after:ml-0.5 after:text-destructive' : ''}>
            {label || 'Semestre'}
          </Label>
          <Select
            value={value || ''}
            onValueChange={onValueChange}
            disabled={true}
            required={required}
          >
            <SelectTrigger className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <SelectValue placeholder="Semestre não configurado" />
            </SelectTrigger>
          </Select>
          <AvisoInstitucional 
            tipo="custom" 
            variant="warning"
            titulo="Semestre não configurado"
            mensagem="Cadastre um semestre para o ano letivo selecionado antes de continuar. Acesse Configuração de Ensino > Semestres para criar."
            ctaLabel="Gerenciar Semestres"
            ctaRoute="/admin-dashboard/configuracao-ensino?tab=semestres"
          />
        </div>
      );
    }

    // Renderizar select sempre que houver semestres (mesmo que seja apenas 1)
    // Isso garante que o valor seja sempre visível e editável
    if (hasSemestres) {
      return (
        <div className={`space-y-2 ${className}`}>
          <Label className={required ? 'after:content-["*"] after:ml-0.5 after:text-destructive' : ''}>
            {label || 'Semestre'}
          </Label>
          <Select
            value={value || ''}
            onValueChange={onValueChange}
            disabled={disabled || isLoading}
            required={required}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholder || 'Selecione o semestre'} />
            </SelectTrigger>
            <SelectContent>
              {semestres.map((semestre: any) => (
                <SelectItem 
                  key={semestre.id} 
                  value={useNumericValue ? semestre.numero.toString() : semestre.id}
                >
                  {semestre.numero}º Semestre
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Loading state
    return (
      <div className={`space-y-2 ${className}`}>
        {label && <Label>{label}</Label>}
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Carregando semestres..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  // Ensino Secundário - Trimestre
  if (isSecundario) {
    // Se não há ano letivo selecionado, mostrar campo desabilitado com mensagem
    if (!anoLetivo && !anoLetivoId) {
      return (
        <div className={`space-y-2 ${className}`}>
          <Label className={required ? 'after:content-["*"] after:ml-0.5 after:text-destructive' : ''}>
            {label || 'Trimestre'}
          </Label>
          <Select disabled required={required}>
            <SelectTrigger className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <SelectValue placeholder="Selecione um ano letivo primeiro" />
            </SelectTrigger>
          </Select>
          <p className="text-xs text-muted-foreground">
            Selecione um ano letivo no contexto do plano de ensino antes de criar a aula.
          </p>
        </div>
      );
    }
    
    // Se não há trimestres cadastrados, mostrar campo desabilitado com mensagem orientativa
    if (!isLoading && !hasTrimestres && (!!anoLetivo || !!anoLetivoId)) {
      return (
        <div className={`space-y-2 ${className}`}>
          <Label className={required ? 'after:content-["*"] after:ml-0.5 after:text-destructive' : ''}>
            {label || 'Trimestre'}
          </Label>
          <Select
            value={value || ''}
            onValueChange={onValueChange}
            disabled={true}
            required={required}
          >
            <SelectTrigger className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <SelectValue placeholder="Nenhum trimestre cadastrado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="empty" disabled>Nenhum trimestre cadastrado</SelectItem>
            </SelectContent>
          </Select>
          <AvisoInstitucional tipo="trimestre" variant="info" />
        </div>
      );
    }

    // Se houver apenas 1 trimestre, ocultar select e mostrar apenas o valor (seleção automática)
    if (!isLoading && hasTrimestres && trimestres.length === 1 && value) {
      const unicoTrimestre = trimestres[0];
      return (
        <div className={`space-y-2 ${className}`}>
          {label && (
            <Label className={required ? 'after:content-["*"] after:ml-0.5 after:text-destructive' : ''}>
              {label || 'Trimestre'}
            </Label>
          )}
          <div className="px-3 py-2 border rounded-md bg-muted/50 text-sm">
            {unicoTrimestre.numero}º Trimestre
          </div>
        </div>
      );
    }

    // Renderizar select apenas se houver mais de 1 trimestre
    if (hasTrimestres && trimestres.length > 1) {
      return (
        <div className={`space-y-2 ${className}`}>
          <Label className={required ? 'after:content-["*"] after:ml-0.5 after:text-destructive' : ''}>
            {label || 'Trimestre'}
          </Label>
          <Select
            value={value || ''}
            onValueChange={onValueChange}
            disabled={disabled || isLoading}
            required={required}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholder || 'Selecione o trimestre'} />
            </SelectTrigger>
            <SelectContent>
              {trimestres.map((trimestre: any) => (
                <SelectItem 
                  key={trimestre.id} 
                  value={useNumericValue ? trimestre.numero.toString() : trimestre.id}
                >
                  {trimestre.numero}º Trimestre
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Loading state
    return (
      <div className={`space-y-2 ${className}`}>
        {label && <Label>{label}</Label>}
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Carregando trimestres..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  // Fallback: Se tipo de instituição não foi detectado, mostrar campo desabilitado
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className={required ? 'after:content-["*"] after:ml-0.5 after:text-destructive' : ''}>
        {label || 'Período Acadêmico'}
      </Label>
      <Select disabled required={required}>
        <SelectTrigger className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <SelectValue placeholder="Tipo de instituição não detectado" />
        </SelectTrigger>
      </Select>
      <p className="text-xs text-muted-foreground">
        Configure o tipo acadêmico da instituição para habilitar este campo.
      </p>
    </div>
  );
};

