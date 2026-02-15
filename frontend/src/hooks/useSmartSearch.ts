import { useMemo } from 'react';
import { alunosApi, professorsApi, funcionariosApi, disciplinasApi, turmasApi, alojamentosApi, cursosApi, classesApi, instituicoesApi, usersApi } from '@/services/api';
import { SmartSearchItem } from '@/components/common/SmartSearch';
import { useTenantFilter } from './useTenantFilter';

/**
 * Hooks helpers para facilitar o uso do SmartSearch com diferentes entidades
 */

// Helper para buscar alunos
export function useAlunoSearch() {
  const { instituicaoId } = useTenantFilter();

  const searchAlunos = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const alunos = await alunosApi.getAll({ 
        instituicaoId,
        status: 'Ativo' 
      });

      const searchLower = searchTerm.toLowerCase();
      const filtered = alunos.filter((aluno: any) => {
        const nome = (aluno.nome_completo || aluno.nomeCompleto || '').toLowerCase();
        const email = (aluno.email || '').toLowerCase();
        const numId = (aluno.numero_identificacao || aluno.numeroIdentificacao || '').toLowerCase();
        return nome.includes(searchLower) || email.includes(searchLower) || numId.includes(searchLower);
      });

      return filtered.slice(0, 10).map((aluno: any) => ({
        id: aluno.id,
        nome: aluno.nome_completo || aluno.nomeCompleto || '',
        nomeCompleto: aluno.nome_completo || aluno.nomeCompleto || '',
        nome_completo: aluno.nome_completo || aluno.nomeCompleto || '',
        email: aluno.email || '',
        numeroIdentificacao: aluno.numero_identificacao || aluno.numeroIdentificacao || '',
        numero_identificacao: aluno.numero_identificacao || aluno.numeroIdentificacao || '',
        complemento: aluno.turma?.nome || aluno.curso?.nome || '',
      }));
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      return [];
    }
  };

  return { searchAlunos };
}

// Helper para buscar professores
export function useProfessorSearch() {
  const { instituicaoId } = useTenantFilter();

  const searchProfessores = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      // REGRA SIGA/SIGAE: usar professorsApi (GET /professores) - retorna professores.id, NUNCA professoresApi (users)
      const professores = await professorsApi.getAll();

      const searchLower = searchTerm.toLowerCase();
      const filtered = professores.filter((prof: any) => {
        const nome = (prof.nome_completo || prof.nomeCompleto || prof.nome || '').toLowerCase();
        const email = (prof.email || '').toLowerCase();
        return nome.includes(searchLower) || email.includes(searchLower);
      });

      return filtered.slice(0, 10).map((prof: any) => ({
        id: prof.id, // professores.id (NUNCA prof.userId que é users.id)
        nome: prof.nome_completo || prof.nomeCompleto || prof.nome || '',
        nomeCompleto: prof.nome_completo || prof.nomeCompleto || prof.nome || '',
        nome_completo: prof.nome_completo || prof.nomeCompleto || prof.nome || '',
        email: prof.email || '',
        complemento: prof.cargo?.nome || '',
      }));
    } catch (error) {
      console.error('Erro ao buscar professores:', error);
      return [];
    }
  };

  return { searchProfessores };
}

// Helper para buscar funcionários
export function useFuncionarioSearch() {
  const { instituicaoId } = useTenantFilter();

  const searchFuncionarios = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const funcionarios = await funcionariosApi.getAll({ 
        status: 'Ativo',
        instituicaoId 
      });

      const searchLower = searchTerm.toLowerCase();
      const filtered = funcionarios.filter((func: any) => {
        const nome = (func.nome_completo || func.nomeCompleto || func.nome || '').toLowerCase();
        const email = (func.email || '').toLowerCase();
        return nome.includes(searchLower) || email.includes(searchLower);
      });

      return filtered.slice(0, 10).map((func: any) => ({
        id: func.userId || func.id,
        nome: func.nome_completo || func.nomeCompleto || func.nome || '',
        nomeCompleto: func.nome_completo || func.nomeCompleto || func.nome || '',
        nome_completo: func.nome_completo || func.nomeCompleto || func.nome || '',
        email: func.email || '',
        complemento: func.cargo?.nome || func.cargos?.nome || '',
      }));
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error);
      return [];
    }
  };

  return { searchFuncionarios };
}

