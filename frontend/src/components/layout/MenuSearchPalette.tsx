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
};

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
      const path = resolvePath(item.label, item.path);
      const keywords = SEARCH_KEYWORDS[item.label] ?? '';
      items.push({
        label: item.label,
        path,
        section,
        icon: item.icon,
        searchValue: `${item.label} ${section} ${keywords}`.toLowerCase(),
      });
      // Subitens
      if (item.subItems) {
        for (const sub of item.subItems) {
          items.push({
            label: `${item.label} › ${sub.label}`,
            path: sub.path,
            section,
            icon: item.icon,
            searchValue: `${sub.label} ${item.label} ${section}`.toLowerCase(),
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

    const key = `${path}|${mod.label}`;
    if (!existingPaths.has(key)) {
      existingPaths.add(key);
      const keywords = SEARCH_KEYWORDS[mod.label] ?? (mod.description || '');
      items.push({
        label: mod.label,
        path,
        section: 'Módulos',
        icon: mod.icon,
        searchValue: `${mod.label} Módulos ${keywords}`.toLowerCase(),
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
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Procurar opções... (ex: cadastrar estudante, mensalidades)"
      />
      <CommandList>
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
                    navigate(item.path);
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
