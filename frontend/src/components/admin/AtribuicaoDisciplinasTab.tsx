import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { planoEnsinoApi, professorsApi, disciplinasApi, cursosApi, anoLetivoApi, classesApi } from "@/services/api";
import { AxiosError } from "axios";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { SmartSearch } from "@/components/common/SmartSearch";
import { useProfessorSearch } from "@/hooks/useSmartSearch";
import { AnoLetivoSelect } from "@/components/academico/AnoLetivoSelect";
import { PeriodoAcademicoSelect } from "@/components/academico/PeriodoAcademicoSelect";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/utils/apiErrors";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlanoEnsino {
  id: string;
  anoLetivo: number;
  semestre?: number;
  classeOuAno?: string;
  professor: {
    id: string;
    nomeCompleto?: string;
    nome_completo?: string;
    user?: { nomeCompleto: string };
  };
  disciplina: {
    id: string;
    nome: string;
    cargaHoraria: number;
  };
  curso?: {
    id: string;
    nome: string;
    codigo: string;
  };
  classe?: {
    id: string;
    nome: string;
    codigo: string;
  };
}

interface Professor {
  id: string;
  nome_completo: string;
}

export function AtribuicaoDisciplinasTab() {
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  const { isSecundario, isSuperior } = useInstituicao();
  const { searchProfessores } = useProfessorSearch();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();
  
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [filterAnoLetivoId, setFilterAnoLetivoId] = useState<string>("");
  const [formData, setFormData] = useState({
    professor_id: "",
    disciplina_id: "",
    curso_id: "",
    classe_id: "",
    anoLetivoId: "",
    anoLetivo: undefined as number | undefined, // Para exibição no AnoLetivoSelect
    semestre: undefined as number | undefined, // Não usar valor padrão hardcoded
    classeOuAno: "" as string | undefined,
  });

  const queryClient = useQueryClient();

  // Buscar anos letivos apenas para o filtro (necessário para exibir lista)
  const { data: anosLetivos = [] } = useQuery({
    queryKey: ["anos-letivos-filtro", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Buscar planos de ensino (atribuições)
  const { data: planosEnsino, isLoading, error: errorPlanos, refetch: refetchPlanos } = useQuery({
    queryKey: ["planos-ensino-atribuicoes", filterAnoLetivoId, instituicaoId],
    queryFn: async () => {
      if (!filterAnoLetivoId) {
        return [];
      }

      // Buscar todos os planos de ensino do ano letivo selecionado
      // O backend agora permite listar planos apenas com anoLetivoId (sem professorId)
      const params: any = {
        anoLetivoId: filterAnoLetivoId,
      };

      const data = await planoEnsinoApi.getByContext(params);
      // O backend retorna uma lista quando disciplinaId não é fornecido
      const result = Array.isArray(data) ? data : [];
      
      // Debug: log para verificar dados retornados
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AtribuicaoDisciplinasTab] Planos retornados:', result.length, result);
      }
      
      return result;
    },
    enabled: !!filterAnoLetivoId,
    retry: 1,
  });

  // usar professorsApi (GET /professores) - retorna professores.id
  // NUNCA userRolesApi + profilesApi que retornam users.id
  const { data: professores } = useQuery({
    queryKey: ["professores-select", instituicaoId],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      return (data || []).map((p: any) => ({
        id: p.id,
        nome_completo: p.nomeCompleto || p.nome_completo || p.nome || "",
      })) as Professor[];
    },
    enabled: !!instituicaoId,
  });

  const { data: disciplinas, isLoading: loadingDisciplinas, error: errorDisciplinas } = useQuery({
    queryKey: ["disciplinas-select", instituicaoId],
    queryFn: async () => {
      const params: any = {};
      if (isSuperAdmin && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      
      const data = await disciplinasApi.getAll(params);
      return Array.isArray(data) ? data : [];
    },
    enabled: true,
    retry: 1,
    staleTime: 30000,
  });

  // Buscar cursos para seleção
  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-select", instituicaoId],
    queryFn: async () => {
      const params: any = {};
      if (isSuperAdmin && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      
      const data = await cursosApi.getAll(params);
      return Array.isArray(data) ? data : [];
    },
    enabled: true,
    retry: 1,
  });

  // Buscar classes para seleção (Ensino Secundário)
  const { data: classes = [] } = useQuery({
    queryKey: ["classes-select", instituicaoId],
    queryFn: async () => {
      const params: any = {};
      if (isSuperAdmin && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      
      const data = await classesApi.getAll(params);
      return Array.isArray(data) ? data : [];
    },
    enabled: isSecundario, // Apenas buscar se for Ensino Secundário
    retry: 1,
  });

  // Quando disciplina é selecionada, buscar seu curso automaticamente
  const disciplinaSelecionada = useMemo(() => {
    if (!formData.disciplina_id || !disciplinas) return null;
    return disciplinas.find((d: any) => d.id === formData.disciplina_id);
  }, [formData.disciplina_id, disciplinas]);

  // Atualizar curso_id quando disciplina é selecionada
  useEffect(() => {
    if (disciplinaSelecionada?.curso_id) {
      setFormData(prev => ({ ...prev, curso_id: disciplinaSelecionada.curso_id }));
    }
  }, [disciplinaSelecionada]);

  const createMutation = useSafeMutation({
    mutationFn: async (data: typeof formData) => {
      if (!data.anoLetivoId) {
        throw new Error("Ano Letivo é obrigatório");
      }
      if (!data.curso_id && isSuperior) {
        throw new Error("Curso é obrigatório para Ensino Superior");
      }
      if (!data.disciplina_id) {
        throw new Error("Disciplina é obrigatória");
      }
      if (!data.professor_id) {
        throw new Error("Professor é obrigatório");
      }

      const insertData: any = {
        professorId: data.professor_id,
        disciplinaId: data.disciplina_id,
        anoLetivoId: data.anoLetivoId,
        cursoId: data.curso_id || undefined,
      };

      if (isSuperior) {
        if (!data.semestre) {
          throw new Error("Semestre é obrigatório para Ensino Superior. Selecione um semestre cadastrado.");
        }
        insertData.semestre = data.semestre;
      } else if (isSecundario) {
        if (!data.classe_id) {
          throw new Error("Classe é obrigatória para Ensino Secundário. Selecione uma classe antes de continuar.");
        }
        if (!data.classeOuAno || data.classeOuAno.trim() === '') {
          throw new Error("Classe/Ano é obrigatório para Ensino Secundário (ex: '10ª Classe', '1º Ano')");
        }
        insertData.classeId = data.classe_id;
        insertData.classeOuAno = data.classeOuAno;
      }

      await planoEnsinoApi.createOrGet(insertData);
    },
    onSuccess: async (data) => {
      // Se não houver filtro de ano letivo selecionado, usar o ano letivo da atribuição criada
      const anoLetivoIdParaFiltro = filterAnoLetivoId || formData.anoLetivoId;
      
      // Definir filtro ANTES de invalidar queries (para garantir que a query seja habilitada)
      if (!filterAnoLetivoId && formData.anoLetivoId) {
        setFilterAnoLetivoId(formData.anoLetivoId);
      }
      
      // Invalidar queries relacionadas
      await queryClient.invalidateQueries({ queryKey: ["planos-ensino-atribuicoes"] });
      await queryClient.invalidateQueries({ queryKey: ["planos-ensino"] });
      
      // Forçar refetch imediato se houver ano letivo para filtrar
      if (anoLetivoIdParaFiltro) {
        // Aguardar um pouco para garantir que o backend processou a criação e o estado foi atualizado
        setTimeout(async () => {
          await queryClient.refetchQueries({ 
            queryKey: ["planos-ensino-atribuicoes", anoLetivoIdParaFiltro, instituicaoId] 
          });
          // Também chamar refetch diretamente se a função estiver disponível
          if (refetchPlanos) {
            await refetchPlanos();
          }
        }, 300);
      }
      
      toast.success("Atribuição criada com sucesso!");
      // Fechar modal e resetar formulário APENAS em caso de sucesso confirmado
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      // NÃO fechar modal em caso de erro - manter estado para correção
      let errorMessage = "Erro ao criar atribuição. Por favor, tente novamente.";
      
      // Tratar AxiosError
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const responseData = error.response?.data;
        
        // Tratar especificamente o erro 409 (Conflict)
        if (status === 409) {
          errorMessage = responseData?.message || 
            responseData?.error || 
            "Já existe um plano de ensino para esta disciplina e ano letivo, mas vinculado a outro professor. Não é possível criar múltiplos planos para a mesma disciplina no mesmo ano letivo. Use o plano existente ou entre em contato com o administrador.";
        } else {
          // Para outros erros, tentar extrair a mensagem do backend
          errorMessage = responseData?.message || 
                        responseData?.error || 
                        error.message || 
                        errorMessage;
        }
      } else if (error instanceof Error) {
        // Verificar se a mensagem contém palavras-chave relacionadas a duplicação
        if (error.message.includes("duplicate") || 
            error.message.includes("unique") ||
            error.message.includes("já existe") ||
            error.message.includes("já possui")) {
          errorMessage = "Esta disciplina já possui um professor atribuído para este período!";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      // Modal permanece aberto para correção
    },
  });

  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await planoEnsinoApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos-ensino-atribuicoes"] });
      toast.success("Atribuição removida com sucesso!");
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, "Erro ao remover atribuição. Tente novamente."));
    },
  });

  const resetForm = () => {
    setFormData({
      professor_id: "",
      disciplina_id: "",
      curso_id: "",
      classe_id: "",
      anoLetivoId: "",
      anoLetivo: undefined,
      semestre: undefined,
      classeOuAno: undefined,
    });
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Atribuição de Disciplinas
            </CardTitle>
            <CardDescription>
              Gerencie as atribuições de disciplinas aos professores via Plano de Ensino
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Atribuição
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Atribuir Disciplina a Professor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Professor *</Label>
                <SmartSearch
                  placeholder="Digite o nome do professor ou email..."
                  value={professores?.find((p: Professor) => p.id === formData.professor_id)?.nome_completo || ""}
                  selectedId={formData.professor_id || undefined}
                  onSelect={(item) => {
                    if (item) {
                      setFormData({ ...formData, professor_id: item.id });
                    } else {
                      setFormData({ ...formData, professor_id: "" });
                    }
                  }}
                  searchFn={searchProfessores}
                  emptyMessage="Nenhum professor encontrado"
                  minSearchLength={2}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Disciplina *</Label>
                <Select
                  value={formData.disciplina_id}
                  onValueChange={(value) => {
                    const disciplina = disciplinas?.find((d: any) => d.id === value);
                    setFormData({ 
                      ...formData, 
                      disciplina_id: value,
                      curso_id: disciplina?.curso_id || "",
                    });
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma disciplina..." />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingDisciplinas ? (
                      <SelectItem value="loading" disabled>
                        Carregando disciplinas...
                      </SelectItem>
                    ) : errorDisciplinas ? (
                      <SelectItem value="error" disabled>
                        Erro ao carregar disciplinas. Tente novamente.
                      </SelectItem>
                    ) : disciplinas && disciplinas.length > 0 ? (
                      disciplinas.filter((disc: any) => disc?.id).map((disc: any) => (
                        <SelectItem key={disc.id} value={String(disc.id)}>
                          {disc.nome} {disc.curso?.nome ? `- ${disc.curso.nome}` : ''}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Nenhuma disciplina encontrada. Verifique os registros cadastrados.
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {isSuperior && (
                <div className="space-y-2">
                  <Label>Curso *</Label>
                  <Select
                    value={formData.curso_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, curso_id: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um curso..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cursos.map((curso: any) => (
                        <SelectItem key={curso.id} value={curso.id}>
                          {curso.nome} {curso.codigo ? `(${curso.codigo})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <AnoLetivoSelect
                value={formData.anoLetivo ? Number(formData.anoLetivo) : undefined}
                onValueChange={(ano) => {
                  setFormData((prev) => ({ ...prev, anoLetivo: ano }));
                }}
                onIdChange={(id) => {
                  setFormData((prev) => ({ ...prev, anoLetivoId: id }));
                }}
                label="Ano Letivo *"
                required
                showStatus={true}
              />

              {isSuperior && (
                <PeriodoAcademicoSelect
                  value={formData.semestreId || formData.semestre?.toString() || ""}
                  onValueChange={(value) => {
                    // Se o valor é um ID (UUID), usar semestreId, senão usar semestre (número)
                    if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                      setFormData({ ...formData, semestreId: value, semestre: undefined });
                    } else {
                      setFormData({ ...formData, semestre: Number(value), semestreId: undefined });
                    }
                  }}
                  anoLetivo={anoLetivoAtivo?.ano}
                  anoLetivoId={formData.anoLetivoId || anoLetivoAtivo?.id}
                  label="Semestre"
                  required
                  useNumericValue={true}
                />
              )}

              {isSecundario && (
                <>
                  <div className="space-y-2">
                    <Label>Classe *</Label>
                    <Select
                      value={formData.classe_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, classe_id: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma classe..." />
                      </SelectTrigger>
                      <SelectContent>
                        {classes && classes.length > 0 ? (
                          classes.map((classe: any) => (
                            <SelectItem key={classe.id} value={classe.id}>
                              {classe.nome} {classe.codigo ? `(${classe.codigo})` : ''}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            Nenhuma classe encontrada. Cadastre classes em Configuração de Ensino → Classes.
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Classe / Ano *</Label>
                    <input
                      type="text"
                      value={formData.classeOuAno || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, classeOuAno: e.target.value })
                      }
                      placeholder="Ex: 10ª Classe, 1º Ano"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={
                    createMutation.isPending || 
                    !formData.professor_id || 
                    !formData.disciplina_id || 
                    !formData.anoLetivoId ||
                    (isSuperior && (!formData.curso_id || !formData.semestre)) ||
                    (isSecundario && (!formData.classe_id || !formData.classeOuAno))
                  }
                >
                  Atribuir
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <Select 
            value={filterAnoLetivoId || "all"} 
            onValueChange={(v) => setFilterAnoLetivoId(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filtrar por Ano Letivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Anos Letivos</SelectItem>
              {anosLetivos.map((al: any) => (
                <SelectItem key={al.id} value={al.id}>
                  {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : errorPlanos ? (
            <div className="text-center py-8 text-red-500">
              Erro ao carregar atribuições: {errorPlanos instanceof Error ? errorPlanos.message : 'Erro desconhecido'}
            </div>
          ) : (
            <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Professor</TableHead>
              <TableHead>Disciplina</TableHead>
              <TableHead>{isSecundario ? 'Classe' : 'Curso'}</TableHead>
              <TableHead>Ano Letivo</TableHead>
              {isSuperior && <TableHead>Semestre</TableHead>}
              {isSecundario && <TableHead>Classe/Ano</TableHead>}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planosEnsino && Array.isArray(planosEnsino) && planosEnsino.length > 0 ? (
              planosEnsino.map((plano: PlanoEnsino) => (
              <TableRow key={plano.id}>
                <TableCell className="font-medium">
                  {plano.professor?.nomeCompleto ?? plano.professor?.nome_completo ?? plano.professor?.user?.nomeCompleto ?? "-"}
                </TableCell>
                <TableCell>{plano.disciplina?.nome}</TableCell>
                <TableCell>
                  {isSecundario ? (plano.classe?.nome || '-') : (plano.curso?.nome || '-')}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {plano.anoLetivo}
                  </Badge>
                </TableCell>
                {isSuperior && (
                  <TableCell>
                    {plano.semestre ? `${plano.semestre}º Semestre` : '-'}
                  </TableCell>
                )}
                {isSecundario && (
                  <TableCell>
                    {plano.classeOuAno || '-'}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (
                        confirm("Tem certeza que deseja remover esta atribuição?")
                      ) {
                        deleteMutation.mutate(plano.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
            ) : (
              <TableRow>
                <TableCell colSpan={isSecundario ? 6 : 5} className="text-center py-8">
                  {filterAnoLetivoId 
                    ? "Nenhuma atribuição encontrada para o ano letivo selecionado. Crie uma nova atribuição usando o botão acima."
                    : "Selecione um Ano Letivo para visualizar as atribuições."}
                </TableCell>
              </TableRow>
            )}
            </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
