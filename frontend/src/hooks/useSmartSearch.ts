import { useMemo } from 'react';
import { alunosApi, professorsApi, funcionariosApi, disciplinasApi, turmasApi } from '@/services/api';
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