// Helper para buscar disciplinas
export function useDisciplinaSearch() {
  const { instituicaoId } = useTenantFilter();

  const searchDisciplinas = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const disciplinas = await disciplinasApi.getAll({ 
        ativo: true,
        instituicaoId 
      });

      const searchLower = searchTerm.toLowerCase();
      const filtered = disciplinas.filter((disc: any) => {
        const nome = (disc.nome || '').toLowerCase();
        const codigo = (disc.codigo || '').toLowerCase();
        return nome.includes(searchLower) || codigo.includes(searchLower);
      });

      return filtered.slice(0, 10).map((disc: any) => ({
        id: disc.id,
        nome: disc.nome || '',
        nomeCompleto: disc.nome || '',
        complemento: disc.curso?.nome || disc.cargaHoraria ? `${disc.cargaHoraria}h` : '',
      }));
    } catch (error) {
      console.error('Erro ao buscar disciplinas:', error);
      return [];
    }
  };

  return { searchDisciplinas };
}

// Helper para buscar turmas
export function useTurmaSearch() {
  const { instituicaoId } = useTenantFilter();

  const searchTurmas = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const turmas = await turmasApi.getAll({ instituicaoId });

      const searchLower = searchTerm.toLowerCase();
      const filtered = turmas.filter((turma: any) => {
        const nome = (turma.nome || '').toLowerCase();
        return nome.includes(searchLower);
      });

      return filtered.slice(0, 10).map((turma: any) => ({
        id: turma.id,
        nome: turma.nome || '',
        nomeCompleto: turma.nome || '',
        complemento: turma.curso?.nome || turma.classe?.nome || '',
      }));
    } catch (error) {
      console.error('Erro ao buscar turmas:', error);
      return [];
    }
  };

  return { searchTurmas };
}

// Helper para buscar alojamentos
export function useAlojamentoSearch() {
  const { instituicaoId, shouldFilter } = useTenantFilter();

  const searchAlojamentos = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.length < 1) return [];

    try {
      const params: any = {};
      if (shouldFilter && instituicaoId) params.instituicaoId = instituicaoId;
      const alojamentos = await alojamentosApi.getAll(params);
      const list = Array.isArray(alojamentos) ? alojamentos : [];

      const searchLower = searchTerm.toLowerCase().trim();
      const filtered = list.filter((a: any) => {
        const bloco = (a.nome_bloco || '').toLowerCase();
        const quarto = (a.numero_quarto || '').toLowerCase();
        return bloco.includes(searchLower) || quarto.includes(searchLower);
      });

      return filtered.slice(0, 15).map((a: any) => ({
        id: a.id,
        nome: `${a.nome_bloco || ''} - ${a.numero_quarto || ''}`,
        nomeCompleto: `${a.nome_bloco || ''} - ${a.numero_quarto || ''}`,
        complemento: a.capacidade ? `Capacidade: ${a.capacidade}` : '',
      }));
    } catch (error) {
      console.error('Erro ao buscar alojamentos:', error);
      return [];
    }
  };

  return { searchAlojamentos };
}

