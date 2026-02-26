import * as React from "react";
import { FileQuestion, Inbox } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  /** Ícone: "inbox" (caixa) ou "search" (interrogação). Default: inbox */
  icon?: "inbox" | "search";
  /** Título (ex.: "Ainda não há alunos") */
  title: string;
  /** Descrição opcional (ex.: "Adicione o primeiro aluno para começar.") */
  description?: string;
  /** Label do botão de ação (ex.: "Criar aluno"). Se não definir, o botão não é mostrado. */
  actionLabel?: string;
  /** Callback ao clicar no botão de ação */
  onAction?: () => void;
  className?: string;
  /** Conteúdo extra (ex.: link ou texto secundário) */
  children?: React.ReactNode;
}

const iconMap = {
  inbox: Inbox,
  search: FileQuestion,
};

/**
 * Empty state reutilizável para listagens e vistas vazias.
 * UX-100: mensagem clara + ação sugerida quando não há dados.
 */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  actionLabel,
  onAction,
  className,
  children,
}: EmptyStateProps) {
  const Icon = iconMap[icon];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center",
        className
      )}
      role="status"
      aria-label={title}
    >
      <Icon className="mx-auto h-12 w-12 text-muted-foreground/70" aria-hidden />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button className="mt-6" onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
