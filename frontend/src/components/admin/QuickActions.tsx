import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  UserPlus, 
  GraduationCap, 
  BookOpen, 
  Users, 
  ClipboardList, 
  DollarSign,
  FileText,
  Bell,
  CreditCard,
  KeyRound
} from "lucide-react";

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    label: "Admitir Estudante",
    icon: <UserPlus className="h-5 w-5" />,
    path: "/admin-dashboard/criar-aluno",
    color: "bg-blue-500 hover:bg-blue-600 text-white",
  },
  {
    label: "Adicionar Professor",
    icon: <GraduationCap className="h-5 w-5" />,
    path: "/admin-dashboard/criar-professor",
    color: "bg-green-500 hover:bg-green-600 text-white",
  },
  {
    label: "Adicionar Disciplinas",
    icon: <BookOpen className="h-5 w-5" />,
    path: "/admin-dashboard/gestao-academica",
    color: "bg-purple-500 hover:bg-purple-600 text-white",
  },
  {
    label: "Adicionar Turma",
    icon: <Users className="h-5 w-5" />,
    path: "/admin-dashboard/gestao-academica",
    color: "bg-orange-500 hover:bg-orange-600 text-white",
  },
  {
    label: "Registar Notas",
    icon: <ClipboardList className="h-5 w-5" />,
    path: "/admin-dashboard/gestao-academica",
    color: "bg-teal-500 hover:bg-teal-600 text-white",
  },
  {
    label: "Gestão Financeira",
    icon: <DollarSign className="h-5 w-5" />,
    path: "/admin-dashboard/gestao-financeira",
    color: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  {
    label: "Boletins",
    icon: <FileText className="h-5 w-5" />,
    path: "/admin-dashboard/boletim",
    color: "bg-cyan-500 hover:bg-cyan-600 text-white",
  },
  {
    label: "Notificações",
    icon: <Bell className="h-5 w-5" />,
    path: "/admin-dashboard/notificacoes",
    color: "bg-rose-500 hover:bg-rose-600 text-white",
  },
  {
    label: "Minha Assinatura",
    icon: <CreditCard className="h-5 w-5" />,
    path: "/admin-dashboard/minha-assinatura",
    color: "bg-indigo-500 hover:bg-indigo-600 text-white",
  },
  {
    label: "Redefinir Senha",
    icon: <KeyRound className="h-5 w-5" />,
    path: "/admin-dashboard/redefinir-senha",
    color: "bg-slate-500 hover:bg-slate-600 text-white",
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="ghost"
              className={`flex flex-col items-center justify-center h-24 gap-2 ${action.color}`}
              onClick={() => navigate(action.path)}
            >
              {action.icon}
              <span className="text-xs text-center font-medium leading-tight">
                {action.label}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