// Helper para buscar cursos
export function useCursoSearch() {
  const { instituicaoId, shouldFilter } = useTenantFilter();

  const searchCursos = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.length < 1) return [];

    try {
      const cursos = await cursosApi.getAll({ ativo: true });
      const list = Array.isArray(cursos) ? cursos : [];

      const searchLower = searchTerm.toLowerCase().trim();
      const filtered = list.filter((c: any) => {
        const nome = (c.nome || '').toLowerCase();
        const codigo = (c.codigo || '').toLowerCase();
        return nome.includes(searchLower) || codigo.includes(searchLower);
      });

      return filtered.slice(0, 15).map((c: any) => ({
        id: c.id,
        nome: c.nome || '',
        nomeCompleto: c.nome || '',
        complemento: c.codigo ? `Código: ${c.codigo}` : '',
      }));
    } catch (error) {
      console.error('Erro ao buscar cursos:', error);
      return [];
    }
  };

  return { searchCursos };
}

// Helper para buscar classes
export function useClasseSearch() {
  const { instituicaoId, shouldFilter } = useTenantFilter();

  const searchClasses = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.length < 1) return [];

    try {
      const classes = await classesApi.getAll({ ativo: true });
      const list = Array.isArray(classes) ? classes : [];

      const searchLower = searchTerm.toLowerCase().trim();
      const filtered = list.filter((c: any) => {
        const nome = (c.nome || '').toLowerCase();
        return nome.includes(searchLower);
      });

      return filtered.slice(0, 15).map((c: any) => ({
        id: c.id,
        nome: c.nome || '',
        nomeCompleto: c.nome || '',
        complemento: c.curso?.nome || '',
      }));
    } catch (error) {
      console.error('Erro ao buscar classes:', error);
      return [];
    }
  };

  return { searchClasses };
}

// Helper para buscar instituições (SuperAdmin)
export function useInstituicaoSearch() {
  const searchInstituicoes = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.trim().length < 1) return [];

    try {
      const instituicoes = await instituicoesApi.getAll();
      const list = Array.isArray(instituicoes) ? instituicoes : [];

      const searchLower = searchTerm.toLowerCase().trim();
      const filtered = list.filter((i: any) => {
        const nome = (i.nome || '').toLowerCase();
        const subdominio = (i.subdominio || '').toLowerCase();
        const email = (i.emailContato || i.email || '').toLowerCase();
        return nome.includes(searchLower) || subdominio.includes(searchLower) || email.includes(searchLower);
      });

      return filtered.slice(0, 15).map((i: any) => ({
        id: i.id,
        nome: i.nome || '',
        nomeCompleto: i.nome || '',
        complemento: i.subdominio ? `Subdomínio: ${i.subdominio}` : i.emailContato || i.email || '',
      }));
    } catch (error) {
      console.error('Erro ao buscar instituições:', error);
      return [];
    }
  };

  return { searchInstituicoes };
}

// Helper para buscar usuários
export function useUserSearch() {

  const searchUsers = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.trim().length < 1) return [];

    try {
      // Multi-tenant: backend usa JWT, não enviar instituicaoId
      const users = await usersApi.getAll({});
      const list = Array.isArray(users) ? users : [];

      const searchLower = searchTerm.toLowerCase().trim();
      const filtered = list.filter((u: any) => {
        const nome = (u.nome_completo || u.nomeCompleto || u.nome || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return nome.includes(searchLower) || email.includes(searchLower);
      });

      return filtered.slice(0, 15).map((u: any) => ({
        id: u.id,
        nome: u.nome_completo || u.nomeCompleto || u.nome || u.email || '',
        nomeCompleto: u.nome_completo || u.nomeCompleto || u.nome || '',
        nome_completo: u.nome_completo || u.nomeCompleto || u.nome || '',
        email: u.email || '',
      }));
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return [];
    }
  };

  return { searchUsers };
}

// Helper genérico para busca customizada
export function useCustomSearch<T = any>(
  searchFn: (searchTerm: string) => Promise<T[]>,
  mapFn: (item: T) => SmartSearchItem
) {
  const search = async (searchTerm: string): Promise<SmartSearchItem[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const results = await searchFn(searchTerm);
      return results.slice(0, 10).map(mapFn);
    } catch (error) {
      console.error('Erro na busca customizada:', error);
      return [];
    }
  };

  return { search };
}

