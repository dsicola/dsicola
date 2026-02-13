import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { termoLegalApi } from '@/services/api';

interface TermoLegal {
  id: string;
  tipoAcao: string;
  titulo: string;
  conteudoHtml: string;
  versao: number;
  instituicao?: {
    id: string;
    nome: string;
  };
}

interface TermoLegalModalProps {
  open: boolean;
  onClose: () => void;
  termoHtml?: string;
  onAccept: () => Promise<void>;
  termo?: TermoLegal | null;
  onAceitar?: () => Promise<void>; // Alias para onAccept (compatibilidade)
}

export function TermoLegalModal({
  open,
  onClose,
  termoHtml,
  onAccept,
  onAceitar,
  termo,
}: TermoLegalModalProps) {
  // Usar onAceitar se fornecido, senão usar onAccept
  const handleAcceptCallback = onAceitar || onAccept;
  
  // Obter HTML do termo
  const htmlContent = termoHtml || termo?.conteudoHtml || '';
  const [checked, setChecked] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const canAccept = checked && confirmText === "CONFIRMO" && !loading;

  useEffect(() => {
    return () => {
      // cleanup seguro
      setChecked(false);
      setConfirmText("");
      setLoading(false);
    };
  }, [open]);

  async function handleAccept() {
    try {
      setLoading(true);
      
      // Se tiver termo, registrar aceite no backend
      if (termo?.id) {
        try {
          const response = await termoLegalApi.aceitar(termo.id);

          if (!response.success) {
            throw new Error('Erro ao aceitar termo');
          }

          toast.success('Termo legal aceito com sucesso');
        } catch (error: any) {
          console.error('[TermoLegalModal] Erro ao aceitar termo:', error);
          toast.error(
            error.response?.data?.message || error.message || 'Erro ao aceitar termo legal. Tente novamente.'
          );
          return; // Não fechar modal em caso de erro
        }
      }

      if (handleAcceptCallback) {
        await handleAcceptCallback();
      }
      onClose(); // fechar SOMENTE em sucesso
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <h2 className="text-xl font-semibold">
            Termo de Responsabilidade Institucional
          </h2>
        </DialogHeader>

        <ScrollArea className="h-96 border rounded p-4">
          <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </ScrollArea>

        <div className="flex items-center gap-2 mt-4">
          <Checkbox checked={checked} onCheckedChange={() => setChecked(!checked)} />
          <span>Li e concordo com os termos acima</span>
        </div>

        <Input
          placeholder='Digite "CONFIRMO" para continuar'
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
        />

        <DialogFooter className="mt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!canAccept}
          >
            Aceitar e Prosseguir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

