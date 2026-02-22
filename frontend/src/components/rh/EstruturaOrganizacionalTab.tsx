import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle 
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  Briefcase, 
  Users, 
  AlertCircle, 
  XCircle, 
  Eye,
  ChevronRight
} from 'lucide-react';
import { estruturaOrganizacionalApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useAuth } from '@/contexts/AuthContext';
import { isStaffWithFallback } from '@/utils/roleLabels';
import { Skeleton } from '@/components/ui/skeleton';

interface Funcionario {
  id: string;
  nome_completo: string;
  email: string;
  telefone?: string;
  status: string;
  data_admissao?: string;
  foto_url?: string;
}

interface Cargo {
  id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  salario_base?: number;
  quantidade_funcionarios: number;
  funcionarios: Funcionario[];
  aviso?: string;
}

interface Departamento {
  id: string;
  nome: string;
  descricao?: string;
  total_cargos: number;
  total_funcionarios: number;
  cargos: Cargo[];
  funcionarios_sem_cargo: Funcionario[];
}

interface Inconsistencia {
  id: string;
  nome?: string;
  nome_completo?: string;
  email?: string;
  quantidade_funcionarios?: number;
  aviso: string;
  departamento?: {
    id: string;
    nome: string;
  };
}

interface EstruturaOrganizacional {
  estrutura: Departamento[];
  inconsistencias: {
    cargos_sem_departamento: Inconsistencia[];
    cargos_sem_funcionarios: Inconsistencia[];
    funcionarios_sem_cargo: Inconsistencia[];
  };
  estatisticas: {
    total_departamentos: number;
    total_cargos: number;
    total_cargos_com_funcionarios: number;
    total_funcionarios: number;
    total_inconsistencias: number;
  };
}

