import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel } from '@/utils/roleLabels';
import {
  Shield,
  Users, 
  GraduationCap, 
  BookOpen, 
  DollarSign, 
  Home, 
  Settings,
  FileText,
  CreditCard,
  BarChart3,
  UserCheck,
  Building2
} from "lucide-react";

interface PermissoesRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RoleInfo {
  role: string;
  nome: string;
  descricao: string;
  cor: string;
  icone: React.ReactNode;
  permissoes: string[];
  painelPrincipal: string;
}

const rolesInfo: RoleInfo[] = [
  {
    role: "ADMIN",
    nome: "Administrador",
    descricao: "Acesso completo a todas as funcionalidades do sistema",
    cor: "bg-red-500/10 text-red-500 border-red-500/20",
    icone: <Shield className="h-5 w-5" />,
    painelPrincipal: "/admin-dashboard",
    permissoes: [
      "Gestão completa de cursos e disciplinas",
      "Gestão de turmas e horários",
      "Cadastro e gestão de professores",
      "Cadastro e gestão de alunos",
      "Gestão de moradias/alojamentos",
      "Gestão financeira completa",
      "Configurações da instituição",
      "Gestão de funcionários da secretaria",
      "Visualização de relatórios e estatísticas",
      "Gestão de permissões de usuários",
    ],
  },
  {
    role: "PROFESSOR",
    nome: "Professor",
    descricao: "Acesso às turmas atribuídas para gestão acadêmica",
    cor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icone: <BookOpen className="h-5 w-5" />,
    painelPrincipal: "/painel-professor",
    permissoes: [
      "Visualizar turmas atribuídas",
      "Lançar notas dos alunos",
      "Registrar frequência das aulas",
      "Visualizar lista de alunos por turma",
      "Gerar relatórios de notas e frequência",
    ],
  },
  {
    role: "ALUNO",
    nome: "Aluno",
    descricao: "Acesso ao portal acadêmico pessoal",
    cor: "bg-green-500/10 text-green-500 border-green-500/20",
    icone: <GraduationCap className="h-5 w-5" />,
    painelPrincipal: "/painel-aluno",
    permissoes: [
      "Visualizar notas e médias",
      "Consultar frequência",
      "Visualizar histórico acadêmico",
      "Consultar mensalidades",
      "Visualizar dados pessoais",
    ],
  },
  {
    role: "SECRETARIA",
    nome: "Secretaria",
    descricao: "Acesso à gestão de pagamentos e finanças",
    cor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    icone: <DollarSign className="h-5 w-5" />,
    painelPrincipal: "/admin-dashboard/pagamentos",
    permissoes: [
      "Visualizar mensalidades de todos os alunos",
      "Registrar pagamentos",
      "Gerar recibos de pagamento",
      "Aplicar multas por atraso",
      "Gerar mensalidades em lote",
      "Exportar relatórios financeiros",
      "Visualizar gráficos e metas financeiras",
    ],
  },
  {
    role: "POS",
    nome: "Ponto de Venda",
    descricao: "Acesso rápido para registro de pagamentos no balcão",
    cor: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    icone: <CreditCard className="h-5 w-5" />,
    painelPrincipal: "/ponto-de-venda",
    permissoes: [
      "Buscar alunos por nome ou ID",
      "Visualizar mensalidades pendentes",
      "Registrar pagamentos",
      "Gerar recibos de pagamento",
      "Interface simplificada para atendimento rápido",
    ],
  },
];

export function PermissoesRolesDialog({ open, onOpenChange }: PermissoesRolesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-6 w-6 text-primary" />
            Permissões por Role
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 md:grid-cols-2">
          {rolesInfo.map((info) => (
            <Card key={info.role} className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${info.cor}`}>
                      {info.icone}
                    </div>
                    <div>
                      <span className="font-bold">{info.nome}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {getRoleLabel(info.role)}
                      </Badge>
                    </div>
                  </div>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{info.descricao}</p>
                <p className="text-xs text-primary font-mono">
                  Painel: {info.painelPrincipal}
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {info.permissoes.map((perm, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {perm}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
