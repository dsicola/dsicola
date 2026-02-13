import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { matriculasAnuaisApi, userRolesApi, profilesApi, cursosApi, classesApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { AnoLetivoAtivoGuard } from "@/components/academico/AnoLetivoAtivoGuard";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Calendar, Search, AlertCircle, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { SmartSearch } from "@/components/common/SmartSearch";
import { useAlunoSearch } from "@/hooks/useSmartSearch";

interface MatriculaAnual {
  id: string;
  alunoId: string;
  instituicaoId: string;
  anoLetivo: number;
  anoLetivoId?: string; // FK para AnoLetivo - retornado pelo backend
  nivelEnsino: 'SECUNDARIO' | 'SUPERIOR';
  classeOuAnoCurso: string;
  cursoId: string | null;
  status: 'ATIVA' | 'CONCLUIDA' | 'CANCELADA';
  createdAt: string;
  aluno?: {
    id: string;
    nomeCompleto: string;
    email: string;
    numeroIdentificacaoPublica?: string | null;
  };
  curso?: {
    id: string;
    nome: string;
    codigo: string;
  } | null;
  instituicao?: {
    id: string;
    nome: string;
    tipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null;
  };
  _count?: {
    disciplinas: number;
  };
}

interface Aluno {
  id: string;
  nome_completo: string;
  email?: string;
  numero_identificacao_publica?: string | null;
}

interface Curso {
  id: string;
  nome: string;
  codigo: string;
}

export function MatriculasAnuaisTab() {
  const { config, isSecundario } = useInstituicao();
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  const { searchAlunos } = useAlunoSearch();
  
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [editingMatricula, setEditingMatricula] = useState<MatriculaAnual | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAlunoId, setSelectedAlunoId] = useState<string | null>(null);
  const [filterAno, setFilterAno] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const isSecundarioValue = Boolean(isSecundario);

  const [formData, setFormData] = useState({
    aluno_id: "",
    anoLetivo: new Date().getFullYear().toString(),
    anoLetivoId: "", // OBRIGATÓRIO: ID do ano letivo selecionado
    nivelEnsino: (isSecundarioValue ? 'SECUNDARIO' : 'SUPERIOR') as 'SECUNDARIO' | 'SUPERIOR',
    classeOuAnoCurso: "",
    curso_id: "",
  });

  const queryClient = useQueryClient();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();

  // Buscar anos letivos disponíveis (carregar somente anos criados no sistema)
  const { data: anosLetivos = [], isLoading: isLoadingAnosLetivos } = useQuery({
    queryKey: ["anos-letivos-matriculas", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Atualizar formData quando ano letivo ativo estiver disponível
  // REGRA: Ano Letivo sempre automático (apenas ano ativo, nunca editável)
  useEffect(() => {
    if (anoLetivoAtivo) {
      setFormData((prev) => ({ 
        ...prev, 
        anoLetivo: anoLetivoAtivo.ano.toString(),
        anoLetivoId: anoLetivoAtivo.id 
      }));
    }
  }, [anoLetivoAtivo]);

  const { data: matriculasAnuais, isLoading } = useQuery({
    queryKey: ["matriculas-anuais", instituicaoId],
    queryFn: async () => {
      try {
        const data = await matriculasAnuaisApi.getAll({});
        return Array.isArray(data) ? data as MatriculaAnual[] : [];
      } catch (error) {
        console.error("Erro ao buscar matrículas anuais:", error);
        return [];
      }
    },
  });

  const { data: alunos } = useQuery({
    queryKey: ["alunos-select-matricula-anual", instituicaoId],
    queryFn: async () => {
      if (!instituicaoId) return [];
      
      try {
        const alunoRoles = await userRolesApi.getByRole("ALUNO", instituicaoId);
        if (!alunoRoles || alunoRoles.length === 0) return [];

        const alunoIds = alunoRoles.map((r: any) => r.user_id || r.userId).filter((id: string) => id);
        if (alunoIds.length === 0) return [];
        
        const profiles = await profilesApi.getByIds(alunoIds);
        if (!profiles || !Array.isArray(profiles)) return [];
        
        if (shouldFilter && instituicaoId) {
          return profiles.filter((p: any) => p.instituicao_id === instituicaoId) as Aluno[];
        }
        return profiles as Aluno[];
      } catch (error) {
        console.error("Erro ao buscar alunos:", error);
        return [];
      }
    },
    enabled: !!instituicaoId,
  });

  const { data: cursos } = useQuery({
    queryKey: ["cursos-matricula-anual", instituicaoId],
    queryFn: async () => {
      try {
        const data = await cursosApi.getAll();
        return Array.isArray(data) ? data as Curso[] : [];
      } catch (error) {
        console.error("Erro ao buscar cursos:", error);
        return [];
      }
    },
    enabled: !isSecundarioValue, // Só carregar cursos para ensino superior
  });

  // Buscar classes (apenas para Ensino Secundário) - dados reais do banco
  const { data: classes = [] } = useQuery({
    queryKey: ["classes-matricula-anual", instituicaoId],
    queryFn: async () => {
      try {
        if (isSecundarioValue) {
          const data = await classesApi.getAll({ ativo: true });
          return Array.isArray(data) ? data : [];
        }
        return [];
      } catch (error) {
        console.error("Erro ao buscar classes:", error);
        return [];
      }
    },
    enabled: isSecundarioValue && !!instituicaoId, // Só carregar classes para ensino secundário
  });

  const createMutation = useSafeMutation({
    mutationFn: async (data: typeof formData) => {
      // REGRA MESTRA: Priorizar anoLetivoId (obrigatório)
      if (!data.anoLetivoId) {
        throw new Error('Ano Letivo é obrigatório. Selecione um ano letivo válido.');
      }
      
      // Buscar ano letivo selecionado para obter o ano numérico (se necessário)
      const anoLetivoSelecionado = anosLetivos.find((al: any) => al.id === data.anoLetivoId);
      const anoLetivoNumero = anoLetivoSelecionado?.ano || (data.anoLetivo ? Number(data.anoLetivo) : new Date().getFullYear());
      
      await matriculasAnuaisApi.create({
        alunoId: data.aluno_id,
        anoLetivo: anoLetivoNumero, // Para compatibilidade
        anoLetivoId: data.anoLetivoId, // OBRIGATÓRIO: ID do ano letivo
        nivelEnsino: data.nivelEnsino,
        classeOuAnoCurso: data.classeOuAnoCurso,
        cursoId: data.curso_id || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas-anuais"] });
      toast.success("Matrícula anual criada com sucesso!");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao criar matrícula anual";
      toast.error(errorMessage);
    },
  });

  const updateMutation = useSafeMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData & { status?: string }> }) => {
      // VALIDAÇÃO PADRÃO SIGA/SIGAE: Curso é OBRIGATÓRIO no Ensino Superior
      // Não permitir remover curso no Ensino Superior
      if (!isSecundarioValue && data.curso_id !== undefined) {
        if (!data.curso_id || data.curso_id.trim() === '') {
          throw new Error("Curso é obrigatório para matrícula anual no Ensino Superior. Não é permitido remover o curso.");
        }
      }
      
      const updateData: any = {};
      if (data.status) updateData.status = data.status;
      if (data.classeOuAnoCurso) updateData.classeOuAnoCurso = data.classeOuAnoCurso;
      if (data.curso_id !== undefined) {
        // No Ensino Superior, não permitir null ou vazio
        if (!isSecundarioValue) {
          if (!data.curso_id || data.curso_id.trim() === '') {
            throw new Error("Curso é obrigatório para matrícula anual no Ensino Superior. Não é permitido remover o curso.");
          }
          updateData.cursoId = data.curso_id; // Sempre definir (nunca null no Superior)
        } else {
          // Ensino Secundário: cursoId é opcional
          updateData.cursoId = data.curso_id || null;
        }
      }
      
      await matriculasAnuaisApi.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas-anuais"] });
      toast.success("Matrícula anual atualizada com sucesso!");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao atualizar matrícula anual";
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await matriculasAnuaisApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas-anuais"] });
      toast.success("Matrícula anual excluída com sucesso!");
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao excluir matrícula anual";
      toast.error(errorMessage);
    },
  });

  const resetForm = () => {
    setFormData({
      aluno_id: "",
      anoLetivo: anoLetivoAtivo?.ano.toString() || new Date().getFullYear().toString(),
      anoLetivoId: anoLetivoAtivo?.id || "", // Reset para ano letivo ativo ou vazio
      nivelEnsino: (isSecundarioValue ? 'SECUNDARIO' : 'SUPERIOR') as 'SECUNDARIO' | 'SUPERIOR',
      classeOuAnoCurso: "",
      curso_id: "",
    });
    setEditingMatricula(null);
    setSelectedAlunoId(null);
  };

  // Resetar formulário quando o diálogo for aberto para criar nova matrícula
  useEffect(() => {
    if (isDialogOpen && !editingMatricula) {
      setFormData({
        aluno_id: "",
        anoLetivo: anoLetivoAtivo?.ano.toString() || new Date().getFullYear().toString(),
        anoLetivoId: anoLetivoAtivo?.id || "", // Reset para ano letivo ativo
        nivelEnsino: (isSecundarioValue ? 'SECUNDARIO' : 'SUPERIOR') as 'SECUNDARIO' | 'SUPERIOR',
        classeOuAnoCurso: "",
        curso_id: "",
      });
      setSelectedAlunoId(null);
    }
  }, [isDialogOpen, editingMatricula, isSecundarioValue, anoLetivoAtivo]);

  const handleEdit = (matricula: MatriculaAnual) => {
    setEditingMatricula(matricula);
    // Buscar anoLetivoId da matrícula ou dos anos letivos disponíveis
    const anoLetivoId = matricula.anoLetivoId || 
      anosLetivos.find((al: any) => al.ano === matricula.anoLetivo)?.id || 
      "";
    
    setFormData({
      aluno_id: matricula.alunoId,
      anoLetivo: matricula.anoLetivo.toString(),
      anoLetivoId: anoLetivoId, // OBRIGATÓRIO: ID do ano letivo
      nivelEnsino: matricula.nivelEnsino,
      classeOuAnoCurso: matricula.classeOuAnoCurso,
      curso_id: matricula.cursoId || "",
    });
    setSelectedAlunoId(matricula.alunoId);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.aluno_id) {
      toast.error("Selecione um estudante");
      return;
    }

    if (!formData.classeOuAnoCurso) {
      toast.error(`Informe a ${isSecundarioValue ? 'classe' : 'ano do curso'}`);
      return;
    }

    // VALIDAÇÃO PADRÃO SIGA/SIGAE: Curso é OBRIGATÓRIO no Ensino Superior
    if (!isSecundarioValue && !formData.curso_id) {
      toast.error("Curso é obrigatório para matrícula anual no Ensino Superior");
      return;
    }

    // Validar ano letivo ativo (obrigatório)
    if (!anoLetivoAtivo || !formData.anoLetivoId) {
      toast.error("Ano letivo é obrigatório. Não há ano letivo ativo no momento.");
      return;
    }

    if (editingMatricula) {
      updateMutation.mutate({ id: editingMatricula.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredMatriculas = matriculasAnuais?.filter((m) => {
    // Se um aluno foi selecionado via SmartSearch, mostrar apenas ele
    if (selectedAlunoId) {
      if (m.alunoId !== selectedAlunoId) return false;
    } else if (searchTerm) {
      // Se há termo de busca (busca manual), aplicar filtro
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        m.aluno?.nomeCompleto?.toLowerCase().includes(searchLower) ||
        m.aluno?.email?.toLowerCase().includes(searchLower) ||
        m.classeOuAnoCurso?.toLowerCase().includes(searchLower) ||
        false;
      if (!matchesSearch) return false;
    }
    
    const matchesAno = filterAno === "all" || m.anoLetivo?.toString() === filterAno;
    const matchesStatus = filterStatus === "all" || m.status === filterStatus;
    return matchesAno && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ATIVA":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativa</Badge>;
      case "CONCLUIDA":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Concluída</Badge>;
      case "CANCELADA":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Filter alunos - agora usando SmartSearch, não precisa filtrar manualmente
  const filteredAlunos = alunos || [];

  // Opções de classe/ano baseadas no nível de ensino - PADRÃO SIGA/SIGAE
  // ENSINO_SUPERIOR: 1º, 2º, 3º, 4º, 5º, 6º Ano
  // ENSINO_SECUNDARIO: Classes cadastradas no banco (sem padrão fictício)
  const classeOuAnoOptions = useMemo(() => {
    if (isSecundarioValue) {
      // Ensino Secundário: SOMENTE classes cadastradas no banco (sem padrão fictício)
      if (classes && classes.length > 0) {
        return classes.map((classe: any) => ({
          value: classe.nome || classe.id,
          label: classe.nome || classe.codigo || classe.id,
        }));
      }
      // Se não houver classes cadastradas, retornar vazio (não usar padrão fictício)
      return [];
    } else {
      // Ensino Superior: anos do curso de 1º a 6º Ano
      return [
        { value: "1º Ano", label: "1º Ano" },
        { value: "2º Ano", label: "2º Ano" },
        { value: "3º Ano", label: "3º Ano" },
        { value: "4º Ano", label: "4º Ano" },
        { value: "5º Ano", label: "5º Ano" },
        { value: "6º Ano", label: "6º Ano" },
      ];
    }
  }, [isSecundarioValue, classes]);

  return (
    <AnoLetivoAtivoGuard showAlert={true} disableChildren={false}>
      <Card>
        <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <div className="w-full sm:w-96">
              <SmartSearch
                placeholder="Digite o nome do estudante, email, BI ou número de identificação..."
                value={selectedAlunoId ? alunos?.find((a: Aluno) => a.id === selectedAlunoId)?.nome_completo || "" : searchTerm}
                selectedId={selectedAlunoId || undefined}
                onSelect={(item) => {
                  if (item) {
                    setSelectedAlunoId(item.id);
                    setSearchTerm(""); // Limpar busca manual
                  } else {
                    setSelectedAlunoId(null);
                    setSearchTerm(""); // Limpar busca
                  }
                }}
                onClear={() => {
                  setSelectedAlunoId(null);
                  setSearchTerm("");
                }}
                searchFn={searchAlunos}
                emptyMessage="Nenhum estudante encontrado"
                minSearchLength={2}
              />
            </div>
            <Select value={filterAno} onValueChange={setFilterAno}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Ano Letivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Anos</SelectItem>
                {anosLetivos.map((al: any) => (
                  <SelectItem key={al.id} value={al.ano.toString()}>
                    {al.ano} {al.status === 'ATIVO' && '🟢'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ATIVA">Ativa</SelectItem>
                <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Matrícula Anual
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {editingMatricula ? "Editar Matrícula Anual" : "Nova Matrícula Anual"}
                </DialogTitle>
                <DialogDescription>
                  {editingMatricula 
                    ? "Atualize as informações da matrícula anual" 
                    : "Registre a matrícula anual do aluno no ano letivo"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Aluno *</Label>
                  <SmartSearch
                    placeholder="Digite o nome do estudante, email, BI ou número de identificação..."
                    value={formData.aluno_id ? alunos?.find((a: Aluno) => a.id === formData.aluno_id)?.nome_completo || "" : ""}
                    selectedId={formData.aluno_id || undefined}
                    onSelect={(item) => {
                      if (item) {
                        setFormData({ ...formData, aluno_id: item.id });
                      } else {
                        setFormData({ ...formData, aluno_id: "" });
                      }
                    }}
                    searchFn={searchAlunos}
                    emptyMessage="Nenhum estudante encontrado"
                    disabled={!!editingMatricula}
                    required
                  />
                  {/* Manter Select como fallback para compatibilidade */}
                  <Select 
                    value={formData.aluno_id} 
                    onValueChange={(v) => setFormData({ ...formData, aluno_id: v })}
                    disabled={!!editingMatricula}
                    className="mt-2"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ou selecione da lista" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {filteredAlunos?.map((aluno) => (
                        <SelectItem key={aluno.id} value={aluno.id}>
                          {aluno.nome_completo} {aluno.numero_identificacao_publica && `(${aluno.numero_identificacao_publica})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Ano Letivo: sempre automático, apenas ano ativo, nunca editável */}
                  <div className="space-y-2">
                    <Label>Ano Letivo</Label>
                    <Input
                      value={anoLetivoAtivo ? `${anoLetivoAtivo.ano} ${anoLetivoAtivo.status === 'ATIVO' ? '🟢' : ''}` : 'Nenhum ano letivo ativo'}
                      disabled
                      className="bg-muted"
                    />
                    {anoLetivoAtivo && (
                      <p className="text-xs text-muted-foreground">
                        Ano letivo selecionado automaticamente
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{isSecundarioValue ? 'Classe' : 'Ano do Curso'} *</Label>
                    {/* Usar Select para ambos os tipos de ensino - padrão SIGA/SIGAE */}
                    <Select 
                      value={formData.classeOuAnoCurso} 
                      onValueChange={(v) => setFormData({ ...formData, classeOuAnoCurso: v })}
                      required
                      disabled={classeOuAnoOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Selecione ${isSecundarioValue ? 'a classe' : 'o ano do curso'}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {classeOuAnoOptions.length > 0 ? (
                          classeOuAnoOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="empty" disabled>
                            {isSecundarioValue ? "Nenhuma classe disponível" : "Nenhuma opção disponível"}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {isSecundarioValue && classes.length === 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Nenhuma classe cadastrada. Cadastre classes em <strong>Gestão Acadêmica → Classes</strong> para poder criar matrículas.
                        </AlertDescription>
                      </Alert>
                    )}
                    {!isSecundarioValue && classeOuAnoOptions.length === 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Nenhuma opção de ano do curso disponível.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>

                {!isSecundarioValue && (
                  <div className="space-y-2">
                    <Label>Curso *</Label>
                    <Select 
                      value={formData.curso_id || ""} 
                      onValueChange={(v) => setFormData({ ...formData, curso_id: v })}
                      required
                    >
                      <SelectTrigger className={!formData.curso_id ? "border-red-500" : ""}>
                        <SelectValue placeholder="Selecione o curso" />
                      </SelectTrigger>
                      <SelectContent>
                        {cursos && cursos.length > 0 ? (
                          cursos.map((curso) => (
                            <SelectItem key={curso.id} value={curso.id}>
                              {curso.nome} ({curso.codigo})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="empty" disabled>
                            Nenhum curso disponível
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {cursos && cursos.length === 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Nenhum curso cadastrado. Cadastre cursos em <strong>Gestão Acadêmica → Cursos</strong> para poder criar matrículas no Ensino Superior.
                        </AlertDescription>
                      </Alert>
                    )}
                    {!formData.curso_id && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Curso é obrigatório para matrícula anual no Ensino Superior
                      </p>
                    )}
                  </div>
                )}

                {editingMatricula && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={editingMatricula.status} 
                      onValueChange={(v) => {
                        if (editingMatricula) {
                          updateMutation.mutate({ 
                            id: editingMatricula.id, 
                            data: { status: v as 'ATIVA' | 'CONCLUIDA' | 'CANCELADA' } 
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ATIVA">Ativa</SelectItem>
                        <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                        <SelectItem value="CANCELADA">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => {
                    resetForm();
                    setIsDialogOpen(false);
                  }}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={
                      createMutation.isPending || 
                      updateMutation.isPending ||
                      !formData.aluno_id ||
                      !formData.classeOuAnoCurso ||
                      !formData.anoLetivoId ||
                      (!isSecundarioValue && !formData.curso_id) // Curso obrigatório no Ensino Superior
                    }
                  >
                    {editingMatricula ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredMatriculas && filteredMatriculas.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Ano Letivo</TableHead>
                  <TableHead>{isSecundarioValue ? 'Classe' : 'Ano'}</TableHead>
                  {!isSecundarioValue && <TableHead>Curso</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Disciplinas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatriculas.map((matricula) => (
                  <TableRow key={matricula.id}>
                    <TableCell className="font-medium">
                      {matricula.aluno?.nomeCompleto || "N/A"}
                    </TableCell>
                    <TableCell>{matricula.anoLetivo}</TableCell>
                    <TableCell>{matricula.classeOuAnoCurso}</TableCell>
                    {!isSecundarioValue && (
                      <TableCell>
                        {matricula.curso?.nome ? (
                          <span>{matricula.curso.nome}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              Curso obrigatório não definido
                            </span>
                          </div>
                        )}
                      </TableCell>
                    )}
                    <TableCell>{getStatusBadge(matricula.status)}</TableCell>
                    <TableCell>
                      {matricula._count?.disciplinas || 0} disciplina(s)
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(matricula)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja excluir esta matrícula anual?")) {
                              deleteMutation.mutate(matricula.id);
                            }
                          }}
                          disabled={matricula._count?.disciplinas && matricula._count.disciplinas > 0}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma matrícula anual encontrada</h3>
            <p className="text-muted-foreground">
              {searchTerm || filterAno !== "all" || filterStatus !== "all"
                ? "Tente ajustar os filtros de busca"
                : "Clique em 'Nova Matrícula Anual' para adicionar"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
    </AnoLetivoAtivoGuard>
  );
}