// Componente para exibir detalhes do departamento no Sheet
const DepartamentoDetailsSheet: React.FC<{
  departamento: Departamento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ departamento, open, onOpenChange }) => {
  if (!departamento) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col h-full">
        <div className="p-6 border-b flex-shrink-0">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <SheetTitle className="text-2xl">{departamento.nome}</SheetTitle>
                {departamento.descricao && (
                  <SheetDescription className="mt-1">
                    {departamento.descricao}
                  </SheetDescription>
                )}
              </div>
            </div>
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de Cargos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{departamento.total_cargos}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de Funcionários
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{departamento.total_funcionarios}</div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Cargos e Funcionários */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Cargos e Funcionários
            </h3>

            {departamento.cargos.length > 0 ? (
              <div className="space-y-4">
                {departamento.cargos.map((cargo) => (
                  <Card key={cargo.id} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">{cargo.nome}</CardTitle>
                            <Badge
                              variant={
                                cargo.tipo === 'ACADEMICO'
                                  ? 'default'
                                  : 'outline'
                              }
                              className="text-xs"
                            >
                              {cargo.tipo}
                            </Badge>
                          </div>
                          {cargo.descricao && (
                            <CardDescription className="text-sm">
                              {cargo.descricao}
                            </CardDescription>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {cargo.quantidade_funcionarios} funcionário(s)
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {cargo.quantidade_funcionarios > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground mb-2">
                            Funcionários:
                          </p>
                          <div className="space-y-2 pl-4 border-l-2 border-muted">
                            {cargo.funcionarios.map((funcionario) => (
                              <div
                                key={funcionario.id}
                                className="flex items-center gap-2 py-1.5"
                              >
                                <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {funcionario.nome_completo}
                                  </p>
                                  {funcionario.email && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {funcionario.email}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {funcionario.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic py-2">
                          Nenhum funcionário vinculado a este cargo
                        </div>
                      )}
                      {cargo.aviso && (
                        <Alert variant="default" className="mt-3">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {cargo.aviso}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum cargo vinculado a este departamento.
                </AlertDescription>
              </Alert>
            )}

            {/* Funcionários sem Cargo */}
            {departamento.funcionarios_sem_cargo.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong className="block mb-2">
                    Funcionários sem cargo ({departamento.funcionarios_sem_cargo.length}):
                  </strong>
                  <ul className="space-y-1 text-sm">
                    {departamento.funcionarios_sem_cargo.map((func) => (
                      <li key={func.id} className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        <span>
                          <strong>{func.nome_completo}</strong> ({func.email})
                        </span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export const EstruturaOrganizacionalTab: React.FC = () => {
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const { role } = useAuth();
  const [selectedDepartamento, setSelectedDepartamento] = useState<Departamento | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // RH e outros staff: backend obtém instituicaoId do JWT - habilitar query mesmo sem instituicaoId no contexto
  const shouldFetchEstrutura = !!instituicaoId || isSuperAdmin || isStaffWithFallback(role);

  const { data, isLoading, error } = useQuery<EstruturaOrganizacional>({
    queryKey: ['estrutura-organizacional', instituicaoId, role],
    queryFn: async () => {
      return await estruturaOrganizacionalApi.getEstrutura();
    },
    enabled: shouldFetchEstrutura,
  });

  const handleViewDetails = (departamento: Departamento) => {
    setSelectedDepartamento(departamento);
    setSheetOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar estrutura organizacional. Tente novamente.
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Nenhuma estrutura organizacional encontrada.
        </AlertDescription>
      </Alert>
    );
  }

  const { estrutura, inconsistencias, estatisticas } = data;

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Departamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estatisticas.total_departamentos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Cargos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estatisticas.total_cargos}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {estatisticas.total_cargos_com_funcionarios} com funcionários
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Funcionários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estatisticas.total_funcionarios}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Inconsistências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estatisticas.total_inconsistencias}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Inconsistências */}
      {estatisticas.total_inconsistencias > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> Existem {estatisticas.total_inconsistencias} inconsistência(s) na estrutura organizacional.
            Verifique a seção de inconsistências abaixo.
          </AlertDescription>
        </Alert>
      )}

      {/* Lista de Departamentos - Layout Compacto e Escalável */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Departamentos
          </CardTitle>
          <CardDescription>
            Clique em "Ver detalhes" para visualizar cargos e funcionários de cada departamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {estrutura.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {estrutura.map((departamento) => (
                <Card
                  key={departamento.id}
                  className="hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-primary/50"
                  onClick={() => handleViewDetails(departamento)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">
                            {departamento.nome}
                          </CardTitle>
                          {departamento.descricao && (
                            <CardDescription className="text-xs truncate mt-1">
                              {departamento.descricao}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Briefcase className="h-4 w-4" />
                          <span>Cargos</span>
                        </div>
                        <Badge variant="secondary" className="font-semibold">
                          {departamento.total_cargos}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>Funcionários</span>
                        </div>
                        <Badge variant="secondary" className="font-semibold">
                          {departamento.total_funcionarios}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-4 flex items-center justify-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(departamento);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      Ver detalhes
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum departamento cadastrado. Comece criando departamentos e cargos.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Inconsistências - Mantém compacto */}
      {estatisticas.total_inconsistencias > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Inconsistências
            </CardTitle>
            <CardDescription>
              Problemas encontrados na estrutura organizacional que precisam ser corrigidos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cargos sem Departamento */}
            {inconsistencias.cargos_sem_departamento.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Cargos sem Departamento ({inconsistencias.cargos_sem_departamento.length})
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {inconsistencias.cargos_sem_departamento.map((item) => (
                    <li key={item.id}>
                      <strong className="text-foreground">{item.nome}</strong> - {item.quantidade_funcionarios} funcionário(s)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Funcionários sem Cargo */}
            {inconsistencias.funcionarios_sem_cargo.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Funcionários sem Cargo ({inconsistencias.funcionarios_sem_cargo.length})
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {inconsistencias.funcionarios_sem_cargo.map((item) => (
                    <li key={item.id}>
                      <strong className="text-foreground">{item.nome_completo}</strong> ({item.email})
                      {item.departamento && (
                        <span className="text-muted-foreground">
                          {' '}- Departamento: {item.departamento.nome}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sheet com detalhes do departamento */}
      <DepartamentoDetailsSheet
        departamento={selectedDepartamento}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
};
