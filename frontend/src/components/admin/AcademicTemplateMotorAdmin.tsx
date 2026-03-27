import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicTemplatesApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calculator, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const BUILTIN_ANGOLA_ID = 'angola-secundario-v1';

/**
 * Ensino secundário: escolher motor de mini-pauta (BD + builtin). Ensino superior: não mostrar.
 */
export function AcademicTemplateMotorAdmin() {
  const queryClient = useQueryClient();
  const [novoNome, setNovoNome] = useState('Modelo oficial Angola (registo interno)');
  /** Valor do select: `__builtin__` ou id do registo em `academic_templates`. */
  const [modeloRascunho, setModeloRascunho] = useState<string>('__builtin__');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['academic-templates'],
    queryFn: () => academicTemplatesApi.list(),
  });

  const mutCriar = useMutation({
    mutationFn: () =>
      academicTemplatesApi.create({ nome: novoNome.trim() || 'Registo motor', builtinId: BUILTIN_ANGOLA_ID }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-templates'] });
      toast({ title: 'Registo criado', description: 'Pode ativar este modelo na lista abaixo.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    },
  });

  const mutAtivar = useMutation({
    mutationFn: (templateId: string | null) => academicTemplatesApi.setActive(templateId),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['academic-templates'] });
      queryClient.invalidateQueries({ queryKey: ['preview-secundario-pauta-exames'] });
      queryClient.invalidateQueries({ queryKey: ['professor-grade-notas'] });
      toast({ title: 'Motor atualizado', description: r.message });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar</AlertTitle>
        <AlertDescription>Não foi possível carregar os modelos de cálculo.</AlertDescription>
      </Alert>
    );
  }

  if (!data.secundarioMotorDisponivel) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Motor de mini-pauta</AlertTitle>
        <AlertDescription>
          Esta secção aplica-se apenas a <strong>Ensino Secundário</strong>. Instituições de Ensino Superior usam
          o modelo de pauta configurado nos parâmetros (provas e exame).
        </AlertDescription>
      </Alert>
    );
  }

  const ativoId = data.activeAcademicTemplateId;

  return (
    <Card id="cfg-motor-mini-pauta">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5" />
          Motor de cálculo (mini-pauta secundário)
        </CardTitle>
        <CardDescription>
          Define qual modelo a instituição usa para médias trimestrais (MT1–MT3) e MFD. O professor vê o resultado
          alinhado com este motor. Não envie dados sensíveis: o servidor usa sempre a instituição do seu login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Situação atual</span>
            {ativoId ? (
              <Badge variant="secondary">Registo na base de dados</Badge>
            ) : (
              <Badge variant="outline">Padrão do sistema</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{data.activeSummary}</p>
        </div>

        <div className="space-y-3">
          <Label htmlFor="motor-ativo">Modelo ativo para a instituição</Label>
          <Select value={modeloRascunho} onValueChange={setModeloRascunho}>
            <SelectTrigger id="motor-ativo" className="max-w-xl">
              <SelectValue placeholder="Escolher…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__builtin__">Padrão do sistema (Angola — mini-pauta v1)</SelectItem>
              {data.templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome} (v{t.versao}) — {t.summary}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            “Padrão do sistema” não cria linha na BD: usa o motor incorporado. Escolher um registo da lista
            fixa a versão para auditoria e relatórios.
          </p>
          <Button
            type="button"
            disabled={
              mutAtivar.isPending ||
              (modeloRascunho === '__builtin__' && !ativoId) ||
              (modeloRascunho !== '__builtin__' && modeloRascunho === ativoId)
            }
            onClick={() => {
              mutAtivar.mutate(modeloRascunho === '__builtin__' ? null : modeloRascunho);
            }}
          >
            {mutAtivar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Aplicar modelo selecionado
          </Button>
        </div>

        <div className="border-t pt-6 space-y-3">
          <Label className="text-base font-medium">Criar novo registo (versionamento)</Label>
          <p className="text-sm text-muted-foreground">
            Em produção não edite registos antigos: crie um <strong>novo</strong> registo quando precisar de histórico
            claro. Por agora só está disponível o motor incorporado oficial Angola (mesma lógica do sistema).
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome descritivo do registo"
            />
            <Button type="button" variant="secondary" disabled={mutCriar.isPending} onClick={() => mutCriar.mutate()}>
              {mutCriar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar registo'}
            </Button>
          </div>
        </div>

        {data.templates.length > 0 ? (
          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Registos na instituição (mais recentes primeiro)</Label>
            <ul className="mt-2 space-y-2 text-sm">
              {data.templates.slice(0, 8).map((t) => (
                <li key={t.id} className="flex flex-wrap gap-2 items-center border rounded-md px-3 py-2">
                  <span className="font-medium">{t.nome}</span>
                  <Badge variant="outline">v{t.versao}</Badge>
                  {ativoId === t.id ? <Badge>Ativo</Badge> : null}
                  <span className="text-muted-foreground text-xs w-full sm:w-auto">{t.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Multi-tenant e regras</AlertTitle>
          <AlertDescription className="text-xs sm:text-sm">
            Apenas administradores da sua instituição alteram estes dados. O ID da instituição vem sempre do login —
            não é possível enviar outra instituição pelo formulário. Ensino Superior não utiliza este motor.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
