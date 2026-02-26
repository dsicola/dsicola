/**
 * Feedback visual consistente (UX-100).
 * Usar em fluxos críticos: sucesso (verde), erro (vermelho), alerta (amarelo).
 */
import { toast as sonnerToast } from "sonner";

export const toast = {
  /** Sucesso — ex.: "Guardado com sucesso" */
  success: (message: string, description?: string) => {
    sonnerToast.success(message, { description });
  },
  /** Erro — ex.: "Não foi possível guardar. Tente novamente." */
  error: (message: string, description?: string) => {
    sonnerToast.error(message, { description });
  },
  /** Alerta — ex.: "Confirme antes de continuar" */
  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, { description });
  },
  /** Info — ex.: "Aceda pelo endereço da sua instituição." */
  info: (message: string, description?: string) => {
    sonnerToast.info(message, { description });
  },
};
