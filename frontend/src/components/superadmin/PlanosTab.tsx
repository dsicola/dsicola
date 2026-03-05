import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { planosApi, configuracoesLandingApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Users, GraduationCap, BookOpen, Check, X, Infinity, ExternalLink, Globe, Info, Trash2 } from 'lucide-react';
import { CHAVE_PLANOS_LANDING } from '@/constants/planosLanding';

interface Plano {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_academico: 'SECUNDARIO' | 'SUPERIOR' | null;
  preco_mensal: number;
  valor_anual: number | null;
  valor_semestral: number | null;
  preco_secundario: number;
  preco_universitario: number;
  limite_alunos: number | null;
  limite_professores: number | null;
  limite_cursos: number | null;
  multi_campus?: boolean;
  funcionalidades: unknown;
  ativo: boolean;
}

const funcionalidadesDisponiveis = [
  { key: 'gestao_alunos', label: 'Gestão de Alunos' },
  { key: 'gestao_professores', label: 'Gestão de Professores' },
  { key: 'notas', label: 'Notas e Avaliações' },
  { key: 'frequencia', label: 'Controle de Frequência' },
  { key: 'financeiro', label: 'Gestão Financeira' },
  { key: 'documentos', label: 'Emissão de Documentos' },
  { key: 'comunicados', label: 'Comunicados' },
  { key: 'alojamentos', label: 'Gestão de Alojamentos' },
  { key: 'analytics', label: 'Analytics Avançado' },
  { key: 'api_access', label: 'Acesso à API' },
];

/** Retorna Set de nomes e Set de ids dos planos configurados na landing */
function parsePlanosLandingConfig(raw: string | null | undefined): { nomes: Set<string>; ids: Set<string> } {
  const nomes = new Set<string>();
  const ids = new Set<string>();
  if (!raw?.trim()) return { nomes, ids };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const p of parsed) {
        if (p?.nome) nomes.add(String(p.nome).trim());
        if (p?.id) ids.add(String(p.id));
      }
    }
  } catch (_) {}
  return { nomes, ids };
}

