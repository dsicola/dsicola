import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { getSidebarItemsForRole } from './sidebar.config';
import {
  getSidebarModulesForRole,
  getComunicadosPathForRole,
  getAcademicaPathForRole,
  getDashboardPathForRole,
} from './sidebar.modules';
import type { LucideIcon } from 'lucide-react';

/** Palavras-chave adicionais para busca por linguagem natural (ex: "cadastrar estudante" → Estudantes) */
const SEARCH_KEYWORDS: Record<string, string> = {
  'Estudantes': 'cadastrar estudante cadastrar aluno aluno estudantes matrícula registar estudante administrativo gestão administrativa',
  'Matrículas em Turmas': 'matrícula turma inscrever aluno matricular',
  'Estudantes e Matrículas': 'cadastrar estudante gestão alunos matrículas documentos administrativo',
  'Configurações Institucionais': 'instituição ano letivo calendário períodos auditoria',
  'Certificados e layout (PDF)':
    'certificado declaração carimbo fundo pdf texto ministério assinatura layout instituição documentos oficiais',
  'Certificados e documentos': 'emitir modelo importar docx html verificação código declaração histórico secretaria',
  'Histórico Acadêmico': 'histórico escolar boletim notas',
  'Professores': 'cadastrar professor docentes',
  'Funcionários': 'cadastrar funcionário colaboradores rh',
  'Mensalidades / Propinas': 'pagar mensalidade propina pagamento',
  'Pagamentos': 'pagar mensalidade faturas pagamento',
  'Faturas e Pagamentos': 'faturas pagar',
  'Bolsas e Descontos': 'bolsa desconto',
  'Taxas e Serviços': 'taxa matrícula bata passe declaração certificado',
  'Cursos': 'cadastrar curso disciplinas',
  'Disciplinas': 'cadastrar disciplina',
  'Turmas': 'turma turmas',
  'Matriz Curricular': 'matriz curricular',
  'Planos de Ensino': 'plano ensino',
  'Avaliações e notas (disciplina)':
    'avaliação notas lançar notas disciplina plano ensino prova teste lançamento por avaliação guardar notas',
  'Notas e pautas (turma)': 'turma pauta consolidar gestão académica visão turma',
  'Notas (plano + turma)': 'lançar notas turma disciplina plano professor painel avaliação',
  'Presenças': 'presença frequência chamada',
  'Chat': 'mensagens conversar',
  'Comunicados': 'comunicado aviso mural',
  'Dashboard': 'início página principal',
  'Documentos Estudantis':
    'documentos aluno anexos upload declaração oficial emitir certificado estudante secretaria matrícula processo',
  'Boletins': 'boletim notas pauta secretaria certificados',
  'Documentos Fiscais': 'fatura recibo pró-forma AGT finanças',
  'Contabilidade': 'plano contas lançamentos balancete',
};

