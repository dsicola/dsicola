import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { getApiErrorMessage } from "@/utils/apiErrors";
import { professorsApi, professoresApi, funcionariosApi, departamentosApi, cargosApi } from "@/services/api";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, User, Search, Eye, Pencil, FileText } from "lucide-react";
import { ExportButtons } from "@/components/common/ExportButtons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ViewProfessorDialog } from "./ViewProfessorDialog";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { FuncionarioFormDialog } from "@/components/rh/FuncionarioFormDialog";

interface Professor {
  id: string;
  userId?: string; // users.id - para delete, getComprovativo, handleEdit
  nome_completo: string;
  email: string;
  telefone: string | null;
  numero_identificacao: string | null;
  numero_identificacao_publica: string | null;
  avatar_url: string | null;
  genero: string | null;
  data_nascimento: string | null;
  cidade: string | null;
  pais: string | null;
  codigo_postal: string | null;
  tipo_sanguineo: string | null;
  qualificacao: string | null;
  data_admissao: string | null;
  data_saida: string | null;
  cargo_atual: string | null;
  codigo_funcionario: string | null;
  horas_trabalho: string | null;
  morada: string | null;
}

export function ProfessoresTab() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState("10");
  const [selectedProfessores, setSelectedProfessores] = useState<string[]>([]);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showCredentialsDialog, setShowCredentialsDialog] = useSafeDialog(false);
  const [viewingProfessor, setViewingProfessor] = useState<Professor | null>(null);
  const [showViewDialog, setShowViewDialog] = useSafeDialog(false);
  const [showFormDialog, setShowFormDialog] = useSafeDialog(false);
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(null);

  const queryClient = useQueryClient();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const { isSecundario } = useInstituicao();

  // Fetch professores - P0: Fonte DEVE ser GET /professores (value=professores.id), NUNCA /users
  const { data: professores = [], isLoading } = useQuery({
    queryKey: ["professores"],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      const arr = Array.isArray(data) ? data : (data?.data || []);
      return arr.map((p: any) => ({
        id: p.id,
        userId: p.userId,
        nome_completo: p.nomeCompleto || p.nome_completo,
        nomeCompleto: p.nomeCompleto || p.nome_completo,
        email: p.email,
        numero_identificacao: p.numero_identificacao ?? null,
        numero_identificacao_publica: p.numero_identificacao_publica ?? null,
        telefone: p.telefone ?? null,
      }));
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Delete mutation - usa userId (users.id) pois professoresApi.delete chama /users/:id
  const deleteMutation = useSafeMutation({
    mutationFn: async (userId: string) => {
      await professoresApi.delete(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professores"] });
      toast.success("Professor removido com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(getApiErrorMessage(error, 'Erro ao remover professor. Tente novamente.'));
    },
  });

  // Fetch departamentos e cargos para o formulário
  // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
  // O backend usa req.user.instituicaoId do JWT token automaticamente
  const { data: departamentos = [] } = useQuery({
    queryKey: ['departamentos'],
    queryFn: async () => {
      return departamentosApi.getAll({ ativo: true });
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ['cargos'],
    queryFn: async () => {
      return cargosApi.getAll({ ativo: true });
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const handleCreate = () => {
    setSelectedProfessor(null);
    setShowFormDialog(true);
  };

  const handleEdit = async (professor: Professor) => {
    try {
      const funcionarios = await funcionariosApi.getAll();
      const userId = (professor as any).userId ?? professor.id;
      const funcionarioRelacionado = Array.isArray(funcionarios) 
        ? funcionarios.find((f: any) => f.user_id === userId)
        : null;
      
      if (funcionarioRelacionado) {
        setSelectedProfessor(funcionarioRelacionado as any);
      } else {
        const userId = (professor as any).userId ?? professor.id;
        setSelectedProfessor({
          ...professor,
          user_id: userId,
        } as any);
      }
      setShowFormDialog(true);
    } catch (error) {
      console.error('Erro ao buscar funcionário relacionado:', error);
      toast.error('Erro ao carregar dados do professor');
    }
  };

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["professores"] });
    queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
    setShowFormDialog(false);
    setSelectedProfessor(null);
  };

  const handleView = (professor: Professor) => {
    setViewingProfessor(professor);
    setShowViewDialog(true);
  };

  const handlePrintComprovativo = async (professor: Professor) => {
    try {
      // Usar professorsApi.getComprovativo com professores.id (evita erro 400)
      const professorId = professor.id;
      if (!professorId) {
        toast.error("Erro: dados do professor incompletos. Recarregue a página e tente novamente.");
        return;
      }
      const comprovativo = await professorsApi.getComprovativo(professorId);
      if (!comprovativo?.professor) {
        toast.error("Dados do comprovativo incompletos. Tente novamente.");
        return;
      }

      // Open print window
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Por favor, permita pop-ups para imprimir o comprovativo");
        return;
      }

      const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      };

      const disciplinas = Array.isArray(comprovativo?.disciplinas) ? comprovativo.disciplinas : [];
      const disciplinasHtml = disciplinas.length > 0
        ? disciplinas.map((item: any) => `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; page-break-inside: avoid;">
            <div style="font-weight: bold; font-size: 13pt; margin-bottom: 8px;">
              ${item?.disciplina?.nome ?? 'Disciplina'}
              ${item?.disciplina?.curso ? `<span style="font-size: 11pt; font-weight: normal; color: #666; margin-left: 10px;">(${item.disciplina.curso.nome})</span>` : ''}
            </div>
            <div style="font-size: 11pt; margin-left: 15px;">
              ${item.anos && item.anos.length > 0 ? `<p style="margin: 4px 0;"><strong>Anos Letivos:</strong> ${item.anos.join(', ')}</p>` : ''}
              ${!isSecundario && item.semestres && item.semestres.length > 0 ? `<p style="margin: 4px 0;"><strong>Semestres:</strong> ${item.semestres.join(', ')}</p>` : ''}
              ${isSecundario && item.trimestres && item.trimestres.length > 0 ? `<p style="margin: 4px 0;"><strong>Trimestres:</strong> ${item.trimestres.join(', ')}</p>` : ''}
              ${item.turmas && item.turmas.length > 0 ? `<p style="margin: 4px 0;"><strong>Turmas:</strong> ${item.turmas.join(', ')}</p>` : ''}
            </div>
          </div>
        `).join('')
        : '<p>Nenhuma disciplina atribuída.</p>';

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Comprovativo de Atribuição de Ensino - ${comprovativo.professor.nome_completo || comprovativo.professor.nomeCompleto}</title>
          <style>
            @page { margin: 2cm; size: A4; }
            body { 
              font-family: 'Times New Roman', Times, serif; 
              font-size: 12pt; 
              line-height: 1.6;
              color: #000;
              padding: 0;
              margin: 0;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 2px solid #333;
            }
            .header h1 {
              font-size: 18pt;
              font-weight: bold;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .header p {
              font-size: 11pt;
              margin: 5px 0;
              color: #666;
            }
            .professor-info {
              margin-bottom: 30px;
            }
            .professor-info h2 {
              font-size: 14pt;
              font-weight: bold;
              margin-bottom: 15px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .info-row {
              margin-bottom: 8px;
              display: flex;
            }
            .info-label {
              font-weight: bold;
              min-width: 150px;
            }
            .info-value {
              flex: 1;
            }
            .disciplinas-section {
              margin-top: 30px;
              margin-bottom: 30px;
            }
            .disciplinas-section h2 {
              font-size: 14pt;
              font-weight: bold;
              margin-bottom: 15px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .summary {
              margin-top: 30px;
              padding: 15px;
              background-color: #f9f9f9;
              border: 1px solid #ddd;
              border-radius: 4px;
            }
            .summary h3 {
              font-size: 13pt;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .summary p {
              margin: 5px 0;
              font-size: 11pt;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              font-size: 10pt;
              color: #666;
            }
            .signature-section {
              margin-top: 50px;
              display: flex;
              justify-content: space-around;
              page-break-inside: avoid;
            }
            .signature-box {
              text-align: center;
              width: 200px;
            }
            .signature-line {
              border-top: 1px solid #333;
              margin-top: 50px;
              padding-top: 5px;
              font-size: 10pt;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Comprovativo de Atribuição de Ensino</h1>
            ${comprovativo.instituicao ? `
              <p style="font-size: 14pt; font-weight: bold; margin-top: 15px;">${comprovativo.instituicao.nome}</p>
              ${comprovativo.instituicao.endereco ? `<p>${comprovativo.instituicao.endereco}</p>` : ''}
              ${(comprovativo.instituicao.telefone || comprovativo.instituicao.email) ? `
                <p>
                  ${comprovativo.instituicao.telefone ? `Tel: ${comprovativo.instituicao.telefone}` : ''}
                  ${comprovativo.instituicao.telefone && comprovativo.instituicao.email ? ' | ' : ''}
                  ${comprovativo.instituicao.email ? `Email: ${comprovativo.instituicao.email}` : ''}
                </p>
              ` : ''}
            ` : ''}
          </div>

          <div class="professor-info">
            <h2>Dados do Professor</h2>
            <div class="info-row">
              <span class="info-label">Nome Completo:</span>
              <span class="info-value">${comprovativo.professor.nome_completo || comprovativo.professor.nomeCompleto}</span>
            </div>
            ${comprovativo.professor.numero_identificacao ? `
              <div class="info-row">
                <span class="info-label">Número de Identificação:</span>
                <span class="info-value">${comprovativo.professor.numero_identificacao}</span>
              </div>
            ` : ''}
            ${comprovativo.professor.email ? `
              <div class="info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">${comprovativo.professor.email}</span>
              </div>
            ` : ''}
            ${comprovativo.professor.telefone ? `
              <div class="info-row">
                <span class="info-label">Telefone:</span>
                <span class="info-value">${comprovativo.professor.telefone}</span>
              </div>
            ` : ''}
            ${comprovativo.professor.grau_academico ? `
              <div class="info-row">
                <span class="info-label">Grau Académico:</span>
                <span class="info-value">${comprovativo.professor.grau_academico}</span>
              </div>
            ` : ''}
          </div>

          ${disciplinas.length > 0 ? `
            <div class="disciplinas-section">
              <h2>Disciplinas e Turmas Atribuídas</h2>
              ${disciplinasHtml}
            </div>
          ` : ''}

          <div class="summary">
            <h3>Resumo</h3>
            ${comprovativo.anos && comprovativo.anos.length > 0 ? `
              <p><strong>Anos Letivos:</strong> ${comprovativo.anos.join(', ')}</p>
            ` : ''}
            ${!isSecundario && comprovativo.semestres && comprovativo.semestres.length > 0 ? `
              <p><strong>Semestres:</strong> ${comprovativo.semestres.join(', ')}</p>
            ` : ''}
            ${isSecundario && comprovativo.trimestres && comprovativo.trimestres.length > 0 ? `
              <p><strong>Trimestres:</strong> ${comprovativo.trimestres.join(', ')}</p>
            ` : ''}
            ${disciplinas.length > 0 ? `
              <p><strong>Total de Disciplinas:</strong> ${disciplinas.length}</p>
            ` : ''}
          </div>

          <div class="footer">
            <p>Data de Emissão: ${formatDate(comprovativo.data_emissao || new Date().toISOString())}</p>
            <p style="margin-top: 20px; font-size: 9pt;">
              Este documento é gerado automaticamente pelo sistema ${comprovativo.instituicao?.nome || 'DSICOLA'}.
            </p>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">Assinatura do Professor</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">Assinatura da Coordenação</div>
            </div>
          </div>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load, then print
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error: any) {
      console.error('Erro ao gerar comprovativo:', error);
      const msg = error?.response?.data?.message ?? error?.message ?? 'Erro desconhecido';
      toast.error('Erro ao gerar comprovativo: ' + msg);
    }
  };

  const filteredProfessores = professores?.filter((p: Professor) =>
    p.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.numero_identificacao_publica?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.numero_identificacao?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const exportData = filteredProfessores?.map((p: Professor) => [
    p.numero_identificacao_publica || '-',
    p.nome_completo,
    p.email,
    p.telefone || '-',
    p.numero_identificacao || '-',
  ]) || [];

  return (
    <>
      {/* Dialog para mostrar credenciais geradas */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-green-600">Professor Cadastrado com Sucesso!</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                ✉️ Um email com as credenciais foi enviado automaticamente para o professor.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Você também pode copiar as credenciais abaixo para comunicar diretamente:
            </p>
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="font-mono text-sm">{createdCredentials?.email}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Senha</Label>
                <p className="font-mono text-sm font-bold">{createdCredentials?.password}</p>
              </div>
            </div>
            <Button 
              className="w-full" 
              onClick={() => {
                if (createdCredentials) {
                  navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nSenha: ${createdCredentials.password}`);
                  toast.success("Credenciais copiadas!");
                }
              }}
            >
              Copiar Credenciais
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Professores
              </CardTitle>
              <CardDescription>
                Gerencie os professores da instituição
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <ExportButtons
                titulo="Relatório de Professores"
                colunas={['Código', 'Nome', 'Email', 'Telefone', 'BI']}
                dados={exportData}
                pdfLabel="Imprimir a lista de professores PDF"
                excelLabel="Imprimir a lista de professores em Excel"
              />
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Professor
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : filteredProfessores?.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">
                Nenhum professor encontrado
              </h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {searchTerm
                  ? "Tente ajustar sua busca"
                  : "Nenhum professor encontrado"}
              </p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedProfessores.length === filteredProfessores?.length && filteredProfessores?.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProfessores(filteredProfessores?.map((p: Professor) => p.id) || []);
                            } else {
                              setSelectedProfessores([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="font-semibold">Código</TableHead>
                      <TableHead className="font-semibold">Nome</TableHead>
                      <TableHead className="font-semibold">Email</TableHead>
                      <TableHead className="font-semibold">BI</TableHead>
                      <TableHead className="font-semibold">Telefone</TableHead>
                      <TableHead className="font-semibold text-center">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfessores?.slice(0, parseInt(entriesPerPage)).map((professor: Professor) => (
                      <TableRow key={professor.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Checkbox
                            checked={selectedProfessores.includes(professor.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProfessores([...selectedProfessores, professor.id]);
                              } else {
                                setSelectedProfessores(selectedProfessores.filter(id => id !== professor.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-primary">
                          {professor.numero_identificacao_publica || '-'}
                        </TableCell>
                        <TableCell>{professor.nome_completo || professor.nomeCompleto || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{professor.email}</TableCell>
                        <TableCell>{professor.numero_identificacao || '-'}</TableCell>
                        <TableCell>{professor.telefone || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => handleView(professor)}
                              title="Visualizar"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => handleEdit(professor)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-600 hover:bg-blue-50"
                              onClick={() => handlePrintComprovativo(professor)}
                              title="Imprimir Comprovativo"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (confirm("Tem certeza que deseja remover este professor?")) {
                                  const userId = (professor as any).userId ?? professor.id;
                                  deleteMutation.mutate(userId);
                                }
                              }}
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Footer with pagination info */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Mostrar</span>
                  <Select value={entriesPerPage} onValueChange={setEntriesPerPage}>
                    <SelectTrigger className="w-16 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>registros</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Mostrando 1 a {Math.min(parseInt(entriesPerPage), filteredProfessores?.length || 0)} de {filteredProfessores?.length || 0} registros
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View Professor Dialog */}
      <ViewProfessorDialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        professor={viewingProfessor}
      />

      <FuncionarioFormDialog
        open={showFormDialog}
        onOpenChange={(open) => {
          setShowFormDialog(open);
          if (!open) setSelectedProfessor(null);
        }}
        funcionario={selectedProfessor}
        departamentos={departamentos}
        cargos={cargos}
        mode="PROFESSOR"
        onSuccess={handleFormSuccess}
      />
    </>
  );
}