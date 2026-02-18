/**
 * Componente para exibir card de relatório no dashboard
 * Garante acesso contextual aos relatórios
 * Card de relatório
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReportConfig } from '@/config/reportsByRole';
import { useReportNavigation } from '@/utils/reportNavigation';
import { FileText } from 'lucide-react';

interface ReportCardProps {
  report: ReportConfig;
  role: string;
  params?: Record<string, string | number>;
  className?: string;
}

export function ReportCard({ report, role, params, className }: ReportCardProps) {
  const { navigateToReport } = useReportNavigation();
  const Icon = report.icon || FileText;

  const handleGenerate = () => {
    navigateToReport(report.id, role as any, params);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{report.label}</CardTitle>
          </div>
          <Badge variant="secondary">{report.domain}</Badge>
        </div>
        <CardDescription>{report.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {report.requiresAnoLetivo && (
            <Badge variant="outline" className="w-fit">
              Requer Ano Letivo
            </Badge>
          )}
          {report.requiresTurma && (
            <Badge variant="outline" className="w-fit">
              Requer Turma
            </Badge>
          )}
          {report.requiresAluno && (
            <Badge variant="outline" className="w-fit">
              Requer Aluno
            </Badge>
          )}
          {report.requiresDisciplina && (
            <Badge variant="outline" className="w-fit">
              Requer Disciplina
            </Badge>
          )}
          <Button onClick={handleGenerate} className="w-full mt-2">
            Gerar Relatório
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

