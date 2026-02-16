import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, RefreshCw, Database, Image, Package, Clock, User, FileJson, Upload, AlertTriangle, CheckCircle, XCircle, RotateCcw, Calendar, Shield, ShieldCheck, Loader2 } from 'lucide-react';
import { BackupScheduler } from './BackupScheduler';
import { TermoLegalModal } from '@/components/common/TermoLegalModal';
import { backupApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { safeToFixed } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';

interface BackupHistory {
  id: string;
  user_email: string;
  tipo: string;
  status: string;
  tamanho_bytes: number | null;
  created_at: string;
  criptografado?: boolean;
  algoritmo?: string | null;
  hash_sha256?: string | null;
  hash_verificado?: boolean;
  assinatura_digital?: string | null;
  algoritmo_assinatura?: string | null;
  assinatura_verificada?: boolean;
}

interface RestoreResult {
  success: number;
  errors: number;
  messages: string[];
}

interface BackupMetadata {
  backup_id: string;
  generated_at: string;
  generated_by: string;
  tipo: string;
  instituicao_id?: string;
}

export const BackupSystem = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupType, setBackupType] = useState<string>('completo');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);
  const [lastBackup, setLastBackup] = useState<BackupHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  
  // Restore state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<{ metadata: BackupMetadata; tables: string[] } | null>(null);
  const [restoreOptions, setRestoreOptions] = useState({
    overwrite: false,
    skipExisting: true,
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [restoreResults, setRestoreResults] = useState<Record<string, RestoreResult> | null>(null);
  
  // Termo Legal Modal state
  const [termoModalOpen, setTermoModalOpen] = useState(false);
  const [termoLegal, setTermoLegal] = useState<any>(null);
  const [pendingRestore, setPendingRestore] = useState<boolean>(false);

  useEffect(() => {
    fetchBackupHistory();
  }, []);

  const fetchBackupHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await backupApi.getHistory();
      setBackupHistory(data || []);
      if (data && data.length > 0) {
        setLastBackup(data[0]);
      } else {
        setLastBackup(null);
      }
    } catch (error) {
      console.error('Error fetching backup history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleGenerateBackup = async () => {
    setIsGenerating(true);
    try {
      const response = await backupApi.generate({ tipo: backupType });
      // Backend retorna 202 - backup executa em background
      const backupId = response?.id;
      toast.success('Backup iniciado! O processamento está em andamento. Atualize o histórico em alguns segundos.');
      fetchBackupHistory();
      // Poll para atualizar quando concluir
      if (backupId) {
        const pollInterval = setInterval(() => {
          fetchBackupHistory();
        }, 3000);
        setTimeout(() => clearInterval(pollInterval), 60000);
      }
    } catch (error: unknown) {
      console.error('Backup error:', error);
      toast.error(`Erro ao gerar backup: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileAccepted = async (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      toast.error('Por favor, selecione um arquivo JSON válido.');
      return;
    }
    try {
      const content = await file.text();
      const data = JSON.parse(content);
      if (!data.metadata) {
        toast.error('Arquivo de backup inválido. Metadados não encontrados.');
        return;
      }
      const tables = Object.keys(data).filter(key => key !== 'metadata' && key !== 'storage_files');
      setSelectedFile(file);
      setBackupPreview({ metadata: data.metadata, tables });
      setRestoreResults(null);
    } catch (e) {
      toast.error('Erro ao ler o arquivo. Verifique se é um JSON válido.');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileAccepted(file);
    event.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileAccepted(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const executeRestore = async () => {
    if (!selectedFile) return;

    setIsRestoring(true);

    try {
      const content = await selectedFile.text();
      const backupData = JSON.parse(content);

      // VALIDAÇÃO: Verificar se o backup tem metadata e instituicao_id
      if (!backupData.metadata || !backupData.metadata.instituicao_id) {
        toast.error('Arquivo de backup inválido: metadados não encontrados.');
        setIsRestoring(false);
        return;
      }

      // NOTA: A validação de instituição será feita no backend
      // O frontend apenas exibe um aviso se detectar que pode ser de outra instituição
      
      const response = await backupApi.restore({ backupData, options: restoreOptions });

      setRestoreResults(response.results);
      toast.success('Restauração concluída!');
      fetchBackupHistory();
    } catch (error: unknown) {
      console.error('Restore error:', error);
      
      // Verificar se é erro de termo não aceito
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        const errorData = error.response.data;
        if (errorData?.error === 'TERMO_NAO_ACEITO' && errorData?.termo) {
          // Exibir modal de termo legal
          setTermoLegal(errorData.termo);
          setTermoModalOpen(true);
          setPendingRestore(true);
          setIsRestoring(false);
          return;
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Verificar se é erro de instituição diferente
      if (errorMessage.includes('outra instituição') || errorMessage.includes('instituição')) {
        toast.error('Erro de segurança: Este backup pertence a outra instituição e não pode ser restaurado.');
      } else {
        toast.error(`Erro ao restaurar backup: ${errorMessage}`);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestore = async () => {
    setShowConfirmDialog(false);
    await executeRestore();
  };

  const handleAceitarTermo = async () => {
    setTermoModalOpen(false);
    setTermoLegal(null);
    
    // Executar restore pendente após aceitar termo
    if (pendingRestore) {
      setPendingRestore(false);
      await executeRestore();
    }
  };

  const clearRestore = () => {
    setSelectedFile(null);
    setBackupPreview(null);
    setRestoreResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      case 'restauracao':
        return <Badge className="bg-blue-500">Restauração</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeIcon = (tipo: string) => {
    switch (tipo) {
      case 'dados':
        return <Database className="h-4 w-4" />;
      case 'arquivos':
        return <Image className="h-4 w-4" />;
      case 'completo':
        return <Package className="h-4 w-4" />;
      case 'restauracao':
        return <RotateCcw className="h-4 w-4" />;
      default:
        return <FileJson className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="backup" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Gerar Backup
          </TabsTrigger>
          <TabsTrigger value="restore" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Restaurar
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Agendamento
          </TabsTrigger>
        </TabsList>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Backup da sua Instituição
              </CardTitle>
              <CardDescription>
                Cada instituição possui seu próprio backup isolado. Gere e restaure backups exclusivamente dos dados da sua instituição.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lastBackup && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Clock className="h-4 w-4" />
                    Último backup realizado
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span><strong>Data/Hora:</strong> {format(new Date(lastBackup.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</span>
                    <span><strong>Tipo:</strong> {lastBackup.tipo}</span>
                    <span><strong>Tamanho:</strong> {formatFileSize(lastBackup.tamanho_bytes)}</span>
                    <span><strong>Por:</strong> {lastBackup.user_email}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Tipo de Backup</label>
                  <Select value={backupType} onValueChange={setBackupType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dados">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Somente Dados
                        </div>
                      </SelectItem>
                      <SelectItem value="arquivos">
                        <div className="flex items-center gap-2">
                          <Image className="h-4 w-4" />
                          Somente Arquivos
                        </div>
                      </SelectItem>
                      <SelectItem value="completo">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Backup Completo
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleGenerateBackup} 
                    disabled={isGenerating}
                    className="w-full sm:w-auto"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Gerar Backup
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <Database className="h-4 w-4 text-blue-500" />
                    Somente Dados
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Exporta todos os registros do banco de dados: alunos, professores, notas, pagamentos, etc.
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <Image className="h-4 w-4 text-green-500" />
                    Somente Arquivos
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Exporta lista de arquivos armazenados: logos, avatares, documentos de alunos.
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <Package className="h-4 w-4 text-purple-500" />
                    Backup Completo
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Inclui todos os dados e lista de arquivos em um único backup.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Restore Tab */}
        <TabsContent value="restore" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Restaurar Backup da Instituição
              </CardTitle>
              <CardDescription>
                Restaure dados da sua instituição a partir de um arquivo de backup. Só é permitido restaurar backups gerados pela sua própria instituição.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  A restauração de backup pode sobrescrever dados existentes. Certifique-se de ter um backup atual antes de prosseguir.
                </AlertDescription>
              </Alert>

              {/* File Upload - Área profissional com drag & drop */}
              <div className="space-y-4">
                <Label>Arquivo de Backup (JSON)</Label>
                <input
                  ref={fileInputRef}
                  id="backup-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                    ${isDragging 
                      ? 'border-primary bg-primary/5 scale-[1.01]' 
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                    }
                  `}
                >
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileJson className="h-12 w-12 text-primary" />
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); clearRestore(); }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Remover arquivo
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="font-medium">
                        {isDragging ? 'Solte o arquivo aqui' : 'Arraste o arquivo JSON ou clique para selecionar'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Apenas arquivos de backup da sua instituição podem ser restaurados
                      </p>
                    </>
                  )}
                </div>

                {/* Backup Preview */}
                {backupPreview && (
                  <div className="p-4 border rounded-lg space-y-4">
                    <h4 className="font-medium">Informações do Backup</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Data de Criação:</span>
                        <p className="font-medium">
                          {format(new Date(backupPreview.metadata.generated_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Criado por:</span>
                        <p className="font-medium">{backupPreview.metadata.generated_by}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tipo:</span>
                        <p className="font-medium capitalize">{backupPreview.metadata.tipo}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tabelas:</span>
                        <p className="font-medium">{backupPreview.tables.length} tabelas</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-sm text-muted-foreground">Tabelas incluídas:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {backupPreview.tables.map(table => (
                          <Badge key={table} variant="secondary">{table}</Badge>
                        ))}
                      </div>
                    </div>

                    {/* Restore Options */}
                    <div className="space-y-3 pt-4 border-t">
                      <h4 className="font-medium">Opções de Restauração</h4>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="skip-existing"
                          checked={restoreOptions.skipExisting}
                          onCheckedChange={(checked) => 
                            setRestoreOptions(prev => ({ ...prev, skipExisting: !!checked, overwrite: false }))
                          }
                        />
                        <Label htmlFor="skip-existing">Ignorar registros existentes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="overwrite"
                          checked={restoreOptions.overwrite}
                          onCheckedChange={(checked) => 
                            setRestoreOptions(prev => ({ ...prev, overwrite: !!checked, skipExisting: false }))
                          }
                        />
                        <Label htmlFor="overwrite">Sobrescrever registros existentes</Label>
                      </div>
                    </div>

                    <Button 
                      onClick={() => setShowConfirmDialog(true)} 
                      className="w-full"
                      disabled={isRestoring}
                    >
                      {isRestoring ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Restaurando...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Iniciar Restauração
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Restore Results */}
                {restoreResults && (
                  <div className="p-4 border rounded-lg space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Resultados da Restauração
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tabela</TableHead>
                          <TableHead>Sucesso</TableHead>
                          <TableHead>Erros</TableHead>
                          <TableHead>Mensagens</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(restoreResults).map(([table, result]) => (
                          <TableRow key={table}>
                            <TableCell className="font-medium">{table}</TableCell>
                            <TableCell>
                              <Badge className="bg-green-500">{result.success}</Badge>
                            </TableCell>
                            <TableCell>
                              {result.errors > 0 ? (
                                <Badge variant="destructive">{result.errors}</Badge>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {result.messages.slice(0, 2).join(', ')}
                              {result.messages.length > 2 && '...'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <BackupScheduler />
        </TabsContent>
      </Tabs>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Histórico de Backups da Instituição
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => fetchBackupHistory()} disabled={historyLoading}>
              {historyLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              <div className="flex gap-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-16" />
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : backupHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileJson className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum backup realizado ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Criptografia</TableHead>
                  <TableHead>Integridade</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead>Realizado por</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backupHistory.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell>
                      {format(new Date(backup.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(backup.tipo)}
                        <span className="capitalize">{backup.tipo}</span>
                      </div>
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
                          <div className="flex items-center gap-1" title="🔐 Integridade verificada via SHA-256">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600">🔐 Verificado</span>
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
                      {backup.status === 'concluido' && backup.tamanho_bytes ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await backupApi.download(backup.id);
                              toast.success('Download iniciado');
                            } catch (e) {
                              toast.error('Erro ao baixar backup');
                            }
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : backup.status === 'em_progresso' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Termo Legal Modal */}
      <TermoLegalModal
        open={termoModalOpen}
        termo={termoLegal}
        onAceitar={handleAceitarTermo}
        onClose={() => {
          setTermoModalOpen(false);
          setTermoLegal(null);
          setPendingRestore(false);
        }}
      />

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Restauração</DialogTitle>
            <DialogDescription>
              Você está prestes a restaurar dados do backup. Esta ação pode afetar dados existentes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              <strong>Opção selecionada:</strong>{' '}
              {restoreOptions.overwrite ? 'Sobrescrever registros existentes' : 'Ignorar registros existentes'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRestore} variant="destructive">
              Confirmar Restauração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
