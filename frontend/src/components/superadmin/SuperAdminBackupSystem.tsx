import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SmartSearch, SmartSearchItem } from '@/components/common/SmartSearch';
import { Download, RefreshCw, Clock, User, FileJson, AlertTriangle, Shield, Building2, Eye, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import { backupApi, instituicoesApi } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { safeToFixed } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { BackupAuditoriaTab } from './BackupAuditoriaTab';
import { TermoLegalModal } from '@/components/common/TermoLegalModal';
import axios from 'axios';

interface BackupHistory {
  id: string;
  user_email: string;
  tipo: string;
  status: string;
  tamanho_bytes: number | null;
  created_at: string;
  hash_sha256?: string | null;
  hash_verificado?: boolean;
  assinatura_digital?: string | null;
  algoritmo_assinatura?: string | null;
  assinatura_verificada?: boolean;
  criptografado?: boolean;
  algoritmo?: string | null;
  instituicao?: {
    id: string;
    nome: string;
  };
}

interface Instituicao {
  id: string;
  nome: string;
  subdominio?: string;
}

export const SuperAdminBackupSystem = () => {
  const [selectedInstituicao, setSelectedInstituicao] = useState<SmartSearchItem | null>(null);
  const [backupType, setBackupType] = useState<string>('completo');
  const [justificativa, setJustificativa] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showFinalConfirmDialog, setShowFinalConfirmDialog] = useState(false);
  const [showTermoModal, setShowTermoModal] = useState(false);
  const [backupIdParaRestore, setBackupIdParaRestore] = useState<string | null>(null);
  const [termoHtml, setTermoHtml] = useState<string>('');
  const [termoId, setTermoId] = useState<string | null>(null);

  useEffect(() => {
    fetchGlobalBackups();
  }, []);

  const fetchGlobalBackups = async () => {
    try {
      const data = await backupApi.getGlobalBackups({ limit: 100 });
      setBackupHistory(data || []);
    } catch (error) {
      console.error('Error fetching global backups:', error);
      toast.error('Erro ao buscar backups');
    }
  };

  // Função de busca para instituições
  const searchInstituicoes = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const instituicoes = await instituicoesApi.getAll({ status: 'ativa' });
      const searchLower = searchTerm.toLowerCase();
      const filtered = instituicoes.filter((inst: Instituicao) => {
        const nome = (inst.nome || '').toLowerCase();
        const subdominio = (inst.subdominio || '').toLowerCase();
        return nome.includes(searchLower) || subdominio.includes(searchLower);
      });

      return filtered.slice(0, 10).map((inst: Instituicao) => ({
        id: inst.id,
        nome: inst.nome,
        nomeCompleto: inst.nome,
        complemento: inst.subdominio || '',
      }));
    } catch (error) {
      console.error('Erro ao buscar instituições:', error);
      return [];
    }
  };

  const handleGenerateBackup = async () => {
    if (!selectedInstituicao) {
      toast.error('Selecione uma instituição');
      return;
    }

    if (!justificativa || justificativa.trim().length === 0) {
      toast.error('Justificativa é obrigatória para ações excepcionais');
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleConfirmBackup = () => {
    setShowConfirmDialog(false);
    setShowFinalConfirmDialog(true);
  };

  const handleFinalConfirmBackup = async () => {
    if (!selectedInstituicao) return;

    setShowFinalConfirmDialog(false);
    setIsGenerating(true);

    try {
      await backupApi.forcarBackup({
        instituicaoId: selectedInstituicao.id,
        tipo: backupType,
        justificativa: justificativa.trim(),
      });

      toast.success('Backup gerado com sucesso (ação excepcional)');
      setJustificativa('');
      setSelectedInstituicao(null);
      fetchGlobalBackups();
    } catch (error: unknown) {
      console.error('Backup error:', error);
      toast.error(`Erro ao gerar backup: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    if (!justificativa || justificativa.trim().length === 0) {
      toast.error('Justificativa é obrigatória para ações excepcionais');
      return;
    }

    // Buscar backup para obter instituicaoId
    const backup = backupHistory.find(b => b.id === backupId);
    if (!backup || !backup.instituicao?.id) {
      toast.error('Backup não encontrado ou sem instituição associada');
      return;
    }

    // Verificar termo legal
    try {
      const response = await axios.get(`/api/termos-legais/verificar/RESTORE_BACKUP`, {
        headers: {
          'X-Instituicao-Id': backup.instituicao.id,
        },
      });

      if (!response.data.aceito && response.data.termo) {
        // Exibir modal de termo
        setBackupIdParaRestore(backupId);
        setTermoHtml(response.data.termo.conteudoHtml || '');
        setTermoId(response.data.termoId || response.data.termo?.id || null);
        setShowTermoModal(true);
      } else {
        // Termo já aceito, prosseguir diretamente
        await executarRestore(backupId);
      }
    } catch (error: any) {
      // Se erro for TERMO_NAO_ACEITO, exibir modal
      if (error.response?.status === 403 && error.response?.data?.termo) {
        setBackupIdParaRestore(backupId);
        setTermoHtml(error.response.data.termo.conteudoHtml || '');
        setTermoId(error.response.data.termoId || error.response.data.termo?.id || null);
        setShowTermoModal(true);
      } else {
        console.error('Erro ao verificar termo:', error);
        toast.error('Erro ao verificar termo legal. Tente novamente.');
      }
    }
  };

  const executarRestore = async (backupId: string) => {
    if (!backupId) {
      toast.error('ID do backup não encontrado');
      return;
    }

    try {
      await backupApi.restaurarBackupExcepcional(backupId, {
        justificativa: justificativa.trim(),
      });

      toast.success('Backup restaurado com sucesso (ação excepcional)');
      setJustificativa('');
      setBackupIdParaRestore(null);
      fetchGlobalBackups();
    } catch (error: unknown) {
      console.error('Restore error:', error);
      
      // Verificar se é erro de termo não aceito (pode vir do controller)
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        const errorData = error.response.data;
        if (errorData?.error === 'TERMO_NAO_ACEITO' && errorData?.termo) {
          // Exibir modal de termo legal
          setBackupIdParaRestore(backupId);
          setTermoHtml(errorData.termo.conteudoHtml || '');
          setTermoId(errorData.termoId || errorData.termo?.id || null);
          setShowTermoModal(true);
          return;
        }
      }
      
      toast.error(`Erro ao restaurar backup: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleAceitarTermo = async () => {
    if (!backupIdParaRestore) {
      toast.error('ID do backup não encontrado');
      return;
    }

    await executarRestore(backupIdParaRestore);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${safeToFixed(bytes / 1024, 2)} KB`;
    return `${safeToFixed(bytes / (1024 * 1024), 2)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'concluido':
        return <Badge className="bg-green-500">Concluído</Badge>;
      case 'em_progresso':
        return <Badge className="bg-yellow-500">Em Progresso</Badge>;
      case 'erro':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Aviso Legal Fixo */}
      <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">
          ⚠️ Atenção: Ação Excepcional
        </AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          Você está executando uma ação técnica sobre dados institucionais. Toda ação é auditada
          e deve ser realizada apenas mediante autorização formal.
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <Tabs defaultValue="backup" className="space-y-4">
        <TabsList>
          <TabsTrigger value="backup">
            <Download className="h-4 w-4 mr-2" />
            Backup
          </TabsTrigger>
          <TabsTrigger value="auditoria">
            <Eye className="h-4 w-4 mr-2" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="space-y-6">
          {/* Gerar Backup */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-600" />
                Gerar Backup Excepcional
              </CardTitle>
              <CardDescription>
                Forçar geração de backup para uma instituição específica (SUPER_ADMIN apenas)
              </CardDescription>
            </div>
            <Badge variant="destructive" className="text-sm">
              AÇÃO EXCEPCIONAL
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seletor de Instituição */}
          <div className="space-y-2">
            <Label htmlFor="instituicao">
              Instituição <span className="text-destructive">*</span>
            </Label>
            <SmartSearch
              placeholder="Digite para buscar instituição..."
              selectedId={selectedInstituicao?.id}
              value={selectedInstituicao?.nome}
              onSelect={(item) => setSelectedInstituicao(item)}
              onClear={() => setSelectedInstituicao(null)}
              searchFn={searchInstituicoes}
              getDisplayName={(item) => item.nome || item.nomeCompleto || ''}
              getSubtitle={(item) => item.complemento || ''}
              required
            />
          </div>

          {/* Tipo de Backup */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Backup</Label>
            <Select value={backupType} onValueChange={setBackupType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completo">Backup Completo</SelectItem>
                <SelectItem value="dados">Somente Dados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Justificativa Obrigatória */}
          <div className="space-y-2">
            <Label htmlFor="justificativa">
              Justificativa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justificativa"
              placeholder="Descreva o motivo desta ação excepcional..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={4}
              required
              className="min-h-[100px]"
            />
            <p className="text-sm text-muted-foreground">
              Este campo é obrigatório para ações excepcionais do SUPER_ADMIN e será registrado na auditoria.
            </p>
          </div>

          {/* Botão Gerar */}
          <Button
            onClick={handleGenerateBackup}
            disabled={isGenerating || !selectedInstituicao || !justificativa.trim()}
            variant="destructive"
            className="w-full"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Gerando Backup...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Gerar Backup Excepcional
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Histórico Global */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Backups (Todas as Instituições)
          </CardTitle>
          <CardDescription>
            Visualização de todos os backups do sistema (somente leitura)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileJson className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum backup encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Criptografia</TableHead>
                  <TableHead>Integridade</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead>Realizado por</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backupHistory.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-medium">
                      {backup.instituicao?.nome || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(backup.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{backup.tipo}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(backup.status)}</TableCell>
                    <TableCell>{formatFileSize(backup.tamanho_bytes)}</TableCell>
                    <TableCell>
                      {backup.criptografado ? (
                        <div className="flex items-center gap-1" title={`🔒 Backup criptografado com ${backup.algoritmo || 'AES-256-GCM'}`}>
                          <Shield className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">🔒 Criptografado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1" title="Backup não criptografado (backup antigo)">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-600">Inseguro</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {backup.hash_sha256 ? (
                        backup.hash_verificado ? (
                          <div className="flex items-center gap-1" title="Integridade verificada via SHA-256">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600">Verificado</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1" title="Hash SHA-256 presente, aguardando verificação">
                            <Clock className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm text-yellow-600">Pendente</span>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center gap-1" title="Backup sem hash SHA-256 - inseguro">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-600">Inseguro</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {backup.assinatura_digital ? (
                        backup.assinatura_verificada ? (
                          <div className="flex items-center gap-1" title={`🔐 Backup assinado digitalmente (${backup.algoritmo_assinatura || 'RSA-SHA256'}). ✍️ Assinatura válida. 🧾 Auditoria OK.`}>
                            <ShieldCheck className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600">✍️ Assinado</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1" title={`Assinatura digital presente (${backup.algoritmo_assinatura || 'RSA-SHA256'}), aguardando verificação`}>
                            <Clock className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm text-yellow-600">Pendente</span>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center gap-1" title="Backup sem assinatura digital (backup antigo ou gerado antes da implementação)">
                          <span className="text-sm text-muted-foreground">-</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {backup.user_email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {backup.status === 'concluido' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRestore(backup.id)}
                          disabled={!justificativa.trim()}
                        >
                          Restaurar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="auditoria">
          <BackupAuditoriaTab />
        </TabsContent>
      </Tabs>

      {/* Dialog de Confirmação 1 */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirmar Ação Excepcional
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a gerar um backup excepcional para a instituição{' '}
              <strong>{selectedInstituicao?.nome}</strong>. Esta ação será registrada na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                Justificativa:
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {justificativa}
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBackup} className="bg-amber-600 hover:bg-amber-700">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Confirmação Final */}
      <AlertDialog open={showFinalConfirmDialog} onOpenChange={setShowFinalConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              Confirmação Final de Responsabilidade
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta é a confirmação final. Você confirma que:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Você tem autorização formal para esta ação</li>
              <li>A justificativa fornecida é verdadeira e completa</li>
              <li>Esta ação será registrada permanentemente na auditoria</li>
              <li>Você assume total responsabilidade por esta ação</li>
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalConfirmBackup}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar Responsabilidade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ENTERPRISE: Modal de Termo Legal para Restore */}
      <TermoLegalModal
        open={showTermoModal}
        onClose={() => {
          setShowTermoModal(false);
          setBackupIdParaRestore(null);
          setTermoHtml('');
          setTermoId(null);
        }}
        termoHtml={termoHtml}
        onAccept={handleAceitarTermo}
        termo={termoId ? { id: termoId, tipoAcao: 'RESTORE_BACKUP', titulo: 'Termo de Responsabilidade', conteudoHtml: termoHtml, versao: 1 } : null}
      />
    </div>
  );
};

