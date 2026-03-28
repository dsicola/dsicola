export type DecisaoProgressaoSugerida = 'AVANCA' | 'REPETE' | 'AVANCA_CONDICIONADO';

export interface DisciplinaSugestaoItem {
  disciplinaId: string;
  nome: string;
  codigo: string | null;
  semestreCurso: number | null;
  obrigatoria: boolean;
  preRequisitoDisciplinaId: string | null;
  preRequisitoNome: string | null;
  elegivelParaMatricula: boolean;
  motivoBloqueio: string | null;
}

export interface PainelMatriculaInteligente {
  instituicaoId: string;
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO';
  alunoId: string;
  decisaoSugerida: DecisaoProgressaoSugerida;
  mensagensInstitucionais: string[];
  podeSubirNivel: boolean;
  classeOuAnoAtual: string;
  classeOuAnoSugerido: string;
  classeSugeridaId: string | null;
  statusFinalUltimaMatricula: string | null;
  disciplinasEmAtraso: DisciplinaSugestaoItem[];
  disciplinasNovasAnoSugeridas: DisciplinaSugestaoItem[];
  configuracao: {
    reprovacaoBloqueiaSubir: boolean;
    maxDisciplinasAtrasoSubir: number;
    usaPreRequisitos: boolean;
    disciplinasNegativasPermitidasStatusAno: number;
  };
}
