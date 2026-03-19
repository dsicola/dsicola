/**
 * Diálogo para pagamento avulso de Bata ou Passe (fora da matrícula)
 * Usado no POS e Secretaria
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { pagamentosServicoApi, alunosApi } from "@/services/api";
import { getInstituicaoForRecibo, gerarReciboServicoPDF } from "@/utils/pdfGenerator";

const FORMAS_PAGAMENTO = [
  "Dinheiro",
  "Transferência Bancária",
  "Multicaixa",
  "Referência Bancária",
];

interface PagarBataPasseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opcional: se omitido, mostra busca de estudante primeiro */
  alunoId?: string;
  alunoNome?: string;
  config?: { nome_instituicao?: string; logo_url?: string | null; email?: string | null; telefone?: string | null; endereco?: string | null } | null;
  instituicao?: { nome?: string; logo_url?: string | null; email_contato?: string | null; telefone?: string | null; endereco?: string | null } | null;
}

export function PagarBataPasseDialog({
  open,
  onOpenChange,
  alunoId: alunoIdProp,
  alunoNome: alunoNomeProp,
  config,
  instituicao,
}: PagarBataPasseDialogProps) {
  const queryClient = useQueryClient();
  const [selectedAlunoId, setSelectedAlunoId] = useState<string | null>(alunoIdProp ?? null);
  const [selectedAlunoNome, setSelectedAlunoNome] = useState<string | null>(alunoNomeProp ?? null);
  const [searchEstudante, setSearchEstudante] = useState("");
  const [tipoServico, setTipoServico] = useState<"BATA" | "PASSE">("BATA");
  const [formaPagamento, setFormaPagamento] = useState("Transferência Bancária");
  const [observacoes, setObservacoes] = useState("");

  const alunoId = alunoIdProp ?? selectedAlunoId;
  const alunoNome = alunoNomeProp ?? selectedAlunoNome ?? "";

  const { data: estudosRes, isLoading: loadingEstudos } = useQuery({
    queryKey: ["estudantes-search", searchEstudante],
    queryFn: () => alunosApi.getList({ search: searchEstudante, pageSize: 10 }),
    enabled: open && !alunoIdProp && searchEstudante.length >= 2,
  });
  const estudos = (estudosRes?.data as Array<{ id: string; nome_completo?: string; nomeCompleto?: string }>) ?? [];

  const { data: valores, isLoading: loadingValores } = useQuery({
    queryKey: ["pagamentos-servico-valores", alunoId],
    queryFn: () => pagamentosServicoApi.getValoresDisponiveis(alunoId),
    enabled: open && !!alunoId,
  });

  const registrarMutation = useMutation({
    mutationFn: (payload: {
      alunoId: string;
      tipoServico: "BATA" | "PASSE";
      valor: number;
      metodoPagamento: string;
      observacoes?: string;
    }) => pagamentosServicoApi.registrar(payload),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["mensalidades-pos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-servico"] });

      const inst = getInstituicaoForRecibo({ config, instituicao });
      const pdfData = {
        instituicao: {
          nome: inst.nome || "",
          endereco: inst.endereco ?? null,
          telefone: inst.telefone ?? null,
          email: inst.email ?? null,
          logoUrl: inst.logoUrl ?? null,
        },
        aluno: {
          nome: res.pagamento?.aluno?.nomeCompleto || alunoNome,
          numeroId: res.pagamento?.aluno?.numeroIdentificacaoPublica ?? null,
        },
        tipoServico: res.pagamento?.tipoServico || tipoServico,
        valor: Number(res.pagamento?.valor ?? 0),
        formaPagamento: res.pagamento?.metodoPagamento || formaPagamento,
        numeroRecibo: res.numeroRecibo || "N/A",
        dataPagamento: res.pagamento?.dataPagamento
          ? new Date(res.pagamento.dataPagamento).toISOString()
          : new Date().toISOString(),
      };

      try {
        const blob = await gerarReciboServicoPDF(pdfData);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `recibo-${tipoServico.toLowerCase()}-${res.numeroRecibo}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Erro ao gerar PDF:", e);
      }

      toast({ title: "Pagamento registrado", description: `Recibo ${res.numeroRecibo} emitido.` });
      onOpenChange(false);
      setObservacoes("");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });

  const valorBata = valores?.bata?.valor ?? 0;
  const valorPasse = valores?.passe?.valor ?? 0;
  const valorAtual = tipoServico === "BATA" ? valorBata : valorPasse;

  const handleConfirmar = () => {
    if (valorAtual <= 0) {
      toast({
        variant: "destructive",
        title: "Valor não configurado",
        description: `O curso/classe não possui valor para ${tipoServico === "BATA" ? "bata" : "passe"}. Configure em Taxas e Serviços.`,
      });
      return;
    }
    registrarMutation.mutate({
      alunoId,
      tipoServico,
      valor: valorAtual,
      metodoPagamento: formaPagamento,
      observacoes: observacoes.trim() || undefined,
    });
  };

  const showSearchStep = !alunoIdProp && !selectedAlunoId;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setSelectedAlunoId(null);
          setSelectedAlunoNome(null);
          setSearchEstudante("");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar Bata ou Passe</DialogTitle>
        </DialogHeader>

        {showSearchStep ? (
          <div className="space-y-4">
            <div>
              <Label>Buscar estudante (nome ou nº)</Label>
              <Input
                value={searchEstudante}
                onChange={(e) => setSearchEstudante(e.target.value)}
                placeholder="Digite pelo menos 2 caracteres..."
                className="mt-1"
              />
            </div>
            {loadingEstudos && <p className="text-sm text-muted-foreground">A buscar...</p>}
            {!loadingEstudos && searchEstudante.length >= 2 && (
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {estudos.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum estudante encontrado.</p>
                ) : (
                  estudos.map((e: { id: string; nome_completo?: string; nomeCompleto?: string }) => (
                    <button
                      key={e.id}
                      type="button"
                      className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedAlunoId(e.id);
                        setSelectedAlunoNome(e.nomeCompleto ?? e.nome_completo ?? "");
                      }}
                    >
                      {e.nomeCompleto ?? e.nome_completo ?? "N/A"}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : loadingValores ? (
          <p className="text-sm text-muted-foreground">A carregar valores...</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Estudante: <strong>{alunoNome}</strong>
            </p>

            <div className="space-y-2">
              <Label>Serviço</Label>
              <RadioGroup
                value={tipoServico}
                onValueChange={(v) => setTipoServico(v as "BATA" | "PASSE")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="BATA"
                    id="bata"
                    disabled={valorBata <= 0}
                  />
                  <Label htmlFor="bata">
                    Bata {valorBata > 0 ? `(${new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(valorBata)})` : "(não configurado)"}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="PASSE"
                    id="passe"
                    disabled={valorPasse <= 0}
                  />
                  <Label htmlFor="passe">
                    Passe {valorPasse > 0 ? `(${new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(valorPasse)})` : "(não configurado)"}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                type="text"
                readOnly
                value={
                  valorAtual > 0
                    ? new Intl.NumberFormat("pt-AO", {
                        style: "currency",
                        currency: "AOA",
                      }).format(valorAtual)
                    : "—"
                }
                className="font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((fp) => (
                    <SelectItem key={fp} value={fp}>
                      {fp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Pagamento em duas parcelas"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={
              loadingValores ||
              registrarMutation.isPending ||
              valorAtual <= 0
            }
          >
            {registrarMutation.isPending ? "A processar..." : "Confirmar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
