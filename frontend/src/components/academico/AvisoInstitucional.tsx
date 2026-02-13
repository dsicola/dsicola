import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Plus, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AvisoInstitucionalProps {
  tipo: 'ano-letivo' | 'semestre' | 'trimestre' | 'custom';
  titulo?: string;
  mensagem?: string;
  ctaLabel?: string;
  ctaAction?: () => void;
  ctaRoute?: string;
  variant?: 'info' | 'warning' | 'error';
  className?: string;
}

/**
 * Componente padronizado para avisos institucionais (padrão SIGA/SIGAE)
 * 
 * Características:
 * - Mensagens claras e orientativas
 * - CTAs diretos para resolver o problema
 * - Variantes visuais apropriadas
 * - Nunca bloqueia, apenas orienta
 */
export const AvisoInstitucional: React.FC<AvisoInstitucionalProps> = ({
  tipo,
  titulo,
  mensagem,
  ctaLabel,
  ctaAction,
  ctaRoute,
  variant = 'info',
  className = '',
}) => {
  const navigate = useNavigate();

  // Mensagens padrão por tipo
  const mensagensPadrao = {
    'ano-letivo': {
      titulo: 'Ano letivo não disponível',
      mensagem: 'Crie ou ative um Ano Letivo para iniciar a gestão acadêmica.',
      ctaLabel: 'Criar Ano Letivo',
      ctaRoute: '/admin-dashboard/configuracao-ensino?tab=anos-letivos',
    },
    'semestre': {
      titulo: 'Nenhum semestre cadastrado',
      mensagem: 'Crie um semestre para continuar.',
      ctaLabel: 'Criar Semestre',
      ctaRoute: '/admin-dashboard/configuracao-ensino?tab=semestres',
    },
    'trimestre': {
      titulo: 'Nenhum trimestre cadastrado',
      mensagem: 'Crie um trimestre para lançar avaliações.',
      ctaLabel: 'Criar Trimestre',
      ctaRoute: '/admin-dashboard/configuracao-ensino?tab=trimestres',
    },
    'custom': {
      titulo: titulo || 'Atenção',
      mensagem: mensagem || '',
      ctaLabel: ctaLabel || 'Ação',
      ctaRoute: ctaRoute,
    },
  };

  const config = mensagensPadrao[tipo];
  const finalTitulo = titulo || config.titulo;
  const finalMensagem = mensagem || config.mensagem;
  const finalCtaLabel = ctaLabel || config.ctaLabel;
  const finalCtaRoute = ctaRoute || config.ctaRoute;

  const handleCtaClick = () => {
    if (ctaAction) {
      ctaAction();
    } else if (finalCtaRoute) {
      navigate(finalCtaRoute);
    }
  };

  const variantStyles = {
    info: {
      border: 'border-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      icon: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-800 dark:text-blue-200',
      description: 'text-blue-700 dark:text-blue-300',
      iconComponent: Info,
    },
    warning: {
      border: 'border-yellow-500',
      bg: 'bg-yellow-50 dark:bg-yellow-950/20',
      icon: 'text-yellow-600 dark:text-yellow-400',
      title: 'text-yellow-800 dark:text-yellow-200',
      description: 'text-yellow-700 dark:text-yellow-300',
      iconComponent: AlertCircle,
    },
    error: {
      border: 'border-red-500',
      bg: 'bg-red-50 dark:bg-red-950/20',
      icon: 'text-red-600 dark:text-red-400',
      title: 'text-red-800 dark:text-red-200',
      description: 'text-red-700 dark:text-red-300',
      iconComponent: AlertCircle,
    },
  };

  const styles = variantStyles[variant];
  const IconComponent = styles.iconComponent;

  return (
    <Alert className={`${styles.border} ${styles.bg} ${className}`}>
      <IconComponent className={`h-4 w-4 ${styles.icon}`} />
      <AlertTitle className={styles.title}>{finalTitulo}</AlertTitle>
      <AlertDescription className={`${styles.description} mt-2`}>
        <p className="mb-3">{finalMensagem}</p>
        {(finalCtaRoute || ctaAction) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCtaClick}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            {finalCtaLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

