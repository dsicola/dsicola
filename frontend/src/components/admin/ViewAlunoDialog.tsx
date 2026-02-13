import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, IdCard, Calendar, MapPin, Heart, Users, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Aluno {
  id: string;
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
  nome_pai: string | null;
  nome_mae: string | null;
  morada: string | null;
  profissao: string | null;
  status_aluno: string | null;
}

interface ViewAlunoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aluno: Aluno | null;
}

export function ViewAlunoDialog({ open, onOpenChange, aluno }: ViewAlunoDialogProps) {
  if (!aluno) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "Ativo":
        return <Badge className="bg-green-500">Ativo</Badge>;
      case "Inativo":
        return <Badge variant="secondary">Inativo</Badge>;
      case "Inativo por inadimplência":
        return <Badge variant="destructive">Inadimplente</Badge>;
      default:
        return <Badge className="bg-green-500">Ativo</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Aluno</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Header with avatar and basic info */}
          <div className="flex items-start gap-6 p-4 bg-muted/50 rounded-lg">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarImage src={aluno.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {getInitials(aluno.nome_completo)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-bold">{aluno.nome_completo}</h3>
              <p className="text-muted-foreground">{aluno.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {getStatusBadge(aluno.status_aluno)}
                {aluno.numero_identificacao_publica && (
                  <Badge variant="default" className="bg-primary">{aluno.numero_identificacao_publica}</Badge>
                )}
                {aluno.genero && (
                  <Badge variant="outline">{aluno.genero}</Badge>
                )}
                {aluno.numero_identificacao && (
                  <Badge variant="secondary">BI: {aluno.numero_identificacao}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h4 className="font-semibold border-b pb-2">Dados Pessoais</h4>
              
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Nome Completo</p>
                  <p className="font-medium">{aluno.nome_completo}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{aluno.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="font-medium">{aluno.telefone || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <IdCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Número de Identificação (BI)</p>
                  <p className="font-medium">{aluno.numero_identificacao || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Data de Nascimento</p>
                  <p className="font-medium">{formatDate(aluno.data_nascimento)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Heart className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Tipo Sanguíneo</p>
                  <p className="font-medium">{aluno.tipo_sanguineo || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Profissão</p>
                  <p className="font-medium">{aluno.profissao || '-'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold border-b pb-2">Endereço</h4>
              
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Morada</p>
                  <p className="font-medium">{aluno.morada || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Cidade</p>
                  <p className="font-medium">{aluno.cidade || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">País</p>
                  <p className="font-medium">{aluno.pais || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Código Postal</p>
                  <p className="font-medium">{aluno.codigo_postal || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Parents Details */}
          <div className="space-y-4">
            <h4 className="font-semibold border-b pb-2">Dados dos Encarregados</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Nome do Pai</p>
                  <p className="font-medium">{aluno.nome_pai || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Nome da Mãe</p>
                  <p className="font-medium">{aluno.nome_mae || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