/** Normaliza para busca: minúsculas, sem acentos, separadores de URL viram espaço. */
function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[/=?&.:,_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filtro do cmdk: todas as palavras digitadas devem aparecer em qualquer parte do texto
 * (nome, secção, caminho, palavras-chave). Melhor que o command-score para PT e URLs longas.
 */
function menuSearchCommandFilter(value: string, search: string, keywords?: string[]): number {
  const q = normalizeSearchText(search);
  if (!q) return 1;
  const hay = normalizeSearchText([value, ...(keywords ?? [])].join(' '));
  for (const t of q.split(' ').filter(Boolean)) {
    if (!hay.includes(t)) return 0;
  }
  return 1;
}

function buildItemSearchValue(label: string, section: string, path: string, extraKeywords: string): string {
  const pathTokens = normalizeSearchText(path.replace(/^\//, ''));
  const base = `${label} ${section} ${extraKeywords} ${path} ${pathTokens}`;
  return base.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Secretaria pura: mesmas áreas que no admin, com rotas do painel da secretaria. */
function preferSecretariaNavigatePath(path: string, userRoles: string[]): string {
  const useSecretaria =
    userRoles.some((r) => ['SECRETARIA', 'DIRECAO', 'COORDENADOR'].includes(r)) &&
    !userRoles.includes('ADMIN') &&
    !userRoles.includes('SUPER_ADMIN');
  if (!useSecretaria) return path;

  const exact: Record<string, string> = {
    '/admin-dashboard/gestao-alunos': '/secretaria-dashboard/alunos',
    '/admin-dashboard/gestao-alunos?tab=matriculas-turmas': '/secretaria-dashboard/matriculas',
    '/admin-dashboard/gestao-alunos?tab=historico': '/secretaria-dashboard/alunos',
    '/admin-dashboard/documentos-alunos': '/secretaria-dashboard/documentos-alunos',
    '/admin-dashboard/importar-estudantes': '/secretaria-dashboard/importar-estudantes',
    '/admin-dashboard/certificados': '/secretaria-dashboard/certificados',
  };
  return exact[path] ?? path;
}

interface MenuSearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRoles: string[];
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
}

interface SearchItem {
  label: string;
  path: string;
  section: string;
  icon: LucideIcon;
  searchValue: string;
  /** Alinhado a sidebar.modules (ex.: Comunidade, Social). */
  openInNewTab?: boolean;
}

function flattenSearchItems(
  userRoles: string[],
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null
): SearchItem[] {
  const items: SearchItem[] = [];

  // Paths dinâmicos por role (Comunicados, Acadêmica, Dashboard)
  const comunicadosPath = getComunicadosPathForRole(userRoles);
  const academicaPath = getAcademicaPathForRole(userRoles);
  const dashboardPath = getDashboardPathForRole(userRoles);

  const resolvePath = (label: string, path: string): string => {
    if (label === 'Comunicados') return comunicadosPath;
    if (label === 'Dashboard') return dashboardPath;
    if (path.includes('gestao-academica') && !path.includes('tab=')) return academicaPath;
    return path;
  };

  // Itens detalhados do sidebar.config
  const sections = getSidebarItemsForRole(userRoles);
  for (const { section, items: sectionItems } of sections) {
    for (const item of sectionItems) {
      const rawPath = resolvePath(item.label, item.path);
      const path = preferSecretariaNavigatePath(rawPath, userRoles);
      const keywords = SEARCH_KEYWORDS[item.label] ?? '';
      items.push({
        label: item.label,
        path,
        section,
        icon: item.icon,
        searchValue: buildItemSearchValue(item.label, section, rawPath, keywords),
      });
      // Subitens
      if (item.subItems) {
        const parentKw = SEARCH_KEYWORDS[item.label] ?? '';
        for (const sub of item.subItems) {
          const subPath = preferSecretariaNavigatePath(sub.path, userRoles);
          items.push({
            label: `${item.label} › ${sub.label}`,
            path: subPath,
            section,
            icon: item.icon,
            searchValue: buildItemSearchValue(
              `${item.label} › ${sub.label}`,
              section,
              sub.path,
              `${SEARCH_KEYWORDS[sub.label] ?? ''} ${parentKw}`,
            ),
          });
        }
      }
    }
  }

  // Módulos de alto nível do sidebar.modules (evitar duplicados por path)
  const modules = getSidebarModulesForRole(userRoles, tipoAcademico);
  const existingPaths = new Set(items.map((i) => `${i.path}|${i.label}`));

  for (const mod of modules) {
    let path = mod.path;
    if (mod.labelKey === 'menu.communications' || mod.label === 'Comunicados') path = comunicadosPath;
    else if (mod.labelKey === 'menu.academic' || mod.label === 'Acadêmica') path = academicaPath;
    else if (mod.label === 'Dashboard') path = dashboardPath;

    const navPath = preferSecretariaNavigatePath(path, userRoles);
    const key = `${navPath}|${mod.label}`;
    if (!existingPaths.has(key)) {
      existingPaths.add(key);
      const kw = SEARCH_KEYWORDS[mod.label] ?? (mod.description || '');
      items.push({
        label: mod.label,
        path: navPath,
        section: 'Módulos',
        icon: mod.icon,
        searchValue: buildItemSearchValue(mod.label, 'Módulos', path, kw),
        openInNewTab: mod.openInNewTab,
      });
    }
  }

  return items;
}

export function MenuSearchPalette({
  open,
  onOpenChange,
  userRoles,
  tipoAcademico = null,
}: MenuSearchPaletteProps) {
  const navigate = useNavigate();
  const searchItems = flattenSearchItems(userRoles, tipoAcademico);

  // Atalho de teclado: Cmd+K (Mac) ou Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} commandFilter={menuSearchCommandFilter}>
      <CommandInput
        placeholder="Procurar opções... (ex: cadastrar estudante, mensalidades)"
      />
      <CommandList className="max-h-[min(420px,50vh)]">
        <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
        {Object.entries(
          searchItems.reduce<Record<string, SearchItem[]>>((acc, item) => {
            if (!acc[item.section]) acc[item.section] = [];
            acc[item.section].push(item);
            return acc;
          }, {})
        ).map(([section, sectionItems]) => (
          <CommandGroup key={section} heading={section}>
            {sectionItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={`${item.path}-${item.label}`}
                  value={item.searchValue}
                  onSelect={() => {
                    if (item.openInNewTab) {
                      const u = `${window.location.origin}${item.path.startsWith('/') ? item.path : `/${item.path}`}`;
                      window.open(u, '_blank', 'noopener,noreferrer');
                    } else {
                      navigate(item.path);
                    }
                    onOpenChange(false);
                  }}
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0" />
                  {item.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
