import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Lock, Shield, CheckCircle2, AlertTriangle, Info, Key, Users, Building2 } from 'lucide-react';

export const SegurancaTab = () => {
  const securityFeatures = [
    {
      title: 'Controle de Acesso por Role',
      description: 'Apenas usuários com role = SUPER_ADMIN podem acessar este painel',
      status: 'active',
      icon: Shield,
    },
    {
      title: 'Isolamento de Instituições',
      description: 'Cada instituição possui seu próprio painel ADMIN isolado',
      status: 'active',
      icon: Building2,
    },
    {
      title: 'Row Level Security (RLS)',
      description: 'Políticas de segurança implementadas em todas as tabelas',
      status: 'active',
      icon: Lock,
    },
    {
      title: 'Autenticação JWT',
      description: 'Tokens JWT verificados em todas as requisições autenticadas',
      status: 'active',
      icon: Key,
    },
    {
      title: 'Hierarquia de Permissões',
      description: 'SUPER_ADMIN > ADMIN > SECRETARIA > PROFESSOR > ALUNO',
      status: 'active',
      icon: Users,
    },
  ];

  const roleHierarchy = [
    {
      role: 'SUPER_ADMIN',
      description: 'Acesso global a todas as instituições e configurações da plataforma',
      color: 'bg-red-500',
    },
    {
      role: 'ADMIN',
      description: 'Administrador institucional com acesso total à sua instituição',
      color: 'bg-purple-500',
    },
    {
      role: 'SECRETARIA',
      description: 'Gestão de alunos, matrículas e documentos',
      color: 'bg-blue-500',
    },
    {
      role: 'PROFESSOR',
      description: 'Gestão de notas, frequências e turmas atribuídas',
      color: 'bg-green-500',
    },
    {
      role: 'ALUNO',
      description: 'Acesso às próprias informações acadêmicas e financeiras',
      color: 'bg-gray-500',
    },
    {
      role: 'POS',
      description: 'Ponto de venda para recebimento de pagamentos',
      color: 'bg-orange-500',
    },
    {
      role: 'RESPONSAVEL',
      description: 'Acompanhamento dos alunos vinculados',
      color: 'bg-teal-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Security Status */}
      <Card className="border-green-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            🔒 Status de Segurança
          </CardTitle>
          <CardDescription>
            Visão geral das configurações de segurança da plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-green-500/30 bg-green-500/5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-500">Sistema Protegido</AlertTitle>
            <AlertDescription>
              Todas as configurações de segurança estão ativas e funcionando corretamente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Security Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Recursos de Segurança
          </CardTitle>
          <CardDescription>
            Funcionalidades de proteção implementadas na plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {securityFeatures.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card"
              >
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <feature.icon className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{feature.title}</h4>
                    <Badge variant="outline" className="text-green-500 border-green-500/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role Hierarchy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Hierarquia de Roles
          </CardTitle>
          <CardDescription>
            Níveis de acesso e permissões por tipo de usuário
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {roleHierarchy.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-3 rounded-lg border bg-card"
              >
                <div className={`h-3 w-3 rounded-full ${item.color}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {item.role}
                    </Badge>
                    {item.role === 'SUPER_ADMIN' && (
                      <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                        Nível Máximo
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Important Notice */}
      <Alert className="border-yellow-500/30 bg-yellow-500/5">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertTitle className="text-yellow-500">Importante</AlertTitle>
        <AlertDescription>
          Apenas usuários com role <code className="font-mono bg-muted px-1 rounded">SUPER_ADMIN</code> podem 
          criar, editar ou excluir instituições. Os administradores institucionais (ADMIN) não possuem 
          acesso a este painel.
        </AlertDescription>
      </Alert>
    </div>
  );
};