export function PlanosTab() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planosLandingRaw, setPlanosLandingRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useSafeDialog(false);
  const [planoToDelete, setPlanoToDelete] = useState<Plano | null>(null);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const { toast } = useToast();

  const deletePlanoMutation = useSafeMutation({
    mutationFn: (id: string) => planosApi.delete(id),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setPlanoToDelete(null);
      fetchPlanos();
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      toast({ title: 'Plano excluído', description: 'O plano foi excluído com sucesso.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao excluir',
        description: error?.response?.data?.message || error?.message || 'Não foi possível excluir o plano.',
        variant: 'destructive',
      });
    },
  });

  const planosLandingIds = useMemo(() => parsePlanosLandingConfig(planosLandingRaw), [planosLandingRaw]);
  const isPlanoUsadoNaLanding = (plano: Plano) =>
    planosLandingIds.nomes.has(plano.nome?.trim() || '') || planosLandingIds.ids.has(plano.id);

  const planosDaLanding = useMemo(() => planos.filter((p) => isPlanoUsadoNaLanding(p)), [planos, planosLandingIds]);
  const outrosPlanos = useMemo(() => planos.filter((p) => !isPlanoUsadoNaLanding(p)), [planos, planosLandingIds]);

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    preco_secundario: '',
    preco_universitario: '',
    limite_alunos: '',
    limite_professores: '',
    limite_cursos: '',
    multi_campus: false,
    funcionalidades: [] as string[],
    ativo: true,
  });

  const fetchPlanos = async () => {
    setLoading(true);
    try {
      const [data, configRes] = await Promise.all([
        planosApi.getAll(),
        configuracoesLandingApi.getByChave(CHAVE_PLANOS_LANDING).catch(() => null),
      ]);
      const sorted = (data || []).sort((a: any, b: any) => (a.preco_mensal || 0) - (b.preco_mensal || 0));
      setPlanos(sorted);
      const planosVal = configRes?.valor ?? null;
      setPlanosLandingRaw(typeof planosVal === 'string' ? planosVal : planosVal ? JSON.stringify(planosVal) : null);
    } catch (error) {
      toast({ title: 'Erro ao carregar planos', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlanos();
  }, []);

  const handleOpenDialog = (plano?: Plano) => {
    if (plano) {
      setEditingPlano(plano);
      const funcionalidades = Array.isArray(plano.funcionalidades) ? plano.funcionalidades as string[] : [];
      setFormData({
        nome: plano.nome,
        descricao: plano.descricao || '',
        preco_secundario: String(plano.preco_secundario || 0),
        preco_universitario: String(plano.preco_universitario || 0),
        limite_alunos: plano.limite_alunos ? String(plano.limite_alunos) : '',
        limite_professores: plano.limite_professores ? String(plano.limite_professores) : '',
        limite_cursos: plano.limite_cursos ? String(plano.limite_cursos) : '',
        multi_campus: Boolean((plano as any).multi_campus),
        funcionalidades: funcionalidades,
        ativo: plano.ativo,
      });
    } else {
      setEditingPlano(null);
      setFormData({
        nome: '',
        descricao: '',
        preco_secundario: '',
        preco_universitario: '',
        limite_alunos: '',
        limite_professores: '',
        limite_cursos: '',
        multi_campus: false,
        funcionalidades: [],
        ativo: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    // Validações no frontend
    if (!formData.nome || formData.nome.trim().length === 0) {
      toast({ 
        title: 'Erro de validação', 
        description: 'Nome do plano é obrigatório',
        variant: 'destructive' 
      });
      return;
    }

    // Validar e converter preços
    if (!formData.preco_secundario || formData.preco_secundario.trim() === '') {
      toast({ 
        title: 'Erro de validação', 
        description: 'Preço Ensino Secundário é obrigatório',
        variant: 'destructive' 
      });
      return;
    }

    if (!formData.preco_universitario || formData.preco_universitario.trim() === '') {
      toast({ 
        title: 'Erro de validação', 
        description: 'Preço Universidade é obrigatório',
        variant: 'destructive' 
      });
      return;
    }

    const precoSecundario = parseFloat(formData.preco_secundario.trim());
    const precoUniversitario = parseFloat(formData.preco_universitario.trim());

    if (isNaN(precoSecundario) || precoSecundario <= 0) {
      toast({ 
        title: 'Erro de validação', 
        description: 'Preço Ensino Secundário deve ser um número maior que zero',
        variant: 'destructive' 
      });
      return;
    }

    if (isNaN(precoUniversitario) || precoUniversitario <= 0) {
      toast({ 
        title: 'Erro de validação', 
        description: 'Preço Universidade deve ser um número maior que zero',
        variant: 'destructive' 
      });
      return;
    }

    // Validar limites (se preenchidos, devem ser números válidos)
    let limiteAlunos: number | null = null;
    if (formData.limite_alunos && formData.limite_alunos.trim() !== '') {
      const parsed = parseInt(formData.limite_alunos.trim());
      if (isNaN(parsed) || parsed < 0) {
        toast({ 
          title: 'Erro de validação', 
          description: 'Limite de alunos deve ser um número válido maior ou igual a zero',
          variant: 'destructive' 
        });
        return;
      }
      limiteAlunos = parsed;
    }

    let limiteProfessores: number | null = null;
    if (formData.limite_professores && formData.limite_professores.trim() !== '') {
      const parsed = parseInt(formData.limite_professores.trim());
      if (isNaN(parsed) || parsed < 0) {
        toast({ 
          title: 'Erro de validação', 
          description: 'Limite de professores deve ser um número válido maior ou igual a zero',
          variant: 'destructive' 
        });
        return;
      }
      limiteProfessores = parsed;
    }

    let limiteCursos: number | null = null;
    if (formData.limite_cursos && formData.limite_cursos.trim() !== '') {
      const parsed = parseInt(formData.limite_cursos.trim());
      if (isNaN(parsed) || parsed < 0) {
        toast({ 
          title: 'Erro de validação', 
          description: 'Limite de cursos deve ser um número válido maior ou igual a zero',
          variant: 'destructive' 
        });
        return;
      }
      limiteCursos = parsed;
    }

    const payload = {
      nome: formData.nome.trim(),
      descricao: formData.descricao.trim() || null,
      precoMensal: precoSecundario, // Usa o secundário como base
      precoSecundario: precoSecundario,
      precoUniversitario: precoUniversitario,
      limiteAlunos: limiteAlunos,
      limiteProfessores: limiteProfessores,
      limiteCursos: limiteCursos,
      multiCampus: formData.multi_campus,
      funcionalidades: formData.funcionalidades.length > 0 ? formData.funcionalidades : null,
      ativo: formData.ativo,
    };

    try {
      if (editingPlano) {
        await planosApi.update(editingPlano.id, payload);
        toast({ 
          title: 'Plano atualizado!', 
          description: `O plano "${formData.nome.trim()}" foi atualizado com sucesso.`
        });
      } else {
        await planosApi.create(payload);
        toast({ 
          title: 'Plano criado!', 
          description: `O plano "${formData.nome.trim()}" foi criado com sucesso. Agora você pode criar assinaturas usando este plano.`
        });
      }
      setDialogOpen(false);
      fetchPlanos();
    } catch (error: any) {
      console.error('Erro ao salvar plano:', error);
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Erro ao salvar plano';
      const errorDetails = error?.response?.data?.details;
      
      toast({ 
        title: 'Erro ao salvar plano', 
        description: errorDetails 
          ? `${errorMessage}\n\nDetalhes: ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)}`
          : errorMessage,
        variant: 'destructive',
        duration: 5000
      });
    }
  };

  const toggleFuncionalidade = (key: string) => {
    setFormData(prev => ({
      ...prev,
      funcionalidades: prev.funcionalidades.includes(key)
        ? prev.funcionalidades.filter(f => f !== key)
        : [...prev.funcionalidades, key],
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
  };

  if (loading) return <div className="p-4">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Planos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Planos usados no onboarding e nas assinaturas. Definem preços e limites (alunos, professores).
          </p>
          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-muted/50 border border-border/50 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Os 3 planos exibidos na página de vendas (/vendas) são configurados na aba <strong>Landing</strong>. Ao salvar lá, eles são sincronizados aqui. Planos criados nesta aba são usados em assinaturas e onboarding, mas não aparecem na landing até serem adicionados na configuração da Landing.
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSearchParams({ tab: 'landing' })}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Personalizar na Landing
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlano ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
            </DialogHeader>
            {editingPlano && isPlanoUsadoNaLanding(editingPlano) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm">
                <Globe className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <div>
                  <p className="font-medium">Este plano é exibido na página de vendas (/vendas).</p>
                  <p className="text-muted-foreground mt-1">
                    Para alterar tagline, textos de marketing e preços diferenciados (Secundário/Universitário), edite na aba{' '}
                    <Button variant="link" className="h-auto p-0 text-primary" onClick={() => { setDialogOpen(false); setSearchParams({ tab: 'landing' }); }}>
                      Landing
                    </Button>.
                    Alterações aqui atualizam limites e funcionalidades usados em assinaturas.
                  </p>
                </div>
              </div>
            )}
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Plano *</Label>
                <Input
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Profissional, Enterprise, Básico..."
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Este nome será usado ao criar assinaturas DEMO ou PAGA
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço Ensino Secundário (AOA) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.preco_secundario}
                    onChange={e => setFormData({ ...formData, preco_secundario: e.target.value })}
                    placeholder="100000"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Preço mensal para Ensino Médio/Secundário
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Preço Universidade (AOA) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.preco_universitario}
                    onChange={e => setFormData({ ...formData, preco_universitario: e.target.value })}
                    placeholder="150000"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Preço mensal para Ensino Superior/Universitário
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descrição do plano..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Limite de Alunos</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.limite_alunos}
                    onChange={e => setFormData({ ...formData, limite_alunos: e.target.value })}
                    placeholder="Deixe vazio para ilimitado"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio = ilimitado
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Limite de Professores</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.limite_professores}
                    onChange={e => setFormData({ ...formData, limite_professores: e.target.value })}
                    placeholder="Deixe vazio para ilimitado"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio = ilimitado
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Limite de Cursos</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.limite_cursos}
                    onChange={e => setFormData({ ...formData, limite_cursos: e.target.value })}
                    placeholder="Deixe vazio para ilimitado"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio = ilimitado
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.multi_campus}
                  onCheckedChange={(checked) => setFormData({ ...formData, multi_campus: checked })}
                />
                <Label>Multi-campus</Label>
                <span className="text-xs text-muted-foreground">
                  Permite múltiplos campus na instituição
                </span>
              </div>

              <div className="space-y-2">
                <Label>Funcionalidades Incluídas</Label>
                <div className="grid grid-cols-2 gap-2">
                  {funcionalidadesDisponiveis.map(func => (
                    <div
                      key={func.key}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                        formData.funcionalidades.includes(func.key)
                          ? 'bg-primary/10 border-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                      onClick={() => toggleFuncionalidade(func.key)}
                    >
                      {formData.funcionalidades.includes(func.key) ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">{func.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={checked => setFormData({ ...formData, ativo: checked })}
                />
                <Label>Plano Ativo</Label>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleSubmit} 
                  className="flex-1"
                  disabled={!formData.nome.trim() || !formData.preco_secundario || !formData.preco_universitario}
                >
                  {editingPlano ? 'Atualizar' : 'Cadastrar'}
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
              {(!formData.nome.trim() || !formData.preco_secundario || !formData.preco_universitario) && (
                <p className="text-xs text-muted-foreground text-center">
                  Preencha todos os campos obrigatórios (*) para continuar
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {planosDaLanding.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Planos exibidos na Landing (/vendas)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {planosDaLanding.map(plano => (
              <Card key={plano.id} className={!plano.ativo ? 'opacity-60' : 'border-primary/30'}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        {plano.nome}
                        <Badge variant="default" className="text-xs">Usado na Landing</Badge>
                        {(plano as any).multi_campus && <Badge variant="outline" className="text-xs">Multi-campus</Badge>}
                        {!plano.ativo && <Badge variant="secondary">Inativo</Badge>}
                      </CardTitle>
                      <CardDescription>{plano.descricao}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(plano)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setPlanoToDelete(plano); setDeleteDialogOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Ensino Secundário:</div>
                <div className="text-lg font-bold text-primary">
                  {formatCurrency(plano.preco_secundario || 0)}<span className="text-xs font-normal">/mês</span>
                </div>
                <div className="text-sm text-muted-foreground">Universidade:</div>
                <div className="text-lg font-bold text-primary">
                  {formatCurrency(plano.preco_universitario || 0)}<span className="text-xs font-normal">/mês</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {plano.limite_alunos ?? <Infinity className="h-4 w-4" />} alunos
                </div>
                <div className="flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  {plano.limite_professores ?? <Infinity className="h-4 w-4" />} prof.
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {plano.limite_cursos ?? <Infinity className="h-4 w-4" />} cursos
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">Funcionalidades:</span>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(plano.funcionalidades) ? plano.funcionalidades as string[] : []).map(func => (
                    <Badge key={func} variant="outline" className="text-xs">
                      {funcionalidadesDisponiveis.find(f => f.key === func)?.label || func}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
          </div>
        </div>
      )}

      {outrosPlanos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Outros planos (assinaturas e onboarding)</h3>
          <p className="text-sm text-muted-foreground">
            Planos criados nesta aba. Usados ao criar assinaturas e no onboarding de instituições.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {outrosPlanos.map(plano => (
              <Card key={plano.id} className={!plano.ativo ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        {plano.nome}
                        {(plano as any).multi_campus && <Badge variant="outline" className="text-xs">Multi-campus</Badge>}
                        {!plano.ativo && <Badge variant="secondary">Inativo</Badge>}
                      </CardTitle>
                      <CardDescription>{plano.descricao}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(plano)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setPlanoToDelete(plano); setDeleteDialogOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Ensino Secundário:</div>
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(plano.preco_secundario || 0)}<span className="text-xs font-normal">/mês</span>
                    </div>
                    <div className="text-sm text-muted-foreground">Universidade:</div>
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(plano.preco_universitario || 0)}<span className="text-xs font-normal">/mês</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {plano.limite_alunos ?? <Infinity className="h-4 w-4" />} alunos
                    </div>
                    <div className="flex items-center gap-1">
                      <GraduationCap className="h-4 w-4" />
                      {plano.limite_professores ?? <Infinity className="h-4 w-4" />} prof.
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {plano.limite_cursos ?? <Infinity className="h-4 w-4" />} cursos
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Funcionalidades:</span>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(plano.funcionalidades) ? plano.funcionalidades as string[] : []).map(func => (
                        <Badge key={func} variant="outline" className="text-xs">
                          {funcionalidadesDisponiveis.find(f => f.key === func)?.label || func}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dialog de confirmação de exclusão de plano */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano <strong>{planoToDelete?.nome}</strong>?
              Esta ação não pode ser desfeita. Planos com assinaturas ativas não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => planoToDelete && deletePlanoMutation.mutate(planoToDelete.id)}
              disabled={deletePlanoMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlanoMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {planos.length === 0 && (
        <p className="text-muted-foreground text-center py-8">Nenhum plano cadastrado. Crie um novo plano ou configure os planos na aba Landing.</p>
      )}
    </div>
  );
}
