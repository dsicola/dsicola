/**
 * Dados de exemplo para preview Excel (BOLETIM, MINI_PAUTA).
 * Usado no preview-excel-cell-mapping quando tipo !== PAUTA_CONCLUSAO.
 */
import prisma from '../lib/prisma.js';
import type { BoletimCellMappingData } from './excelTemplate.service.js';
import type { MiniPautaCellMappingData } from './excelTemplate.service.js';

const DISCIPLINAS_BOLETIM_PREVIEW = ['Matemática', 'Português', 'Física', 'Química'];
const ALUNOS_MINI_PAUTA_PREVIEW = [
  { nome: 'Ana Silva Santos', nrec: '2024001', avaliacoes: '14 | 15 | 13', exame: '14', mediaFinal: '14', situacao: 'Aprovado' },
  { nome: 'Bruno Oliveira Costa', nrec: '2024002', avaliacoes: '12 | 13 | 14', exame: '13', mediaFinal: '13', situacao: 'Aprovado' },
  { nome: 'Carla Mendes Lima', nrec: '2024003', avaliacoes: '10 | 11 | 9', exame: '10', mediaFinal: '10', situacao: 'Aprovado' },
  { nome: 'David Pereira Sousa', nrec: '2024004', avaliacoes: '15 | 14 | 16', exame: '15', mediaFinal: '15', situacao: 'Aprovado' },
  { nome: 'Eva Ferreira Gomes', nrec: '2024005', avaliacoes: '11 | 12 | 10', exame: '11', mediaFinal: '11', situacao: 'Aprovado' },
];

/**
 * Dados de exemplo para preview Excel BOLETIM.
 */
export async function getBoletimPreviewData(instituicaoId: string): Promise<BoletimCellMappingData> {
  const instituicao = await prisma.instituicao.findFirst({
    where: { id: instituicaoId },
    select: { nome: true },
  });
  const disciplinaData = DISCIPLINAS_BOLETIM_PREVIEW.map((nome, i) => ({
    disciplinaNome: nome,
    notaFinal: 12 + (i % 5),
    situacaoAcademica: 'Aprovado',
    professorNome: `Prof. ${nome}`,
    cargaHoraria: 90,
  }));
  return {
    instituicao: { nome: instituicao?.nome ?? 'Instituição de Ensino' },
    aluno: {
      nomeCompleto: 'João Paulo Ferreira',
      numeroIdentificacao: '202400001',
      numeroIdentificacaoPublica: '202400001',
    },
    anoLetivo: { ano: 2024 },
    disciplinas: disciplinaData,
  };
}

/**
 * Dados de exemplo para preview Excel MINI_PAUTA.
 */
export async function getMiniPautaPreviewData(instituicaoId: string): Promise<MiniPautaCellMappingData> {
  const instituicao = await prisma.instituicao.findFirst({
    where: { id: instituicaoId },
    select: { nome: true },
  });
  const dataEmissao = new Date().toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return {
    instituicaoNome: instituicao?.nome ?? 'Instituição de Ensino',
    turma: '10ª Classe - Turma A',
    anoLetivo: '2024',
    labelCursoClasse: 'Classe',
    valorCursoClasse: '10ª',
    disciplina: 'Matemática',
    professor: 'Prof. Manuel Santos',
    dataEmissao,
    codigoVerificacao: 'ABC-123-XYZ',
    tipoPauta: 'DEFINITIVA',
    alunos: ALUNOS_MINI_PAUTA_PREVIEW.map((a, i) => ({ n: i + 1, ...a })),
  };
}
