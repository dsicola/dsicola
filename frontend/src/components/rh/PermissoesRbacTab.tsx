import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { userRolesApi, usersApi } from '@/services/api';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { getRoleLabel } from '@/utils/roleLabels';
import { PermissoesRolesDialog } from '@/components/admin/PermissoesRolesDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { BookOpen, Plus, Shield, Trash2, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Perfis que a instituição pode associar (nunca plataforma: SUPER_ADMIN, COMERCIAL). */
const ASSIGNABLE_ROLES = [
  'ADMIN',
  'DIRECAO',
  'COORDENADOR',
  'SECRETARIA',
  'RH',
  'FINANCEIRO',
  'POS',
  'AUDITOR',
  'PROFESSOR',
  'ALUNO',
  'RESPONSAVEL',
] as const;

type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

type RoleRow = {
  id: string;
  role: string;
};

type UserAggregate = {
  userId: string;
  nome: string;
  email: string;
  roles: RoleRow[];
};

export function PermissoesRbacTab() {
  const { t } = useTranslation();
  const { user, role: sessionRole } = useAuth();
  const queryClient = useQueryClient();
  const currentUserId = user?.id;

  const canManage = sessionRole === 'ADMIN' || sessionRole === 'SUPER_ADMIN';

  const [matrixOpen, setMatrixOpen] = useSafeDialog(false);
  const [addOpen, setAddOpen] = useSafeDialog(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<AssignableRole | ''>('');
  const [removeTarget, setRemoveTarget] = useState<{ id: string; userId: string; role: string } | null>(null);

  const { data: roleRecords = [], isLoading } = useQuery({
    queryKey: ['rh-rbac-user-roles'],
    queryFn: async () => {
      const data = await userRolesApi.getAll();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: userSearchResults, isFetching: searchingUsers } = useQuery({
    queryKey: ['rh-rbac-users-search', userSearch],
    queryFn: async () => {
      const res = await usersApi.getAll({
        search: userSearch.trim() || undefined,
        page: 1,
        pageSize: 40,
        sortBy: 'nomeCompleto',
        sortOrder: 'asc',
      });
      const list = res?.data ?? [];
      return list as { id: string; nomeCompleto?: string; nome_completo?: string; email?: string }[];
    },
    enabled: addOpen && canManage,
    staleTime: 30_000,
  });

  const grouped: UserAggregate[] = useMemo(() => {
    const map = new Map<string, UserAggregate>();
    for (const rec of roleRecords as any[]) {
      const uid = rec.userId ?? rec.user_id;
      if (!uid) continue;
      const u = rec.user;
      const nome = u?.nomeCompleto ?? u?.nome_completo ?? rec.nome_completo ?? '—';
      const email = u?.email ?? rec.email ?? '—';
      const rid = rec.id;
      const rname = rec.role;
      if (!map.has(uid)) {
        map.set(uid, { userId: uid, nome, email, roles: [] });
      }
      const g = map.get(uid)!;
      if (rid && rname) {
        g.roles.push({ id: rid, role: rname });
      }
      if (nome !== '—') g.nome = nome;
      if (email !== '—') g.email = email;
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, undefined, { sensitivity: 'base' }));
  }, [roleRecords]);

  const [filterInput, setFilterInput] = useState('');
  const filteredGrouped = useMemo(() => {
    const q = filterInput.trim().toLowerCase();
    if (!q) return grouped;
    return grouped.filter(
      (g) =>
        g.nome.toLowerCase().includes(q) ||
        g.email.toLowerCase().includes(q) ||
        g.roles.some((r) => r.role.toLowerCase().includes(q))
    );
  }, [grouped, filterInput]);

  const createMutation = useSafeMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await userRolesApi.create({ userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-rbac-user-roles'] });
      setAddOpen(false);
      setSelectedUserId('');
      setSelectedRole('');
      setUserSearch('');
      toast({ title: t('pages.recursosHumanos.rbac.toastAdded') });
    },
    onError: (error: any) => {
      toast({
        title: t('pages.recursosHumanos.rbac.toastError'),
        description: error?.response?.data?.message || error?.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await userRolesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-rbac-user-roles'] });
      setRemoveTarget(null);
      toast({ title: t('pages.recursosHumanos.rbac.toastRemoved') });
    },
    onError: (error: any) => {
      toast({
        title: t('pages.recursosHumanos.rbac.toastError'),
        description: error?.response?.data?.message || error?.message,
        variant: 'destructive',
      });
    },
  });

  const openAdd = useCallback(() => {
    setSelectedUserId('');
    setSelectedRole('');
    setUserSearch('');
    setAddOpen(true);
  }, [setAddOpen]);

  const handleConfirmRemove = useCallback(() => {
    if (!removeTarget) return;
    const { id, userId, role } = removeTarget;
    if (role === 'ADMIN' && userId === currentUserId) {
      toast({
        title: t('pages.recursosHumanos.rbac.cannotRemoveOwnAdmin'),
        variant: 'destructive',
      });
      setRemoveTarget(null);
      return;
    }
    deleteMutation.mutate(id);
  }, [removeTarget, currentUserId, deleteMutation, t]);

  const submitAdd = () => {
    if (!selectedUserId || !selectedRole) {
      toast({
        title: t('pages.recursosHumanos.rbac.fillUserAndRole'),
        variant: 'destructive',
      });
      return;
    }
    const agg = grouped.find((g) => g.userId === selectedUserId);
    if (agg?.roles.some((r) => r.role === selectedRole)) {
      toast({
        title: t('pages.recursosHumanos.rbac.alreadyHasRole'),
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate({ userId: selectedUserId, role: selectedRole });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              {t('pages.recursosHumanos.rbac.cardTitle')}
            </CardTitle>
            <CardDescription>{t('pages.recursosHumanos.rbac.cardDescription')}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={() => setMatrixOpen(true)} className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              {t('pages.recursosHumanos.rbac.matrixButton')}
            </Button>
            {canManage && (
              <Button type="button" size="sm" onClick={openAdd} className="gap-1.5">
                <Plus className="h-4 w-4" />
                {t('pages.recursosHumanos.rbac.addProfile')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManage && (
            <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-3 bg-muted/30">
              {t('pages.recursosHumanos.rbac.readOnlyHint')}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <Input
              placeholder={t('pages.recursosHumanos.rbac.filterPlaceholder')}
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('pages.recursosHumanos.rbac.colUser')}</TableHead>
                  <TableHead>{t('pages.recursosHumanos.rbac.colEmail')}</TableHead>
                  <TableHead>{t('pages.recursosHumanos.rbac.colProfiles')}</TableHead>
                  {canManage && <TableHead className="w-[120px] text-right">{t('pages.recursosHumanos.rbac.colActions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 4 : 3} className="text-center text-muted-foreground py-10">
                      {t('common.loading')}
                    </TableCell>
                  </TableRow>
                ) : filteredGrouped.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 4 : 3} className="text-center text-muted-foreground py-10">
                      {t('pages.recursosHumanos.rbac.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGrouped.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          {row.nome}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{row.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {row.roles.map((r) => (
                            <Badge
                              key={r.id}
                              variant={r.role === 'ADMIN' ? 'default' : 'secondary'}
                              className={cn('font-normal', r.role === 'SUPER_ADMIN' && 'bg-violet-600')}
                            >
                              {getRoleLabel(r.role)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {row.roles.map((r) => (
                              <Button
                                key={r.id}
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={deleteMutation.isPending}
                                title={t('pages.recursosHumanos.rbac.removeRoleTitle', { role: getRoleLabel(r.role) })}
                                onClick={() => setRemoveTarget({ id: r.id, userId: row.userId, role: r.role })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PermissoesRolesDialog open={matrixOpen} onOpenChange={setMatrixOpen} />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pages.recursosHumanos.rbac.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('pages.recursosHumanos.rbac.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('pages.recursosHumanos.rbac.searchUser')}</label>
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder={t('pages.recursosHumanos.rbac.searchPlaceholder')}
              />
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('pages.recursosHumanos.rbac.pickUser')} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {searchingUsers && (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">{t('common.loading')}</div>
                  )}
                  {!searchingUsers && (userSearchResults ?? []).length === 0 && (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      {t('pages.recursosHumanos.rbac.noUsersFound')}
                    </div>
                  )}
                  {!searchingUsers &&
                    (userSearchResults ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {(u.nomeCompleto || u.nome_completo || u.email || u.id).slice(0, 80)}
                        {u.email ? ` · ${u.email}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('pages.recursosHumanos.rbac.pickProfile')}</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AssignableRole)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('pages.recursosHumanos.rbac.pickProfile')} />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {getRoleLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={submitAdd} disabled={createMutation.isPending}>
              {t('pages.recursosHumanos.rbac.confirmAdd')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.recursosHumanos.rbac.confirmRemoveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? t('pages.recursosHumanos.rbac.confirmRemoveDescription', {
                    role: getRoleLabel(removeTarget.role),
                  })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleConfirmRemove();
              }}
            >
              {t('pages.recursosHumanos.rbac.confirmRemove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
