import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { 
  Search, 
  KeyRound, 
  User, 
  Mail, 
  Shield, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Check,
  Loader2,
  History,
  AlertTriangle
} from 'lucide-react';
import { PasswordStrengthIndicator, isPasswordStrong } from '@/components/auth/PasswordStrengthIndicator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { profilesApi, logsRedefinicaoSenhaApi, authApi } from '@/services/api';
import { getRoleLabel } from '@/utils/roleLabels';

interface UserWithRole {
  id: string;
  nome_completo: string;
  email: string;
  avatar_url: string | null;
  numero_identificacao: string | null;
  instituicao_id: string | null;
  role: string | null;
}

const RedefinirSenha: React.FC = () => {
  const { user: adminUser, role: currentRole } = useAuth();
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sendByEmail, setSendByEmail] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [securityAlert, setSecurityAlert] = useState<{ show: boolean; count: number }>({ show: false, count: 0 });

  // Check for sequential password resets (last 30 minutes)
  const { data: recentResets, refetch: refetchRecentResets } = useQuery({
    queryKey: ['recent-password-resets', adminUser?.id],
    queryFn: async () => {
      if (!adminUser?.id) return [];
      const data = await logsRedefinicaoSenhaApi.getRecent(adminUser.id);
      return data || [];
    },
    enabled: !!adminUser?.id,
    refetchInterval: 60000,
  });

  // Show security alert if more than 3 resets in 30 minutes
  React.useEffect(() => {
    if (recentResets && recentResets.length >= 3) {
      setSecurityAlert({ show: true, count: recentResets.length });
    } else {
      setSecurityAlert({ show: false, count: 0 });
    }
  }, [recentResets]);

  // Fetch users with roles
  const { data: users, isLoading } = useQuery({
    queryKey: ['users-for-password-reset', instituicaoId, searchTerm, roleFilter, isSuperAdmin],
    queryFn: async () => {
      // Super admin vê todos os usuários (não passa instituicaoId)
      // Outros usuários veem apenas da sua instituição
      const profiles = await profilesApi.getAll({ 
        instituicaoId: shouldFilter && instituicaoId ? instituicaoId : undefined,
        search: searchTerm || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined
      });
      
      return profiles.map((p: any) => {
        // Usar role principal se disponível, senão pegar a primeira role do array
        const primaryRole = p.role || (Array.isArray(p.roles) && p.roles.length > 0 ? p.roles[0] : null);
        return {
          id: p.id,
          nome_completo: p.nome_completo,
          email: p.email,
          avatar_url: p.avatar_url,
          numero_identificacao: p.numero_identificacao,
          instituicao_id: p.instituicao_id,
          role: primaryRole,
          all_roles: Array.isArray(p.roles) ? p.roles : [], // Todas as roles para referência
        };
      }).filter((p: any) => p.role !== null) as UserWithRole[];
    },
    enabled: !!instituicaoId || !shouldFilter,
  });

  // Fetch password reset logs
  const { data: logs, refetch: refetchLogs } = useQuery({
    queryKey: ['password-reset-logs'],
    queryFn: async () => {
      const data = await logsRedefinicaoSenhaApi.getAll();
      return data;
    },
  });

  const generateSecurePassword = () => {
    const length = 12;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + special;
    
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }
    
    setNewPassword(passwordArray.join(''));
  };

  // Verificar se a role do usuário exige senha forte
  const requiresStrongPassword = selectedUser && ['ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN', 'POS'].includes(selectedUser.role || '');

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) {
      toast({
        title: "Erro",
        description: "Selecione um usuário e defina uma senha.",
        variant: "destructive",
      });
      return;
    }

    // Validar senha forte se necessário
    if (requiresStrongPassword && !isPasswordStrong(newPassword, true)) {
      toast({
        title: "Erro",
        description: "A senha deve conter pelo menos uma letra maiúscula e um caractere especial.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter no mínimo 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      await authApi.resetUserPassword(
        selectedUser.id,
        newPassword,
        sendByEmail
      );

      toast({
        title: "Sucesso",
        description: `Senha de ${selectedUser.nome_completo} redefinida com sucesso!${sendByEmail ? ' E-mail enviado.' : ''}`,
      });

      setShowModal(false);
      setSelectedUser(null);
      setNewPassword('');
      setSendByEmail(false);
      refetchLogs();
      refetchRecentResets();
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: "Erro ao redefinir senha",
        description: error.message || 'Ocorreu um erro inesperado.',
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };


  const getRoleBadgeVariant = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      ADMIN: 'destructive',
      PROFESSOR: 'default',
      ALUNO: 'secondary',
      SECRETARIA: 'outline',
      POS: 'outline',
    };
    return variants[role] || 'secondary';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6" />
            🔐 Redefinir Senha
          </h1>
          <p className="text-muted-foreground">
            Redefina a senha de usuários do sistema
          </p>
        </div>

        {/* Security Alert for Sequential Resets */}
        {securityAlert.show && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Alerta de Segurança</h3>
              <p className="text-sm text-destructive/90">
                Você realizou {securityAlert.count} redefinições de senha nos últimos 30 minutos. 
                Redefinições frequentes podem indicar atividade suspeita. Todas as ações estão sendo registradas.
              </p>
            </div>
          </div>
        )}

        {/* Security Info */}
        <Card className="bg-muted/50 border-muted">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Informações de Segurança:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Senhas são armazenadas com criptografia segura (bcrypt)</li>
                  <li>Nunca é possível visualizar a senha atual de nenhum usuário</li>
                  <li>Todas as redefinições são registradas com data, hora e responsável</li>
                  <li>Usuários também podem redefinir sua senha via "Esqueci minha senha"</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="redefinir" className="w-full">
          <TabsList>
            <TabsTrigger value="redefinir">Redefinir Senha</TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-4 w-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="redefinir" className="space-y-4">
            {/* Search and Filter */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Buscar Usuário</CardTitle>
                <CardDescription>
                  Pesquise por nome, e-mail, número de matrícula ou filtre por cargo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, e-mail ou nº de matrícula..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full md:w-[200px]">
                      <SelectValue placeholder="Filtrar por cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os cargos</SelectItem>
                      <SelectItem value="ALUNO">Aluno</SelectItem>
                      <SelectItem value="PROFESSOR">Professor</SelectItem>
                      <SelectItem value="SECRETARIA">Secretaria</SelectItem>
                      <SelectItem value="POS">POS</SelectItem>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                      {isSuperAdmin && (
                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Usuários Encontrados</CardTitle>
                <CardDescription>
                  {users?.length || 0} usuário(s) encontrado(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : users && users.length > 0 ? (
                  <div className="space-y-3">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:bg-muted/50 ${
                          selectedUser?.id === user.id ? 'ring-2 ring-primary bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(user.nome_completo)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{user.nome_completo}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{user.email}</span>
                          </div>
                          {user.numero_identificacao && (
                            <p className="text-xs text-muted-foreground">
                              Matrícula: {user.numero_identificacao}
                            </p>
                          )}
                        </div>
                        {user.role && (
                          <div className="flex items-center gap-2">
                            <Badge variant={getRoleBadgeVariant(user.role)}>
                              {getRoleLabel(user.role)}
                            </Badge>
                            {/* Mostrar outras roles se houver múltiplas */}
                            {(user as any).all_roles && (user as any).all_roles.length > 1 && (
                              <Badge variant="outline" className="text-xs">
                                +{(user as any).all_roles.length - 1}
                              </Badge>
                            )}
                          </div>
                        )}
                        {selectedUser?.id === user.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum usuário encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reset Password Button */}
            {selectedUser && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Usuário selecionado: {selectedUser.nome_completo}</p>
                      <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    </div>
                    <Button onClick={() => setShowModal(true)}>
                      <KeyRound className="h-4 w-4 mr-2" />
                      Redefinir Senha
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="historico" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Histórico de Redefinições</CardTitle>
                <CardDescription>
                  Últimas 50 redefinições de senha realizadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logs && logs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Usuário Afetado</TableHead>
                        <TableHead>Redefinido Por</TableHead>
                        <TableHead>E-mail Enviado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{log.usuario_afetado_nome}</p>
                              <p className="text-xs text-muted-foreground">{log.usuario_afetado_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{log.redefinido_por_nome}</p>
                              <p className="text-xs text-muted-foreground">{log.redefinido_por_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.enviado_por_email ? 'default' : 'secondary'}>
                              {log.enviado_por_email ? 'Sim' : 'Não'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum registro de redefinição encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reset Password Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Redefinir Senha</DialogTitle>
              <DialogDescription>
                Defina uma nova senha para {selectedUser?.nome_completo}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nova Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-8 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={generateSecurePassword}
                    title="Gerar senha segura"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                {newPassword && (
                  <PasswordStrengthIndicator 
                    password={newPassword} 
                    simplified={requiresStrongPassword || false}
                  />
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendEmail"
                  checked={sendByEmail}
                  onCheckedChange={(checked) => setSendByEmail(checked as boolean)}
                />
                <Label htmlFor="sendEmail" className="text-sm">
                  Enviar nova senha por e-mail
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleResetPassword} 
                disabled={
                  isUpdating || 
                  !newPassword || 
                  (requiresStrongPassword && !isPasswordStrong(newPassword, true))
                }
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Redefinir Senha
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default RedefinirSenha;
