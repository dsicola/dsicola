import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { planoEnsinoApi } from "@/services/api";
import { useInstituicao } from "@/contexts/InstituicaoContext";

interface ApresentacaoTabProps {
  context: any;
  plano: any;
  planoId: string | null;
  loadingPlano: boolean;
}

export function ApresentacaoTab({ context, plano, planoId, loadingPlano }: ApresentacaoTabProps) {
  const queryClient = useQueryClient();
  const { isSecundario } = useInstituicao();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    ementa: plano?.ementa || "",
    objetivos: plano?.objetivos || "",
    metodologia: plano?.metodologia || "",
    criteriosAvaliacao: plano?.criteriosAvaliacao || "",
  });

  // Atualizar formData quando plano mudar
  useEffect(() => {
    if (plano) {
      setFormData({
        ementa: plano.ementa || "",
        objetivos: plano.objetivos || "",
        metodologia: plano.metodologia || "",
        criteriosAvaliacao: plano.criteriosAvaliacao || "",
      });
      setIsEditing(false);
    }
  }, [plano]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!planoId) throw new Error("Plano ID não encontrado");
      return await planoEnsinoApi.update(planoId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      toast({ title: "Dados salvos com sucesso!" });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error?.response?.data?.message || "Não foi possível salvar os dados",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsEditing(true);
  };

  if (loadingPlano) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!plano) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Apresentação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Nenhum plano de ensino encontrado para este contexto.
            </p>
            <p className="text-sm text-muted-foreground">
              Vá para a aba "Planejar" para criar um novo plano de ensino.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const canEdit = !plano.bloqueado && plano.estado !== "ENCERRADO";

  return (
    <div className="space-y-6">
      {/* Informações do Contexto */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Disciplina</label>
              <p className="text-base font-medium">{plano.disciplina?.nome}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Professor</label>
              <p className="text-base font-medium">{plano.professor?.nomeCompleto}</p>
            </div>
            {/* Ensino Secundário: Classe/Ano em destaque */}
            {isSecundario && (plano.classe || plano.classeOuAno) && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Classe / Ano</label>
                <p className="text-base font-medium">{plano.classeOuAno || plano.classe?.nome}</p>
              </div>
            )}
            {isSecundario && plano.curso && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Área / Curso de Estudo</label>
                <p className="text-base font-medium">{plano.curso.nome}</p>
              </div>
            )}
            {/* Ensino Superior: Curso e Classe (se existir) */}
            {!isSecundario && plano.curso && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Curso</label>
                <p className="text-base font-medium">{plano.curso.nome}</p>
              </div>
            )}
            {!isSecundario && plano.classe && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Classe</label>
                <p className="text-base font-medium">{plano.classe.nome}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Ano Letivo</label>
              <p className="text-base font-medium">{plano.anoLetivo}</p>
            </div>
            {plano.turma && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Turma</label>
                <p className="text-base font-medium">{plano.turma.nome}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Carga Horária Total (da Disciplina)</label>
              <p className="text-base font-medium">{plano.cargaHorariaTotal || plano.disciplina?.cargaHoraria || 0} horas</p>
            </div>
          </div>
          {plano.bloqueado && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800 font-medium">
                Este plano está bloqueado e não pode ser editado.
              </p>
              {plano.dataBloqueio && (
                <p className="text-xs text-yellow-600 mt-1">
                  Bloqueado em: {new Date(plano.dataBloqueio).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulário de Apresentação */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Dados Gerais do Plano</CardTitle>
            {canEdit && isEditing && (
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                size="sm"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="ementa">
              Ementa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="ementa"
              value={formData.ementa}
              onChange={(e) => handleFieldChange("ementa", e.target.value)}
              placeholder="Descrição geral da disciplina"
              rows={4}
              disabled={!canEdit}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Descrição geral do conteúdo e objetivos da disciplina
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="objetivos">
              Objetivos <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="objetivos"
              value={formData.objetivos}
              onChange={(e) => handleFieldChange("objetivos", e.target.value)}
              placeholder="Objetivos de aprendizagem"
              rows={4}
              disabled={!canEdit}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Objetivos de aprendizagem que os alunos devem alcançar
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metodologia">
              Metodologia <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="metodologia"
              value={formData.metodologia}
              onChange={(e) => handleFieldChange("metodologia", e.target.value)}
              placeholder="Como será ministrada a disciplina"
              rows={4}
              disabled={!canEdit}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Metodologia de ensino e abordagem pedagógica
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="criteriosAvaliacao">
              Critérios de Avaliação <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="criteriosAvaliacao"
              value={formData.criteriosAvaliacao}
              onChange={(e) => handleFieldChange("criteriosAvaliacao", e.target.value)}
              placeholder="Critérios de avaliação e sistema de notas"
              rows={4}
              disabled={!canEdit}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Critérios e métodos de avaliação utilizados na disciplina
            </p>
          </div>

          {!canEdit && (
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                Este plano não pode ser editado. Entre em contato com o administrador.
              </p>
            </div>
          )}

          {canEdit && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Dica:</strong> Clique em qualquer campo para editar. As alterações serão salvas automaticamente quando você clicar em "Salvar".
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
