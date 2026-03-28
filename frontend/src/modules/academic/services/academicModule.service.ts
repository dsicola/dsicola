/**
 * Camada única de acesso às APIs académicas do DSICOLA (alinhada ao backend).
 * Preferir importar daqui em ecrãs do módulo académico para facilitar testes e evolução.
 */
export {
  cursosApi,
  classesApi,
  disciplinasApi,
  academicProgressionApi,
} from '@/services/api';

export type {
  AvaliacaoProgressaoAcademica,
  SimulacaoProgressaoResponse,
  ProximaClasseResponse,
  TaxaAprovacaoCursoRow,
  RegraAprovacaoRowApi,
  DisciplinaChaveRowApi,
} from '@/services/api';
