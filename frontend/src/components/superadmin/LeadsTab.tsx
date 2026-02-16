import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { leadsApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  RefreshCw,
  Eye,
  Rocket,
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface Lead {
  id: string;
  nome_instituicao?: string;
  nomeInstituicao?: string;
  nome_responsavel?: string;
  nomeResponsavel?: string;
  nome_contato?: string;
  nomeContato?: string;
  email: string;
  telefone: string;
  cidade: string | null;
  mensagem: string | null;
  plano_interesse?: string | null;
  planoInteresse?: string | null;
  tipo_instituicao?: string | null;
  tipoInstituicao?: string | null;
  status: string;
  notas?: string | null;
  observacoes?: string | null;
  atendido_por?: string | null;
  data_contato?: string | null;
  created_at?: string;
  createdAt?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  novo: { label: "Novo", color: "bg-blue-500", icon: AlertCircle },
  em_contato: { label: "Em Contato", color: "bg-yellow-500", icon: Clock },
  convertido: { label: "Convertido", color: "bg-green-500", icon: CheckCircle2 },
  perdido: { label: "Perdido", color: "bg-red-500", icon: XCircle },
};

export function LeadsTab() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [updating, setUpdating] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await leadsApi.getAll();
      setLeads(data || []);
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      toast({
        title: "Erro ao carregar leads",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
    setUpdating(true);
    try {
      await leadsApi.update(leadId, {
        status: updates.status,
        notas: updates.notas,
      });

      toast({
        title: "Lead atualizado",
        description: "As informações foram salvas com sucesso.",
      });

      fetchLeads();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getLeadField = (lead: Lead, field: string) => {
    const camelCase = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    // Mapear nome_responsavel <-> nomeContato (backend usa nomeContato)
    if (field === 'nome_responsavel') {
      return (lead as any).nomeContato || (lead as any).nome_contato || (lead as any).nomeResponsavel || (lead as any).nome_responsavel || '';
    }
    if (field === 'created_at') {
      return (lead as any).createdAt || (lead as any).created_at || '';
    }
    if (field === 'notas') {
      return (lead as any).observacoes ?? (lead as any).notas ?? '';
    }
    if (field === 'tipo_instituicao') {
      return (lead as any).tipoInstituicao || (lead as any).tipo_instituicao || '';
    }
    return (lead as any)[field] || (lead as any)[camelCase] || '';
  };

  const filteredLeads = leads.filter((lead) => {
    const nomeInstituicao = getLeadField(lead, 'nome_instituicao');
    const nomeResponsavel = getLeadField(lead, 'nome_responsavel');
    const matchesSearch =
      nomeInstituicao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nomeResponsavel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: leads.length,
    novos: leads.filter((l) => l.status === "novo").length,
    emContato: leads.filter((l) => l.status === "em_contato").length,
    convertidos: leads.filter((l) => l.status === "convertido").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Leads Comerciais</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie os contatos recebidos pelo formulário da landing page
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <Building2 className="h-4 w-4 text-muted-foreground/70" />
            </div>
            <p className="text-2xl font-bold mt-2">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-0.5">leads capturados</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Novos</p>
              <AlertCircle className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{stats.novos}</p>
            <p className="text-xs text-muted-foreground mt-0.5">aguardando contato</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Em Contato</p>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">{stats.emContato}</p>
            <p className="text-xs text-muted-foreground mt-0.5">em acompanhamento</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Convertidos</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{stats.convertidos}</p>
            <p className="text-xs text-muted-foreground mt-0.5">clientes fechados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Lista de Leads</CardTitle>
          <CardDescription>Filtre e visualize os contatos por status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por instituição, responsável ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="novo">Novos</SelectItem>
                <SelectItem value="em_contato">Em Contato</SelectItem>
                <SelectItem value="convertido">Convertidos</SelectItem>
                <SelectItem value="perdido">Perdidos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchLeads} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="animate-spin h-10 w-10 border-2 border-primary border-t-transparent rounded-full" />
              <p className="text-sm text-muted-foreground">Carregando leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 rounded-lg border border-dashed bg-muted/30">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <Building2 className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-medium text-center">Nenhum lead encontrado</p>
              <p className="text-sm text-muted-foreground text-center mt-1 max-w-sm">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Tente ajustar os filtros de busca ou status.'
                  : 'Os leads aparecerão aqui quando alguém preencher o formulário da landing page.'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instituição</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Tipo / Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => {
                    const status = statusConfig[lead.status] || statusConfig.novo;
                    const StatusIcon = status.icon;
                    const createdAt = getLeadField(lead, 'created_at');
                    const nomeInstituicao = getLeadField(lead, 'nome_instituicao');
                    const nomeResponsavel = getLeadField(lead, 'nome_responsavel');
                    const planoInteresse = getLeadField(lead, 'plano_interesse');
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {nomeInstituicao}
                          </div>
                        </TableCell>
                        <TableCell>{nomeResponsavel}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                                {lead.email}
                              </a>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {lead.telefone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const tipoInst = getLeadField(lead, 'tipo_instituicao');
                            const plano = planoInteresse;
                            const display = tipoInst || plano;
                            return display ? (
                              <Badge variant="outline" className="font-normal">{display}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${status.color} text-white border-0 font-medium`}>
                            <StatusIcon className="h-3 w-3 mr-1.5" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {createdAt ? format(new Date(createdAt), "dd/MM/yyyy HH:mm", { locale: pt }) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1.5" />
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedLead && getLeadField(selectedLead, 'nome_instituicao')}
            </DialogTitle>
            <DialogDescription>
              Lead recebido em{" "}
              {selectedLead && getLeadField(selectedLead, 'created_at') &&
                format(new Date(getLeadField(selectedLead, 'created_at')), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                  locale: pt,
                })}
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase">Responsável</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    {getLeadField(selectedLead, 'nome_responsavel')}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase">Cidade</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {selectedLead.cidade || "Não informada"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase">Email</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <a href={`mailto:${selectedLead.email}`} className="text-primary hover:underline">
                      {selectedLead.email}
                    </a>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase">Telefone</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <a href={`tel:${selectedLead.telefone}`} className="text-primary hover:underline">
                      {selectedLead.telefone}
                    </a>
                  </div>
                </div>
              </div>

              {selectedLead.mensagem && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase">Mensagem</Label>
                  <div className="p-4 bg-muted rounded-lg">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mb-2" />
                    <p className="text-sm">{selectedLead.mensagem}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={selectedLead.status}
                    onValueChange={(value) =>
                      setSelectedLead({ ...selectedLead, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="em_contato">Em Contato</SelectItem>
                      <SelectItem value="convertido">Convertido</SelectItem>
                      <SelectItem value="perdido">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase">Plano de Interesse</Label>
                  <div className="flex items-center h-10">
                    <Badge variant="outline">{getLeadField(selectedLead, 'plano_interesse') || "Não especificado"}</Badge>
                  </div>
                </div>
              </div>

                <div className="space-y-2">
                  <Label htmlFor="notas">Notas Internas</Label>
                  <Textarea
                    id="notas"
                    placeholder="Adicione notas sobre o contato com este lead..."
                    value={getLeadField(selectedLead, 'notas') || ""}
                    onChange={(e) =>
                      setSelectedLead({ ...selectedLead, notas: e.target.value, observacoes: e.target.value })
                    }
                    rows={3}
                  />
                </div>

              <div className="flex justify-between gap-3">
                <div>
                  {selectedLead.status === "convertido" && (
                    <Button
                      variant="default"
                      onClick={() => {
                        setIsDialogOpen(false);
                        setSearchParams({ tab: "onboarding", fromLead: selectedLead.id });
                        toast({
                          title: "Criar instituição",
                          description: "Preencha o formulário de onboarding com os dados do lead.",
                        });
                      }}
                      className="gap-2"
                    >
                      <Rocket className="h-4 w-4" />
                      Criar Instituição a partir do Lead
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() =>
                      handleUpdateLead(selectedLead.id, {
                        status: selectedLead.status,
                        notas: getLeadField(selectedLead, 'notas') || selectedLead.notas,
                      })
                    }
                    disabled={updating}
                  >
                    {updating ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
