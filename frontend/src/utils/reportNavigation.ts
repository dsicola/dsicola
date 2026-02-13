/**
 * Utilitário para navegação contextual de relatórios
 * Garante que relatórios sejam acessados apenas do contexto do dashboard
 * Padrão SIGA / SIGAA / SIGAE
 */

import { getReportsByRole, getReportsByDomain, ReportConfig, UserRole, ReportDomain } from '@/config/reportsByRole';
import { useNavigate } from 'react-router-dom';

/**
 * Obter relatórios disponíveis para um card/ação do dashboard
 */
export function getReportsForDashboardCard(
  role: UserRole,
  dashboardPath: string,
  cardLabel?: string
): ReportConfig[] {
  const reports = getReportsByRole(role);
  return reports.filter(
    (report) =>
      report.dashboardOrigin?.path === dashboardPath &&
      (!cardLabel || report.dashboardOrigin?.card === cardLabel)
  );
}

/**
 * Obter relatórios por domínio para um dashboard
 */
export function getReportsForDomain(
  role: UserRole,
  domain: ReportDomain,
  dashboardPath: string
): ReportConfig[] {
  const reports = getReportsByDomain(role, domain);
  return reports.filter((report) => report.dashboardOrigin?.path === dashboardPath);
}

/**
 * Hook para navegar para um relatório
 */
export function useReportNavigation() {
  const navigate = useNavigate();

  const navigateToReport = (
    reportId: string,
    role: UserRole,
    params?: Record<string, string | number>
  ) => {
    const reports = getReportsByRole(role);
    const report = reports.find((r) => r.id === reportId);

    if (!report) {
      console.error(`Relatório ${reportId} não encontrado para role ${role}`);
      return;
    }

    // Construir query params
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, String(value));
      });
    }
    queryParams.append('reportId', reportId);

    // Navegar para página de relatórios com contexto
    navigate(`/relatorios?${queryParams.toString()}`);
  };

  return { navigateToReport };
}

/**
 * Verificar se um relatório pode ser acessado do contexto atual
 */
export function canAccessReportFromContext(
  reportId: string,
  role: UserRole,
  currentPath: string
): boolean {
  const reports = getReportsByRole(role);
  const report = reports.find((r) => r.id === reportId);

  if (!report) return false;

  // Verificar se o relatório tem origem no dashboard atual
  return report.dashboardOrigin?.path === currentPath;
}

/**
 * Obter URL de geração de relatório
 */
export function getReportGenerationUrl(
  reportId: string,
  role: UserRole,
  params?: Record<string, string | number>
): string {
  const reports = getReportsByRole(role);
  const report = reports.find((r) => r.id === reportId);

  if (!report) {
    console.error(`Relatório ${reportId} não encontrado para role ${role}`);
    return '#';
  }

  // Construir URL base
  let url = report.endpoint;

  // Adicionar query params se fornecidos
  if (params && Object.keys(params).length > 0) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, String(value));
    });
    url += `?${queryParams.toString()}`;
  }

  return url;
}

