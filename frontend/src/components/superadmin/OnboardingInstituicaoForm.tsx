import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Building2,
  GraduationCap,
  School,
  User, 
  Mail, 
  Lock, 
  Globe, 
  Phone, 
  MapPin, 
  Image,
  Rocket,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Copy,
  ExternalLink,
  CreditCard
} from 'lucide-react';
import { onboardingApi, leadsApi, planosApi } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSafeMutation } from '@/hooks/useSafeMutation';

interface OnboardingResult {
  success: boolean;
  instituicao?: {
    id: string;
    nome: string;
    subdominio: string;
    access_url: string;
  };
  admin?: {
    id: string;
    nome: string;
    email: string;
  };
  email_sent?: boolean;
  email_error?: string;
}

const getLeadField = (lead: any, field: string) => {
  const camel = field.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());
  return (lead as any)[field] ?? (lead as any)[camel] ?? '';
};

export const OnboardingInstituicaoForm = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromLeadId = searchParams.get('fromLead');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [iniciarTeste, setIniciarTeste] = useState(true);
  const [diasTeste, setDiasTeste] = useState('14');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loadingLead, setLoadingLead] = useState(!!fromLeadId);
  
  const [formData, setFormData] = useState({
    // Institution
    nome_instituicao: '',
    subdominio: '',
    tipo_academico: '' as 'SECUNDARIO' | 'SUPERIOR' | '',
    plano_id: '',
    logo_url: '',
    email_contato: '',
    telefone: '',
    endereco: '',
    // Admin
    admin_nome: '',
    admin_email: '',
    admin_password: '',
  });

  // Buscar planos filtrados por tipo acadêmico (obrigatório para criar assinatura)
  const { data: planos = [] } = useQuery({
    queryKey: ['planos-onboarding', formData.tipo_academico],
    queryFn: async () => {
      if (!formData.tipo_academico) return [];
      const data = await planosApi.getAll({ ativo: true, tipoAcademico: formData.tipo_academico });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!formData.tipo_academico,
  });

  // Preencher formulário a partir do lead convertido
  useEffect(() => {
    if (!fromLeadId) return;
    let cancelled = false;
    setLoadingLead(true);
    leadsApi
      .getById(fromLeadId)
      .then((lead: any) => {
        if (cancelled) return;
        const nomeInst = getLeadField(lead, 'nome_instituicao') || getLeadField(lead, 'nomeInstituicao') || '';
        const subdomBase = nomeInst
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'instituicao';
        const tipo = (getLeadField(lead, 'tipo_instituicao') || getLeadField(lead, 'tipoInstituicao') || '').toUpperCase();
        const tipoAcademico = tipo.includes('SUPERIOR') ? 'SUPERIOR' as const : tipo.includes('SECUNDARIO') || tipo.includes('SECUND') ? 'SECUNDARIO' as const : '';
        setFormData({
          nome_instituicao: nomeInst,
          subdominio: subdomBase,
          tipo_academico: tipoAcademico,
          logo_url: '',
          email_contato: getLeadField(lead, 'email') || '',
          telefone: getLeadField(lead, 'telefone') || '',
          endereco: getLeadField(lead, 'cidade') ? `Cidade: ${getLeadField(lead, 'cidade')}` : '',
          admin_nome: getLeadField(lead, 'nome_responsavel') || getLeadField(lead, 'nomeContato') || '',
          admin_email: getLeadField(lead, 'email') || '',
          admin_password: '',
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingLead(false);
      });
    return () => { cancelled = true; };
  }, [fromLeadId]);

  // Create mutation - protegida contra unmount
  const createInstituicaoMutation = useSafeMutation({
    mutationFn: async (data: {
      nomeInstituicao: string;
      subdominio: string;
      tipoAcademico: 'SECUNDARIO' | 'SUPERIOR';
      planoId: string;
      emailContato?: string;
      telefone?: string;
      endereco?: string;
      logoUrl?: string;
      emailAdmin: string;
      senhaAdmin: string;
      nomeAdmin: string;
    }) => {
      return await onboardingApi.criarInstituicao(data);
    },
    onSuccess: (data) => {
      setLoading(false);
      // Backend returns { message, instituicao, admin } on success
      if (data.instituicao && data.admin) {
        // Transform backend response to match OnboardingResult interface
        const result: OnboardingResult = {
          success: true,
          instituicao: {
            id: data.instituicao.id,
            nome: data.instituicao.nome,
            subdominio: data.instituicao.subdominio,
            access_url: `https://${data.instituicao.subdominio}.dsicola.com`,
          },
          admin: {
            id: data.admin.id,
            nome: data.admin.nomeCompleto,
            email: data.admin.email,
          },
          email_sent: data.email_sent,
          email_error: data.email_error,
        };
        
        setResult(result);
        toast.success('Instituição cadastrada com sucesso!');
        setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('fromLead'); return n; });
        
        // Reset form
        setFormData({
          nome_instituicao: '',
          subdominio: '',
          tipo_academico: '',
          plano_id: '',
          logo_url: '',
          email_contato: '',
          telefone: '',
          endereco: '',
          admin_nome: '',
          admin_email: '',
          admin_password: '',
        });
      } else {
        // If response doesn't have expected structure, it's an error
        throw new Error(data.message || 'Erro desconhecido');
      }
    },
    onError: (error: any) => {
      setLoading(false);
      console.error('Onboarding error:', error);
      
      // Extract error message from axios error response
      let errorMessage = 'Erro ao cadastrar instituição';
      
      if (error.response?.data) {
        // Server returned an error response - backend uses 'message' property
        errorMessage = error.response.data.message || 
                      error.response.data.error || 
                      errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setErrors({});

    // Validação de campos obrigatórios
    const newErrors: { [key: string]: string } = {};

    if (!formData.tipo_academico) {
      newErrors.tipo_academico = 'Por favor, selecione o tipo de instituição';
    }

    if (!formData.plano_id || formData.plano_id === '_empty_') {
      newErrors.plano_id = 'Por favor, selecione o plano';
    }

    if (formData.admin_password.length < 6) {
      newErrors.admin_password = 'A senha deve ter no mínimo 6 caracteres';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    // Usar mutation segura
    createInstituicaoMutation.mutate({
      nomeInstituicao: formData.nome_instituicao,
      subdominio: formData.subdominio,
      tipoAcademico: formData.tipo_academico as 'SECUNDARIO' | 'SUPERIOR',
      planoId: formData.plano_id,
      emailContato: formData.email_contato || undefined,
      telefone: formData.telefone || undefined,
      endereco: formData.endereco || undefined,
      logoUrl: formData.logo_url || undefined,
      emailAdmin: formData.admin_email,
      senhaAdmin: formData.admin_password,
      nomeAdmin: formData.admin_nome,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para área de transferência!');
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, admin_password: password }));
  };

  if (result) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-green-800">Onboarding Concluído!</CardTitle>
              <CardDescription className="text-green-600">
                A instituição foi cadastrada com sucesso
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Instituição</Label>
              <p className="font-semibold text-lg">{result.instituicao?.nome}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">URL de Acesso</Label>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-1.5 rounded-md border text-sm font-mono">
                  {result.instituicao?.access_url}
                </code>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => copyToClipboard(result.instituicao?.access_url || '')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => window.open(result.instituicao?.access_url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Dados do Administrador</Label>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center gap-2 bg-white p-3 rounded-md border">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{result.admin?.nome}</span>
              </div>
              <div className="flex items-center gap-2 bg-white p-3 rounded-md border">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{result.admin?.email}</span>
              </div>
            </div>
          </div>

          {result.email_sent ? (
            <div className="flex items-center gap-2 text-green-600 bg-green-100 p-3 rounded-md">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Email de boas-vindas enviado com sucesso!</span>
            </div>
          ) : result.email_error ? (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-100 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Email não enviado: {result.email_error}</span>
            </div>
          ) : null}

          <Button 
            onClick={() => {
              setResult(null);
              setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('fromLead'); return n; });
            }} 
            className="w-full"
            variant="outline"
          >
            Cadastrar Nova Instituição
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Onboarding de Nova Instituição</CardTitle>
            <CardDescription>
              {fromLeadId
                ? 'Formulário preenchido a partir do lead convertido. Revise e complete os campos.'
                : 'Cadastre uma nova instituição e crie o administrador em um único passo'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Institution Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Dados da Instituição</h3>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome_instituicao">Nome da Instituição *</Label>
                <Input
                  id="nome_instituicao"
                  value={formData.nome_instituicao}
                  onChange={(e) => setFormData({ ...formData, nome_instituicao: e.target.value })}
                  placeholder="Ex: Universidade LUAS"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subdominio">Subdomínio *</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="subdominio"
                      value={formData.subdominio}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        subdominio: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') 
                      })}
                      placeholder="uniluas"
                      className="pl-10"
                      required
                    />
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.dsicola.com</span>
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo_academico">Tipo de Instituição *</Label>
              <Select
                value={formData.tipo_academico}
                onValueChange={(value) => {
                  setFormData({ 
                    ...formData, 
                    tipo_academico: value as 'SECUNDARIO' | 'SUPERIOR',
                    plano_id: '', // Limpar plano ao mudar tipo (planos são diferentes por tipo)
                  });
                  if (errors.tipo_academico) setErrors({ ...errors, tipo_academico: '' });
                  if (errors.plano_id) setErrors({ ...errors, plano_id: '' });
                }}
                required
              >
                <SelectTrigger className={errors.tipo_academico ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecione o tipo de instituição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SECUNDARIO">Ensino Secundário</SelectItem>
                  <SelectItem value="SUPERIOR">Ensino Superior</SelectItem>
                </SelectContent>
              </Select>
              {errors.tipo_academico && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.tipo_academico}
                </p>
              )}
              {!errors.tipo_academico && (
                <p className="text-xs text-muted-foreground">
                  Selecione se a instituição oferece Ensino Secundário ou Ensino Superior.
                </p>
              )}
            </div>

            {formData.tipo_academico && (
              <div className="space-y-2">
                <Label htmlFor="plano_id">Plano *</Label>
                <Select
                  value={formData.plano_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, plano_id: value });
                    if (errors.plano_id) setErrors({ ...errors, plano_id: '' });
                  }}
                  required
                >
                  <SelectTrigger className={errors.plano_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {planos.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                        {(p.limite_alunos ?? p.limiteAlunos) ? ` (até ${p.limite_alunos ?? p.limiteAlunos} alunos)` : ' (ilimitado)'}
                      </SelectItem>
                    ))}
                    {planos.length === 0 && (
                      <SelectItem value="_empty_" disabled>
                        Nenhum plano disponível. Cadastre planos em Planos primeiro.
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.plano_id && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.plano_id}
                  </p>
                )}
                {!errors.plano_id && (
                  <p className="text-xs text-muted-foreground">
                    O plano define os limites de alunos, professores e cursos da instituição.
                  </p>
                )}
              </div>
            )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email_contato">Email de Contato</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email_contato"
                    type="email"
                    value={formData.email_contato}
                    onChange={(e) => setFormData({ ...formData, email_contato: e.target.value })}
                    placeholder="contato@instituicao.com"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="+244 xxx xxx xxx"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    placeholder="Endereço da instituição"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo_url">URL do Logo</Label>
                <div className="relative">
                  <Image className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="logo_url"
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://..."
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Admin Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Dados do Administrador</h3>
              <Badge variant="secondary" className="ml-2">Acesso ADMIN</Badge>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admin_nome">Nome Completo *</Label>
                <Input
                  id="admin_nome"
                  value={formData.admin_nome}
                  onChange={(e) => setFormData({ ...formData, admin_nome: e.target.value })}
                  placeholder="Nome do administrador"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin_email"
                    type="email"
                    value={formData.admin_email}
                    onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                    placeholder="admin@instituicao.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin_password">Senha *</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={generatePassword}
                >
                  Gerar senha
                </Button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin_password"
                  type="text"
                  value={formData.admin_password}
                  onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="pl-10 font-mono"
                  minLength={6}
                  required
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="iniciar_teste" 
                checked={iniciarTeste}
                onCheckedChange={(checked) => setIniciarTeste(checked as boolean)}
              />
              <Label htmlFor="iniciar_teste" className="text-sm font-normal cursor-pointer">
                Iniciar período de teste gratuito
              </Label>
            </div>
            
            {iniciarTeste && (
              <div className="ml-6 flex items-center gap-2">
                <Label htmlFor="dias_teste" className="text-sm">Dias de teste:</Label>
                <Select value={diasTeste} onValueChange={setDiasTeste}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="14">14 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="send_email" 
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked as boolean)}
              />
              <Label htmlFor="send_email" className="text-sm font-normal cursor-pointer">
                Enviar email de boas-vindas ao administrador
              </Label>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading || loadingLead}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando Instituição...
              </>
            ) : loadingLead ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando dados do lead...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Iniciar Onboarding
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
