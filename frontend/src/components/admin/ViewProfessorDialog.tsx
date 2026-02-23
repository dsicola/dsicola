import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { turmasApi, professorDisciplinasApi, aulasApi, notasApi, frequenciasApi, matriculasApi, horariosApi } from "@/services/api";
import { 
  User, Mail, Phone, IdCard, Calendar, Briefcase, Clock, MapPin, Heart, 
  BookOpen, Users, GraduationCap, ClipboardCheck, Sun, Sunset, Moon, Printer, Loader2 
} from "lucide-react";
import { format } from "date-fns";
import { safeToFixed } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Professor {
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
  qualificacao: string | null;
  data_admissao: string | null;
  data_saida: string | null;
  cargo_atual: string | null;
  codigo_funcionario: string | null;
  horas_trabalho: string | null;
  morada: string | null;
}

interface ViewProfessorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professor: Professor | null;
}

export function ViewProfessorDialog({ open, onOpenChange, professor }: ViewProfessorDialogProps) {
  const { user } = useAuth();
  const [loadingPrintHorario, setLoadingPrintHorario] = useState(false);
  const roles = user?.roles || [];
  const professorId = user?.professorId;
  const canPrintHorario = roles.some((r) => ["ADMIN", "SUPER_ADMIN", "SECRETARIA"].includes(r)) ||
    (roles.includes("PROFESSOR") && professor?.id && professorId === professor.id);

  const handleImprimirHorario = async () => {
    if (!professor?.id) return;
    setLoadingPrintHorario(true);
    try {
      const blob = await horariosApi.imprimirProfessor(professor.id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      window.open(url, "_blank");
      toast.success("Horário aberto em nova aba");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao imprimir horário");
    } finally {
      setLoadingPrintHorario(false);
    }
  };

  // Fetch turmas do professor
  const { data: turmas, isLoading: loadingTurmas } = useQuery({
    queryKey: ["professor-turmas", professor?.id],
    queryFn: async () => {
      if (!professor?.id) return [];
      const data = await turmasApi.getAll({ professorId: professor.id });
      return data || [];
    },
    enabled: open && !!professor?.id,
  });

  // Fetch disciplinas atribuídas
  const { data: disciplinas, isLoading: loadingDisciplinas } = useQuery({
    queryKey: ["professor-disciplinas", professor?.id],
    queryFn: async () => {
      if (!professor?.id) return [];
      const data = await professorDisciplinasApi.getByProfessor(professor.id);
      return data || [];
    },
    enabled: open && !!professor?.id,
  });

  // Fetch aulas e frequências registradas
  const { data: aulas, isLoading: loadingAulas } = useQuery({
    queryKey: ["professor-aulas", professor?.id],
    queryFn: async () => {
      if (!professor?.id || !turmas || turmas.length === 0) return [];
      const turmaIds = turmas.map((t: any) => t.id);
      
      // Fetch aulas for each turma
      const allAulas: any[] = [];
      for (const turmaId of turmaIds.slice(0, 5)) {
        const data = await aulasApi.getAll({ turmaId });
        allAulas.push(...(data || []).slice(0, 10));
      }
      
      return allAulas.slice(0, 50);
    },
    enabled: open && !!professor?.id && !!turmas && turmas.length > 0,
  });

  // Fetch notas registradas nas turmas do professor
  const { data: notas, isLoading: loadingNotas } = useQuery({
    queryKey: ["professor-notas", professor?.id],
    queryFn: async () => {
      if (!professor?.id || !turmas || turmas.length === 0) return [];
      const turmaIds = turmas.map((t: any) => t.id);
      
      // Fetch notas for each turma
      const allNotas: any[] = [];
      for (const turmaId of turmaIds.slice(0, 5)) {
        const data = await notasApi.getAll({ turmaId });
        allNotas.push(...(data || []).slice(0, 20));
      }
      
      return allNotas.slice(0, 100);
    },
    enabled: open && !!professor?.id && !!turmas && turmas.length > 0,
  });

  // Fetch estatísticas de frequência
  const { data: frequenciaStats, isLoading: loadingFrequencia } = useQuery({
    queryKey: ["professor-frequencia-stats", professor?.id],
    queryFn: async () => {
      if (!professor?.id || !aulas || aulas.length === 0) return null;
      const aulaIds = aulas.map((a: any) => a.id);
      
      // Fetch frequencias for each aula
      let total = 0;
      let presentes = 0;
      
      for (const aulaId of aulaIds.slice(0, 20)) {
        const data = await frequenciasApi.getByAula(aulaId);
        if (data) {
          total += data.length;
          presentes += data.filter((f: any) => f.presente).length;
        }
      }
      
      const ausentes = total - presentes;
      const taxaPresenca = total > 0 ? safeToFixed((presentes / total) * 100, 1) : "0";
      
      return { total, presentes, ausentes, taxaPresenca };
    },
    enabled: open && !!professor?.id && !!aulas && aulas.length > 0,
  });

  if (!professor) return null;

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
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

  const getTurnoIcon = (turno: string | { nome?: string } | null) => {
    const turnoNome = typeof turno === 'string' ? turno : turno?.nome;
    if (!turnoNome) return <Clock className="h-4 w-4 text-muted-foreground" />;
    const turnoLower = String(turnoNome ?? '').toLowerCase();
    switch (turnoLower) {
      case 'manhã':
      case 'manha':
        return <Sun className="h-4 w-4 text-yellow-500" />;
      case 'tarde':
        return <Sunset className="h-4 w-4 text-orange-500" />;
      case 'noite':
        return <Moon className="h-4 w-4 text-indigo-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTurnoBadgeVariant = (turno: string | { nome?: string } | null): "default" | "secondary" | "outline" | "destructive" => {
    const turnoNome = typeof turno === 'string' ? turno : turno?.nome;
    if (!turnoNome) return "secondary";
    const turnoLower = String(turnoNome ?? '').toLowerCase();
    switch (turnoLower) {
      case 'manhã':
      case 'manha':
        return "default";
      case 'tarde':
        return "secondary";
      case 'noite':
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>Perfil Completo do Professor</DialogTitle>
            {canPrintHorario && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleImprimirHorario}
                disabled={loadingPrintHorario}
              >
                {loadingPrintHorario ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                Imprimir Horário
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Header with avatar and basic info */}
          <div className="flex items-start gap-6 p-4 bg-muted/50 rounded-lg">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarImage src={professor.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {getInitials(professor.nome_completo)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-bold">{professor.nome_completo || professor.nomeCompleto || 'Nome não informado'}</h3>
              <p className="text-muted-foreground">{professor.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {professor.numero_identificacao_publica && (
                  <Badge variant="default" className="bg-primary">{professor.numero_identificacao_publica}</Badge>
                )}
                {professor.cargo_atual && (
                  <Badge variant="default">{professor.cargo_atual}</Badge>
                )}
                {professor.genero && (
                  <Badge variant="outline">{professor.genero}</Badge>
                )}
                {professor.numero_identificacao && (
                  <Badge variant="secondary">BI: {professor.numero_identificacao}</Badge>
                )}
              </div>
              
              {/* Quick Stats */}
              <div className="flex gap-4 mt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{turmas?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Turmas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{disciplinas?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Disciplinas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{aulas?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Aulas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{notas?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Notas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs for different sections */}
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="dados" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Dados</span>
              </TabsTrigger>
              <TabsTrigger value="turmas" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Turmas</span>
              </TabsTrigger>
              <TabsTrigger value="disciplinas" className="gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Disciplinas</span>
              </TabsTrigger>
              <TabsTrigger value="notas" className="gap-2">
                <GraduationCap className="h-4 w-4" />
                <span className="hidden sm:inline">Notas</span>
              </TabsTrigger>
              <TabsTrigger value="frequencia" className="gap-2">
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Frequência</span>
              </TabsTrigger>
            </TabsList>

            {/* Dados Pessoais */}
            <TabsContent value="dados" className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Dados Pessoais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Nome Completo</p>
                        <p className="font-medium">{professor.nome_completo || professor.nomeCompleto || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium">{professor.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="font-medium">{professor.telefone || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IdCard className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">BI</p>
                        <p className="font-medium">{professor.numero_identificacao || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Data de Nascimento</p>
                        <p className="font-medium">{formatDate(professor.data_nascimento)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Tipo Sanguíneo</p>
                        <p className="font-medium">{professor.tipo_sanguineo || '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Endereço</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Morada</p>
                        <p className="font-medium">{professor.morada || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Cidade</p>
                        <p className="font-medium">{professor.cidade || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">País</p>
                        <p className="font-medium">{professor.pais || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Código Postal</p>
                        <p className="font-medium">{professor.codigo_postal || '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Dados Profissionais</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Cargo Atual</p>
                          <p className="font-medium">{professor.cargo_atual || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <IdCard className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Código Funcionário</p>
                          <p className="font-medium">{professor.codigo_funcionario || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Horas de Trabalho</p>
                          <p className="font-medium">{professor.horas_trabalho || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Data de Admissão</p>
                          <p className="font-medium">{formatDate(professor.data_admissao)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Data de Saída</p>
                          <p className="font-medium">{formatDate(professor.data_saida)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Qualificação</p>
                          <p className="font-medium">{professor.qualificacao || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Turmas */}
            <TabsContent value="turmas">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Turmas Atribuídas ({turmas?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingTurmas ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : turmas && turmas.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Turma</TableHead>
                          <TableHead>Curso</TableHead>
                          <TableHead>Ano/Semestre</TableHead>
                          <TableHead>Turno</TableHead>
                          <TableHead>Sala</TableHead>
                          <TableHead>Horário</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {turmas.map((turma: any) => (
                          <TableRow key={turma.id}>
                            <TableCell className="font-medium">{turma.nome}</TableCell>
                            <TableCell>{turma.curso?.nome || '-'}</TableCell>
                            <TableCell>{turma.ano} / {turma.semestre}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getTurnoIcon(turma.turno)}
                                <Badge variant={getTurnoBadgeVariant(turma.turno)}>
                                  {typeof turma.turno === 'object' ? turma.turno?.nome : turma.turno || 'N/A'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>{turma.sala || '-'}</TableCell>
                            <TableCell>{turma.horario || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhuma turma atribuída a este professor.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Disciplinas */}
            <TabsContent value="disciplinas">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Disciplinas Atribuídas ({disciplinas?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingDisciplinas ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : disciplinas && disciplinas.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Disciplina</TableHead>
                          <TableHead>Curso</TableHead>
                          <TableHead>Carga Horária</TableHead>
                          <TableHead>Ano</TableHead>
                          <TableHead>Semestre</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {disciplinas.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.disciplina?.nome || '-'}</TableCell>
                            <TableCell>{item.disciplina?.curso?.nome || '-'}</TableCell>
                            <TableCell>{item.disciplina?.cargaHoraria || 0}h</TableCell>
                            <TableCell>{item.ano}</TableCell>
                            <TableCell>{item.semestre}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhuma disciplina atribuída a este professor.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notas */}
            <TabsContent value="notas">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Notas Registradas ({notas?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingNotas ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : notas && notas.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Aluno</TableHead>
                          <TableHead>Turma</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Nota</TableHead>
                          <TableHead>Peso</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notas.slice(0, 20).map((nota: any) => (
                          <TableRow key={nota.id}>
                            <TableCell className="font-medium">
                              {nota.matricula?.aluno?.nomeCompleto || '-'}
                            </TableCell>
                            <TableCell>{nota.matricula?.turma?.nome || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{nota.tipo}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={nota.valor >= 10 ? "default" : "destructive"}>
                                {nota.valor}
                              </Badge>
                            </TableCell>
                            <TableCell>{nota.peso}</TableCell>
                            <TableCell>{formatDate(nota.data)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhuma nota registrada por este professor.
                    </p>
                  )}
                  {notas && notas.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Mostrando 20 de {notas.length} notas
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Frequência */}
            <TabsContent value="frequencia">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Estatísticas de Frequência</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingFrequencia || loadingAulas ? (
                      <div className="space-y-2">
                        <Skeleton className="h-20 w-full" />
                      </div>
                    ) : frequenciaStats ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-3xl font-bold text-primary">{frequenciaStats.total}</p>
                          <p className="text-xs text-muted-foreground">Total de Registros</p>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-3xl font-bold text-green-600">{frequenciaStats.taxaPresenca}%</p>
                          <p className="text-xs text-muted-foreground">Taxa de Presença</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{frequenciaStats.presentes}</p>
                          <p className="text-xs text-muted-foreground">Presenças</p>
                        </div>
                        <div className="text-center p-4 bg-red-50 rounded-lg">
                          <p className="text-2xl font-bold text-red-600">{frequenciaStats.ausentes}</p>
                          <p className="text-xs text-muted-foreground">Ausências</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">
                        Nenhum registro de frequência disponível.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Aulas Recentes ({aulas?.length || 0})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingAulas ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : aulas && aulas.length > 0 ? (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {aulas.slice(0, 10).map((aula: any) => (
                          <div key={aula.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                            <div>
                              <p className="font-medium text-sm">{aula.turma?.nome || '-'}</p>
                              <p className="text-xs text-muted-foreground">{aula.conteudo || 'Sem conteúdo'}</p>
                            </div>
                            <Badge variant="outline">{formatDate(aula.data)}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">
                        Nenhuma aula registrada.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
