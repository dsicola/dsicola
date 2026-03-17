/**
 * TaxasServicosTab - Aba independente para configurar todos os serviços cobráveis
 *
 * Regras:
 * - Multi-tenant: apenas dados da instituição do usuário
 * - Isolamento tipo: Ensino Superior vê APENAS Cursos; Ensino Secundário vê APENAS Classes
 * - Nenhuma informação de Superior aparece em Secundário e vice-versa
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import {
  configuracoesInstituicaoApi,
  cursosApi,
  classesApi,
} from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Receipt, GraduationCap, School, FileText, Award, Badge, Save, Pencil } from 'lucide-react';

const formatCurrency = (v: number | null | undefined) =>
  v != null && v > 0
    ? new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(v)
    : '—';

interface CursoServico {
  id: string;
  codigo: string;
  nome: string;
  taxaMatricula?: number | null;
  valorMensalidade?: number;
  valorBata?: number | null;
  exigeBata?: boolean;
  valorPasse?: number | null;
  exigePasse?: boolean;
  valorEmissaoDeclaracao?: number | null;
  valorEmissaoCertificado?: number | null;
}

interface ClasseServico {
  id: string;
  codigo: string;
  nome: string;
  taxaMatricula?: number | null;
  valorMensalidade?: number;
  valorBata?: number | null;
  exigeBata?: boolean;
  valorPasse?: number | null;
  exigePasse?: boolean;
  valorEmissaoDeclaracao?: number | null;
  valorEmissaoCertificado?: number | null;
}

export const TaxasServicosTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { config, instituicaoId, tipoAcademico, isSuperior, isSecundario } = useInstituicao();
  const [editDialogOpen, setEditDialogOpen] = useSafeDialog(false);
  const [editingItem, setEditingItem] = useState<
    (CursoServico & { tipo: 'curso' }) | (ClasseServico & { tipo: 'classe' }) | null
  >(null);
  const [formValores, setFormValores] = useState({
    taxaMatricula: '' as string | number,
    valorMensalidade: '' as string | number,
    valorBata: '' as string | number,
    exigeBata: false,
    valorPasse: '' as string | number,
    exigePasse: false,
    valorEmissaoDeclaracao: '' as string | number,
    valorEmissaoCertificado: '' as string | number,
  });

  // Valores padrão institucionais
  const valorEmissaoDecl = config?.valorEmissaoDeclaracao ?? config?.valor_emissao_declaracao;
  const valorEmissaoCert = config?.valorEmissaoCertificado ?? config?.valor_emissao_certificado;
  const valorPassePadrao = config?.valorPasse ?? config?.valor_passe;

  const updateConfigMutation = useMutation({
    mutationFn: (data: {
      valorEmissaoDeclaracao?: number | null;
      valorEmissaoCertificado?: number | null;
      valorPasse?: number | null;
    }) => configuracoesInstituicaoApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracao'] });
      queryClient.invalidateQueries({ queryKey: ['instituicao'] });
      toast.success('Valores padrão atualizados');
    },
  });

  // Ensino Superior: buscar CURSOS (nunca Classes)
  const { data: cursos = [], isLoading: loadingCursos } = useQuery({
    queryKey: ['cursos-servicos', instituicaoId],
    queryFn: () => cursosApi.getAll({ excludeTipo: 'classe' }),
    enabled: !!instituicaoId && isSuperior,
  });

  // Ensino Secundário: buscar CLASSES (nunca Cursos para este fim)
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes-servicos', instituicaoId],
    queryFn: () => classesApi.getAll({ ativo: true }),
    enabled: !!instituicaoId && isSecundario,
  });

  const updateCursoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      cursosApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cursos-servicos'] });
      queryClient.invalidateQueries({ queryKey: ['cursos'] });
      setEditDialogOpen(false);
      setEditingItem(null);
      toast.success('Curso atualizado');
    },
  });

  const updateClasseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      classesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes-servicos'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setEditDialogOpen(false);
      setEditingItem(null);
      toast.success('Classe atualizada');
    },
  });

  const openEdit = (item: CursoServico | ClasseServico, tipo: 'curso' | 'classe') => {
    setEditingItem({ ...item, tipo });
    setFormValores({
      taxaMatricula: item.taxaMatricula ?? '',
      valorMensalidade: item.valorMensalidade ?? '',
      valorBata: item.valorBata ?? '',
      exigeBata: item.exigeBata ?? false,
      valorPasse: item.valorPasse ?? '',
      exigePasse: item.exigePasse ?? false,
      valorEmissaoDeclaracao: item.valorEmissaoDeclaracao ?? '',
      valorEmissaoCertificado: item.valorEmissaoCertificado ?? '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const payload: Record<string, unknown> = {
      taxaMatricula: formValores.taxaMatricula === '' ? null : Number(formValores.taxaMatricula),
      valorMensalidade:
        formValores.valorMensalidade === ''
          ? editingItem.tipo === 'curso'
            ? 0
            : undefined
          : Number(formValores.valorMensalidade),
      valorBata: formValores.valorBata === '' ? null : Number(formValores.valorBata),
      exigeBata: formValores.exigeBata,
      valorPasse: formValores.valorPasse === '' ? null : Number(formValores.valorPasse),
      exigePasse: formValores.exigePasse,
      valorEmissaoDeclaracao:
        formValores.valorEmissaoDeclaracao === ''
          ? null
          : Number(formValores.valorEmissaoDeclaracao),
      valorEmissaoCertificado:
        formValores.valorEmissaoCertificado === ''
          ? null
          : Number(formValores.valorEmissaoCertificado),
    };
    if (editingItem.tipo === 'curso') {
      if (payload.valorMensalidade === undefined && isSuperior) {
        payload.valorMensalidade = formValores.valorMensalidade
          ? Number(formValores.valorMensalidade)
          : 0;
      }
      updateCursoMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      updateClasseMutation.mutate({ id: editingItem.id, data: payload });
    }
  };

  if (!tipoAcademico && !isSuperior && !isSecundario) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            Carregue a configuração da instituição para visualizar as taxas e serviços.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Valores padrão institucionais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Valores padrão institucionais
          </CardTitle>
          <CardDescription>
            Valores usados quando o curso/classe não define valor específico. Aplicam-se a emissão
            de declarações, certificados e passe estudantil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Emissão de declaração (por documento)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 500"
                defaultValue={
                  valorEmissaoDecl != null ? String(valorEmissaoDecl) : ''
                }
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== '')
                    updateConfigMutation.mutate({
                      valorEmissaoDeclaracao: parseFloat(v) >= 0 ? parseFloat(v) : null,
                    });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Emissão de certificado (por documento)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 5000"
                defaultValue={
                  valorEmissaoCert != null ? String(valorEmissaoCert) : ''
                }
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== '')
                    updateConfigMutation.mutate({
                      valorEmissaoCertificado: parseFloat(v) >= 0 ? parseFloat(v) : null,
                    });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Passe estudantil (padrão institucional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 2000"
                defaultValue={
                  valorPassePadrao != null ? String(valorPassePadrao) : ''
                }
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== '')
                    updateConfigMutation.mutate({
                      valorPasse: parseFloat(v) >= 0 ? parseFloat(v) : null,
                    });
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ensino Superior: APENAS Cursos */}
      {isSuperior && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Serviços por curso (Ensino Superior)
            </CardTitle>
            <CardDescription>
              Configuração de taxas e itens cobráveis por curso. Nenhuma informação de Ensino
              Secundário é exibida aqui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCursos ? (
              <p className="text-muted-foreground text-center py-8">Carregando cursos...</p>
            ) : (cursos as CursoServico[]).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum curso cadastrado. Cadastre cursos em Acadêmica → Cursos.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curso</TableHead>
                      <TableHead>Taxa matrícula</TableHead>
                      <TableHead>Mensalidade</TableHead>
                      <TableHead>Bata</TableHead>
                      <TableHead>Passe</TableHead>
                      <TableHead>Emissão declaração</TableHead>
                      <TableHead>Emissão certificado</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(cursos as CursoServico[]).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.codigo} – {c.nome}
                        </TableCell>
                        <TableCell>{formatCurrency(c.taxaMatricula)}</TableCell>
                        <TableCell>{formatCurrency(c.valorMensalidade)}</TableCell>
                        <TableCell>
                          {c.exigeBata ? (
                            <Badge variant="secondary">
                              {formatCurrency(c.valorBata)}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {c.exigePasse ? (
                            <Badge variant="secondary">
                              {formatCurrency(c.valorPasse)} ou padrão
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{formatCurrency(c.valorEmissaoDeclaracao)}</TableCell>
                        <TableCell>{formatCurrency(c.valorEmissaoCertificado)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c, 'curso')}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ensino Secundário: APENAS Classes */}
      {isSecundario && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" />
              Serviços por classe (Ensino Secundário)
            </CardTitle>
            <CardDescription>
              Configuração de taxas e itens cobráveis por classe (10ª, 11ª, 12ª). Nenhuma
              informação de Ensino Superior é exibida aqui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingClasses ? (
              <p className="text-muted-foreground text-center py-8">Carregando classes...</p>
            ) : (classes as ClasseServico[]).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma classe cadastrada. Cadastre classes em Acadêmica → Classes.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Classe</TableHead>
                      <TableHead>Taxa matrícula</TableHead>
                      <TableHead>Mensalidade</TableHead>
                      <TableHead>Bata</TableHead>
                      <TableHead>Passe</TableHead>
                      <TableHead>Emissão declaração</TableHead>
                      <TableHead>Emissão certificado</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(classes as ClasseServico[]).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.codigo} – {c.nome}
                        </TableCell>
                        <TableCell>{formatCurrency(c.taxaMatricula)}</TableCell>
                        <TableCell>{formatCurrency(c.valorMensalidade)}</TableCell>
                        <TableCell>
                          {c.exigeBata ? (
                            <Badge variant="secondary">
                              {formatCurrency(c.valorBata)}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {c.exigePasse ? (
                            <Badge variant="secondary">
                              {formatCurrency(c.valorPasse)} ou padrão
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{formatCurrency(c.valorEmissaoDeclaracao)}</TableCell>
                        <TableCell>{formatCurrency(c.valorEmissaoCertificado)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c, 'classe')}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Editar serviços – {editingItem?.tipo === 'curso' ? 'Curso' : 'Classe'}
            </DialogTitle>
            <DialogDescription>
              {editingItem?.nome}. Valores em branco usam o padrão institucional.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taxa de matrícula</Label>
                <Input
                  type="number"
                  min="0"
                  value={formValores.taxaMatricula}
                  onChange={(e) =>
                    setFormValores((p) => ({ ...p, taxaMatricula: e.target.value }))
                  }
                  placeholder="Padrão"
                />
              </div>
              <div className="space-y-2">
                <Label>Mensalidade</Label>
                <Input
                  type="number"
                  min="0"
                  value={formValores.valorMensalidade}
                  onChange={(e) =>
                    setFormValores((p) => ({ ...p, valorMensalidade: e.target.value }))
                  }
                  placeholder="Padrão"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="exigeBata"
                  checked={formValores.exigeBata}
                  onCheckedChange={(c) =>
                    setFormValores((p) => ({ ...p, exigeBata: c === true }))
                  }
                />
                <Label htmlFor="exigeBata">Exige bata</Label>
              </div>
              <Input
                type="number"
                min="0"
                placeholder="Valor"
                className="w-24"
                value={formValores.valorBata}
                onChange={(e) =>
                  setFormValores((p) => ({ ...p, valorBata: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="exigePasse"
                  checked={formValores.exigePasse}
                  onCheckedChange={(c) =>
                    setFormValores((p) => ({ ...p, exigePasse: c === true }))
                  }
                />
                <Label htmlFor="exigePasse">Exige passe</Label>
              </div>
              <Input
                type="number"
                min="0"
                placeholder="Valor"
                className="w-24"
                value={formValores.valorPasse}
                onChange={(e) =>
                  setFormValores((p) => ({ ...p, valorPasse: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Emissão declaração</Label>
                <Input
                  type="number"
                  min="0"
                  value={formValores.valorEmissaoDeclaracao}
                  onChange={(e) =>
                    setFormValores((p) => ({
                      ...p,
                      valorEmissaoDeclaracao: e.target.value,
                    }))
                  }
                  placeholder="Padrão"
                />
              </div>
              <div className="space-y-2">
                <Label>Emissão certificado</Label>
                <Input
                  type="number"
                  min="0"
                  value={formValores.valorEmissaoCertificado}
                  onChange={(e) =>
                    setFormValores((p) => ({
                      ...p,
                      valorEmissaoCertificado: e.target.value,
                    }))
                  }
                  placeholder="Padrão"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
