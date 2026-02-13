import { useState, useEffect } from 'react';
import { statsApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, GraduationCap, BookOpen, AlertTriangle, Infinity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface UsoInstituicao {
  alunos_atual: number;
  alunos_limite: number | null;
  professores_atual: number;
  professores_limite: number | null;
  cursos_atual: number;
  cursos_limite: number | null;
  plano_nome: string;
  assinatura_status: string;
}

export function UsoPlanoBadge() {
  const { user } = useAuth();
  const [uso, setUso] = useState<UsoInstituicao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUso = async () => {
      // IMPORTANTE: Multi-tenant - instituicaoId vem do JWT, não precisa verificar no user
      try {
        // O backend usa req.user.instituicaoId do JWT token automaticamente
        const data = await statsApi.getUsoInstituicao();
        if (data) {
          setUso(data as UsoInstituicao);
        }
      } catch (error) {
        console.error('Error fetching uso:', error);
      }
      setLoading(false);
    };

    fetchUso();
  }, []); // Não depender de user?.instituicao_id - vem do JWT

  if (loading || !uso) return null;

  const calcPercentage = (atual: number, limite: number | null) => {
    if (!limite) return 0;
    return Math.min((atual / limite) * 100, 100);
  };

  const isNearLimit = (atual: number, limite: number | null) => {
    if (!limite) return false;
    return atual >= limite * 0.8;
  };

  const isAtLimit = (atual: number, limite: number | null) => {
    if (!limite) return false;
    return atual >= limite;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Uso do Plano</CardTitle>
          <Badge variant="outline">{uso.plano_nome}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>Alunos</span>
            </div>
            <span className={isAtLimit(uso.alunos_atual, uso.alunos_limite) ? 'text-destructive font-medium' : ''}>
              {uso.alunos_atual}/{uso.alunos_limite ?? <Infinity className="h-3 w-3 inline" />}
            </span>
          </div>
          {uso.alunos_limite && (
            <Progress 
              value={calcPercentage(uso.alunos_atual, uso.alunos_limite)} 
              className={isNearLimit(uso.alunos_atual, uso.alunos_limite) ? '[&>div]:bg-destructive' : ''}
            />
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3" />
              <span>Professores</span>
            </div>
            <span className={isAtLimit(uso.professores_atual, uso.professores_limite) ? 'text-destructive font-medium' : ''}>
              {uso.professores_atual}/{uso.professores_limite ?? <Infinity className="h-3 w-3 inline" />}
            </span>
          </div>
          {uso.professores_limite && (
            <Progress 
              value={calcPercentage(uso.professores_atual, uso.professores_limite)}
              className={isNearLimit(uso.professores_atual, uso.professores_limite) ? '[&>div]:bg-destructive' : ''}
            />
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              <span>Cursos</span>
            </div>
            <span className={isAtLimit(uso.cursos_atual, uso.cursos_limite) ? 'text-destructive font-medium' : ''}>
              {uso.cursos_atual}/{uso.cursos_limite ?? <Infinity className="h-3 w-3 inline" />}
            </span>
          </div>
          {uso.cursos_limite && (
            <Progress 
              value={calcPercentage(uso.cursos_atual, uso.cursos_limite)}
              className={isNearLimit(uso.cursos_atual, uso.cursos_limite) ? '[&>div]:bg-destructive' : ''}
            />
          )}
        </div>

        {(isNearLimit(uso.alunos_atual, uso.alunos_limite) || 
          isNearLimit(uso.professores_atual, uso.professores_limite) ||
          isNearLimit(uso.cursos_atual, uso.cursos_limite)) && (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            <span>Próximo do limite do plano</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
