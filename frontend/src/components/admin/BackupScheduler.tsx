import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, Plus, Trash2, Edit, Database, Package, Image } from 'lucide-react';
import { backupApi, profilesApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BackupSchedule {
  id: string;
  instituicao_id: string | null;
  frequencia: string;
  tipo_backup: string;
  hora_execucao: string;
  dia_semana: number | null;
  dia_mes: number | null;
  ativo: boolean;
  ultimo_backup: string | null;
  proximo_backup: string | null;
  created_at: string;
}

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export const BackupScheduler = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BackupSchedule | null>(null);
  const [userInstituicaoId, setUserInstituicaoId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    frequencia: 'semanal',
    tipo_backup: 'completo',
    hora_execucao: '03:00',
    dia_semana: 0,
    dia_mes: 1,
  });

  useEffect(() => {
    fetchSchedules();
    fetchUserInstituicao();
  }, [user]);

  const fetchUserInstituicao = async () => {
    // REMOVIDO: instituicaoId agora vem do JWT no backend
    // Não precisamos buscar nem enviar
    setUserInstituicaoId(null);
  };

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const data = await backupApi.getSchedules();
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
    setIsLoading(false);
  };

  const calculateNextBackup = (freq: string, hora: string, diaSemana: number, diaMes: number): Date => {
    const now = new Date();
    const [hours, minutes] = hora.split(':').map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    switch (freq) {
      case 'diario':
        if (next <= now) next.setDate(next.getDate() + 1);
        break;
      case 'semanal':
        const currentDay = now.getDay();
        let daysUntil = diaSemana - currentDay;
        if (daysUntil < 0 || (daysUntil === 0 && next <= now)) daysUntil += 7;
        next.setDate(next.getDate() + daysUntil);
        break;
      case 'mensal':
        next.setDate(diaMes);
        if (next <= now) next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  };

  const handleSave = async () => {
    try {
      const proximoBackup = calculateNextBackup(
        formData.frequencia,
        formData.hora_execucao,
        formData.dia_semana,
        formData.dia_mes
      );

      // CRÍTICO: Não enviar instituicaoId - vem do JWT no backend
      const scheduleData = {
        frequencia: formData.frequencia,
        tipoBackup: formData.tipo_backup,
        horaExecucao: formData.hora_execucao + ':00',
        diaSemana: formData.frequencia === 'semanal' ? formData.dia_semana : null,
        diaMes: formData.frequencia === 'mensal' ? formData.dia_mes : null,
        proximoBackup: proximoBackup.toISOString(),
        ativo: true,
        // instituicaoId removido - vem do JWT
      };

      if (editingSchedule) {
        await backupApi.updateSchedule(editingSchedule.id, scheduleData);
        toast.success('Agendamento atualizado!');
      } else {
        await backupApi.createSchedule(scheduleData);
        toast.success('Agendamento criado!');
      }

      setShowDialog(false);
      setEditingSchedule(null);
      resetForm();
      fetchSchedules();
    } catch (error: unknown) {
      console.error('Error saving schedule:', error);
      toast.error(`Erro ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;

    try {
      await backupApi.deleteSchedule(id);
      toast.success('Agendamento excluído');
      fetchSchedules();
    } catch (error) {
      toast.error('Erro ao excluir agendamento');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await backupApi.updateSchedule(id, { ativo: !currentActive });
      toast.success(currentActive ? 'Agendamento desativado' : 'Agendamento ativado');
      fetchSchedules();
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleEdit = (schedule: BackupSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      frequencia: schedule.frequencia,
      tipo_backup: schedule.tipo_backup,
      hora_execucao: schedule.hora_execucao.substring(0, 5),
      dia_semana: schedule.dia_semana ?? 0,
      dia_mes: schedule.dia_mes ?? 1,
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({
      frequencia: 'semanal',
      tipo_backup: 'completo',
      hora_execucao: '03:00',
      dia_semana: 0,
      dia_mes: 1,
    });
  };

  const getFrequenciaLabel = (freq: string) => {
    switch (freq) {
      case 'diario': return 'Diário';
      case 'semanal': return 'Semanal';
      case 'mensal': return 'Mensal';
      default: return freq;
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'dados': return <Database className="h-4 w-4" />;
      case 'arquivos': return <Image className="h-4 w-4" />;
      case 'completo': return <Package className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const getScheduleDescription = (schedule: BackupSchedule) => {
    const hora = schedule.hora_execucao.substring(0, 5);
    switch (schedule.frequencia) {
      case 'diario':
        return `Todos os dias às ${hora}`;
      case 'semanal':
        const dia = DIAS_SEMANA.find(d => d.value === schedule.dia_semana);
        return `${dia?.label || 'Domingo'} às ${hora}`;
      case 'mensal':
        return `Dia ${schedule.dia_mes} de cada mês às ${hora}`;
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendamento de Backups
            </CardTitle>
            <CardDescription>
              Configure backups automáticos da sua instituição (diários, semanais ou mensais). Cada agendamento é exclusivo da sua instituição.
            </CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) {
              setEditingSchedule(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSchedule ? 'Editar Agendamento' : 'Novo Agendamento de Backup'}
                </DialogTitle>
                <DialogDescription>
                  Configure a frequência e o horário do backup automático
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Frequência */}
                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <Select
                    value={formData.frequencia}
                    onValueChange={(value) => setFormData({ ...formData, frequencia: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diario">Diário</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo de Backup */}
                <div className="space-y-2">
                  <Label>Tipo de Backup</Label>
                  <Select
                    value={formData.tipo_backup}
                    onValueChange={(value) => setFormData({ ...formData, tipo_backup: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dados">Somente Dados</SelectItem>
                      <SelectItem value="arquivos">Somente Arquivos</SelectItem>
                      <SelectItem value="completo">Backup Completo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Hora */}
                <div className="space-y-2">
                  <Label>Horário de Execução</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={formData.hora_execucao}
                      onChange={(e) => setFormData({ ...formData, hora_execucao: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recomendado: horários de baixo uso (ex: 03:00)
                  </p>
                </div>

                {/* Dia da Semana (para semanal) */}
                {formData.frequencia === 'semanal' && (
                  <div className="space-y-2">
                    <Label>Dia da Semana</Label>
                    <Select
                      value={formData.dia_semana.toString()}
                      onValueChange={(value) => setFormData({ ...formData, dia_semana: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIAS_SEMANA.map((dia) => (
                          <SelectItem key={dia.value} value={dia.value.toString()}>
                            {dia.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Dia do Mês (para mensal) */}
                {formData.frequencia === 'mensal' && (
                  <div className="space-y-2">
                    <Label>Dia do Mês</Label>
                    <Select
                      value={formData.dia_mes.toString()}
                      onValueChange={(value) => setFormData({ ...formData, dia_mes: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
                          <SelectItem key={dia} value={dia.toString()}>
                            Dia {dia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Recomendado: dias 1-28 para evitar problemas em meses curtos
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingSchedule ? 'Salvar Alterações' : 'Criar Agendamento'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando agendamentos...
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum backup agendado.</p>
            <p className="text-sm">Crie um agendamento para backups automáticos.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Agendamento</TableHead>
                <TableHead>Último Backup</TableHead>
                <TableHead>Próximo Backup</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <Switch
                      checked={schedule.ativo}
                      onCheckedChange={() => handleToggleActive(schedule.id, schedule.ativo)}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={schedule.ativo ? "default" : "secondary"}>
                      {getFrequenciaLabel(schedule.frequencia)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTipoIcon(schedule.tipo_backup)}
                      <span className="capitalize">{schedule.tipo_backup}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {getScheduleDescription(schedule)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {schedule.ultimo_backup
                      ? format(new Date(schedule.ultimo_backup), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : 'Nunca'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {schedule.proximo_backup && schedule.ativo
                      ? format(new Date(schedule.proximo_backup), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(schedule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
