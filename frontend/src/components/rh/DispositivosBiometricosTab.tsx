import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, RefreshCw, Wifi, WifiOff, Key, Loader2, Users, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useAuth } from '@/contexts/AuthContext';
import { isStaffWithFallback } from '@/utils/roleLabels';
import { dispositivosBiometricosApi, zktecoApi } from '@/services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DispositivoBiometrico {
  id: string;
  nome: string;
  tipo: 'ZKTECO' | 'HIKVISION' | 'SUPREMA';
  ip: string;
  porta: number;
  ativo: boolean;
  ultimoStatus?: string | null;
  ultimaSincronizacao?: string | null;
  observacoes?: string | null;
  _count?: {
    eventos: number;
  };
  instituicao?: {
    id: string;
    nome: string;
  };
}

export const DispositivosBiometricosTab = () => {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [editingDispositivo, setEditingDispositivo] = useState<DispositivoBiometrico | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tokenDispositivo, setTokenDispositivo] = useState<{ id: string; nome: string; token: string } | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'ZKTECO' as 'ZKTECO' | 'HIKVISION' | 'SUPREMA',
    ip: '',
    porta: 4370,
    ipsPermitidos: [] as string[],
    observacoes: '',
    ativo: true,
  });

  const [newIp, setNewIp] = useState('');

  // Buscar dispositivos
  const { data: dispositivos = [], isLoading } = useQuery({
    queryKey: ['dispositivos-biometricos', instituicaoId],
    queryFn: async () => {
      return await dispositivosBiometricosApi.getAll({});
    },
    enabled: !!instituicaoId || isSuperAdmin || isStaffWithFallback(role),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => dispositivosBiometricosApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispositivos-biometricos'] });
      toast({
        title: 'Sucesso',
        description: 'Dispositivo criado com sucesso',
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao criar dispositivo',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      dispositivosBiometricosApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispositivos-biometricos'] });
      toast({
        title: 'Sucesso',
        description: 'Dispositivo atualizado com sucesso',
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao atualizar dispositivo',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dispositivosBiometricosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispositivos-biometricos'] });
      toast({
        title: 'Sucesso',
        description: 'Dispositivo excluído com sucesso',
      });
      setShowDeleteDialog(false);
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao excluir dispositivo',
        variant: 'destructive',
      });
    },
  });

  const regenerateTokenMutation = useMutation({
    mutationFn: (id: string) => dispositivosBiometricosApi.regenerateToken(id),
    onSuccess: (data) => {
      setTokenDispositivo({
        id: data.id,
        nome: data.nome,
        token: data.token,
      });
      setShowTokenDialog(true);
      queryClient.invalidateQueries({ queryKey: ['dispositivos-biometricos'] });
      toast({
        title: 'Token regenerado',
        description: 'Novo token gerado com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao regenerar token',
        variant: 'destructive',
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: (id: string) => dispositivosBiometricosApi.testConnection(id),
    onSuccess: (data) => {
      toast({
        title: data.success ? 'Conexão OK' : 'Conexão Falhou',
        description: data.mensagem || data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['dispositivos-biometricos'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao testar conexão',
        variant: 'destructive',
      });
    },
  });

  // Mutations específicas para ZKTeco
  const sincronizarFuncionariosMutation = useMutation({
    mutationFn: (id: string) => zktecoApi.sincronizarFuncionarios(id),
    onSuccess: (data) => {
      toast({
        title: 'Sincronização concluída',
        description: `${data.sucesso} funcionários sincronizados com sucesso${data.falhas > 0 ? `. ${data.falhas} falhas.` : '.'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['dispositivos-biometricos'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao sincronizar funcionários',
        variant: 'destructive',
      });
    },
  });

  const sincronizarLogsMutation = useMutation({
    mutationFn: ({ id, dataInicio, dataFim }: { id: string; dataInicio?: string; dataFim?: string }) =>
      zktecoApi.sincronizarLogs(id, dataInicio, dataFim),
    onSuccess: (data) => {
      toast({
        title: 'Logs sincronizados',
        description: `${data.importados} eventos importados${data.ignorados > 0 ? `. ${data.ignorados} duplicados ignorados.` : '.'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['dispositivos-biometricos'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.message || 'Erro ao sincronizar logs',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo: 'ZKTECO',
      ip: '',
      porta: 4370,
      ipsPermitidos: [],
      observacoes: '',
      ativo: true,
    });
    setEditingDispositivo(null);
    setNewIp('');
    setShowDialog(false);
  };

  const handleEdit = (dispositivo: DispositivoBiometrico) => {
    setEditingDispositivo(dispositivo);
    setFormData({
      nome: dispositivo.nome,
      tipo: dispositivo.tipo,
      ip: dispositivo.ip,
      porta: dispositivo.porta,
      ipsPermitidos: (dispositivo as any).ipsPermitidos || [],
      observacoes: dispositivo.observacoes || '',
      ativo: dispositivo.ativo,
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.nome || !formData.ip) {
      toast({
        title: 'Erro',
        description: 'Nome e IP são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (editingDispositivo) {
      updateMutation.mutate({ id: editingDispositivo.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const addIpPermitido = () => {
    if (newIp && !formData.ipsPermitidos.includes(newIp)) {
      setFormData({
        ...formData,
        ipsPermitidos: [...formData.ipsPermitidos, newIp],
      });
      setNewIp('');
    }
  };

  const removeIpPermitido = (ip: string) => {
    setFormData({
      ...formData,
      ipsPermitidos: formData.ipsPermitidos.filter((i) => i !== ip),
    });
  };

  const getTipoLabel = (tipo: string) => {
    const labels: { [key: string]: string } = {
      ZKTECO: 'ZKTeco',
      HIKVISION: 'Hikvision',
      SUPREMA: 'Suprema',
    };
    return labels[tipo] || tipo;
  };

  const getStatusBadge = (status?: string | null) => {
    if (status === 'online') {
      return (
        <Badge variant="default" className="bg-green-500">
          <Wifi className="h-3 w-3 mr-1" />
          Online
        </Badge>
      );
    }
    if (status === 'offline') {
      return (
        <Badge variant="secondary">
          <WifiOff className="h-3 w-3 mr-1" />
          Offline
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <WifiOff className="h-3 w-3 mr-1" />
        Desconhecido
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Dispositivos Biométricos</CardTitle>
              <CardDescription>
                Gerencie os dispositivos biométricos conectados ao sistema
              </CardDescription>
            </div>
            <Button onClick={() => { resetForm(); setShowDialog(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Dispositivo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando dispositivos...</div>
          ) : dispositivos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Nenhum dispositivo cadastrado</p>
              <Button onClick={() => { resetForm(); setShowDialog(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Primeiro Dispositivo
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>IP / Porta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Sincronização</TableHead>
                    <TableHead>Eventos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispositivos.map((dispositivo: DispositivoBiometrico) => (
                    <TableRow key={dispositivo.id}>
                      <TableCell className="font-medium">{dispositivo.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTipoLabel(dispositivo.tipo)}</Badge>
                      </TableCell>
                      <TableCell>
                        {dispositivo.ip}:{dispositivo.porta}
                      </TableCell>
                      <TableCell>{getStatusBadge(dispositivo.ultimoStatus)}</TableCell>
                      <TableCell>
                        {dispositivo.ultimaSincronizacao
                          ? format(new Date(dispositivo.ultimaSincronizacao), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>{dispositivo._count?.eventos || 0}</TableCell>
                      <TableCell>
                        {dispositivo.ativo ? (
                          <Badge variant="default">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => testConnectionMutation.mutate(dispositivo.id)}
                            disabled={testConnectionMutation.isPending}
                            title="Testar Conexão"
                          >
                            {testConnectionMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          {dispositivo.tipo === 'ZKTECO' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sincronizarFuncionariosMutation.mutate(dispositivo.id)}
                                disabled={sincronizarFuncionariosMutation.isPending}
                                title="Sincronizar Funcionários"
                              >
                                {sincronizarFuncionariosMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Users className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sincronizarLogsMutation.mutate({ id: dispositivo.id })}
                                disabled={sincronizarLogsMutation.isPending}
                                title="Sincronizar Logs"
                              >
                                {sincronizarLogsMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => regenerateTokenMutation.mutate(dispositivo.id)}
                            disabled={regenerateTokenMutation.isPending}
                            title="Regenerar Token"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(dispositivo)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDeletingId(dispositivo.id);
                              setShowDeleteDialog(true);
                            }}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Criar/Editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDispositivo ? 'Editar Dispositivo' : 'Novo Dispositivo Biométrico'}
            </DialogTitle>
            <DialogDescription>
              {editingDispositivo
                ? 'Atualize as informações do dispositivo'
                : 'Configure um novo dispositivo biométrico para integração'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Biometria Portaria Principal"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: any) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZKTECO">ZKTeco</SelectItem>
                    <SelectItem value="HIKVISION">Hikvision</SelectItem>
                    <SelectItem value="SUPREMA">Suprema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>IP *</Label>
                <Input
                  value={formData.ip}
                  onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                  placeholder="192.168.1.100"
                />
              </div>
              <div className="space-y-2">
                <Label>Porta</Label>
                <Input
                  type="number"
                  value={formData.porta}
                  onChange={(e) => setFormData({ ...formData, porta: parseInt(e.target.value) || 4370 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>IPs Permitidos (Whitelist)</Label>
              <div className="flex gap-2">
                <Input
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="192.168.1.100"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addIpPermitido();
                    }
                  }}
                />
                <Button type="button" onClick={addIpPermitido} variant="outline">
                  Adicionar
                </Button>
              </div>
              {formData.ipsPermitidos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.ipsPermitidos.map((ip) => (
                    <Badge key={ip} variant="secondary" className="flex items-center gap-1">
                      {ip}
                      <button
                        type="button"
                        onClick={() => removeIpPermitido(ip)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Deixe vazio para aceitar de qualquer IP. Adicione IPs específicos para maior segurança.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                placeholder="Informações adicionais sobre o dispositivo..."
              />
            </div>

            {editingDispositivo && (
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={formData.ativo ? 'true' : 'false'}
                  onValueChange={(value) => setFormData({ ...formData, ativo: value === 'true' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativo</SelectItem>
                    <SelectItem value="false">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : editingDispositivo ? (
                'Atualizar'
              ) : (
                'Criar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Token */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token do Dispositivo</DialogTitle>
            <DialogDescription>
              Copie este token e configure no serviço de integração. Ele não será mostrado novamente.
            </DialogDescription>
          </DialogHeader>
          {tokenDispositivo && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Dispositivo</Label>
                <p className="font-medium">{tokenDispositivo.nome}</p>
              </div>
              <div className="space-y-2">
                <Label>Token</Label>
                <div className="flex gap-2">
                  <Input value={tokenDispositivo.token} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(tokenDispositivo.token);
                      toast({
                        title: 'Token copiado',
                        description: 'Token copiado para a área de transferência',
                      });
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowTokenDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este dispositivo? Todos os eventos associados serão mantidos,
              mas o dispositivo não poderá mais enviar novos eventos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId) {
                  deleteMutation.mutate(deletingId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

