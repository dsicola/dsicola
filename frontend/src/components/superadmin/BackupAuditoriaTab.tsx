import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logsAuditoriaApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Shield, Eye, Download, Calendar, Search, Filter } from 'lucide-react';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { DetalhesAuditoriaDialog } from '@/components/auditoria/DetalhesAuditoriaDialog';
import { toast } from 'sonner';

interface LogAuditoria {
  id: string;
  instituicaoId?: string | null;
  modulo?: string | null;
  entidade?: string | null;
  entidadeId?: string | null;
  acao: string;
  dadosAnteriores?: any;
  dadosNovos?: any;
  userId?: string | null;
  perfilUsuario?: string | null;
  rota?: string | null;
  ipOrigem?: string | null;
  userAgent?: string | null;
  observacao?: string | null;
  createdAt: string;
  userEmail?: string | null;
  userNome?: string | null;
  instituicao?: {
    id: string;
    nome: string;
  } | null;
}

const acoesLabels: { [key: string]: string } = {
  GENERATE: 'Gerar Backup',
  RESTORE_STARTED: 'Início de Restauração',
  RESTORE_COMPLETED: 'Restauração Concluída',
  RESTORE_FAILED: 'Restauração Falhou',
  FORCE_GENERATE: 'Backup Forçado (Excepcional)',
  RESTORE_EXCEPCIONAL_STARTED: 'Restauração Excepcional Iniciada',
  RESTORE_EXCEPCIONAL_COMPLETED: 'Restauração Excepcional Concluída',
  RESTORE_EXCEPCIONAL_FAILED: 'Restauração Excepcional Falhou',
  VIEW_GLOBAL: 'Visualização Global',
  BACKUP_DOWNLOADED: 'Backup Baixado',
  BLOCK_BACKUP_ACCESS: 'Acesso Bloqueado',
  BLOCK_RESTORE: 'Restauração Bloqueada',
};

export const BackupAuditoriaTab = () => {
  const [instituicaoIdFilter, setInstituicaoIdFilter] = useState<string>('');
  const [acaoFilter, setAcaoFilter] = useState<string>('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [showDetalhesDialog, setShowDetalhesDialog] = useSafeDialog(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['backup-auditoria', instituicaoIdFilter, acaoFilter, dataInicio, dataFim],
    queryFn: async () => {
      const params: any = {
        modulo: 'BACKUP',
        limit: 500,
      };
      if (instituicaoIdFilter) params.instituicaoId = instituicaoIdFilter;
      if (acaoFilter !== 'all') params.acao = acaoFilter;
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      const data = await logsAuditoriaApi.getAll(params);
      return data as LogAuditoria[];
    },
  });

  const filteredLogs = logs?.filter((log) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.userNome?.toLowerCase().includes(searchLower) ||
      log.userEmail?.toLowerCase().includes(searchLower) ||
      log.acao.toLowerCase().includes(searchLower) ||
      log.instituicao?.nome?.toLowerCase().includes(searchLower) ||
      log.observacao?.toLowerCase().includes(searchLower)
    );
  });

  const getAcaoBadgeVariant = (acao: string) => {
    const acaoLower = acao.toLowerCase();
    if (acaoLower.includes('generate') || acaoLower.includes('completed')) {
      return 'default';
    }
    if (acaoLower.includes('failed') || acaoLower.includes('block')) {
      return 'destructive';
    }
    if (acaoLower.includes('excepcional') || acaoLower.includes('force')) {
      return 'outline';
    }
    return 'secondary';
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return format(date, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.append('dataInicio', dataInicio);
      if (dataFim) params.append('dataFim', dataFim);
      if (acaoFilter !== 'all') params.append('operacao', acaoFilter);
      
      const url = `/api/backup/audit/export?${params.toString()}`;
      window.open(url, '_blank');
      toast.success('PDF gerado com sucesso');
    } catch (error) {
      toast.error('Erro ao exportar PDF');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Auditoria de Backups
              </CardTitle>
              <CardDescription>
                Visualização de todas as ações de backup e restauração (SUPER_ADMIN)
              </CardDescription>
            </div>
            <Button onClick={handleExportPDF} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div>
              <Select value={acaoFilter} onValueChange={setAcaoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="GENERATE">Gerar Backup</SelectItem>
                  <SelectItem value="FORCE_GENERATE">Backup Forçado</SelectItem>
                  <SelectItem value="RESTORE_STARTED">Início Restauração</SelectItem>
                  <SelectItem value="RESTORE_COMPLETED">Restauração Concluída</SelectItem>
                  <SelectItem value="RESTORE_FAILED">Restauração Falhou</SelectItem>
                  <SelectItem value="RESTORE_EXCEPCIONAL_STARTED">Restauração Excepcional</SelectItem>
                  <SelectItem value="BACKUP_DOWNLOADED">Backup Baixado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              type="date"
              placeholder="Data inicial"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <Input
              type="date"
              placeholder="Data final"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          {/* Tabela */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Instituição</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead className="text-right">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.userNome || log.userEmail || 'Sistema'}</div>
                          {log.perfilUsuario && (
                            <div className="text-xs text-muted-foreground">{log.perfilUsuario}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.instituicao?.nome || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getAcaoBadgeVariant(log.acao)}>
                          {acoesLabels[log.acao] || log.acao}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.observacao || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedLogId(log.id);
                            setShowDetalhesDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log de auditoria encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <DetalhesAuditoriaDialog
        logId={selectedLogId}
        open={showDetalhesDialog}
        onOpenChange={setShowDetalhesDialog}
      />
    </div>
  );
};

