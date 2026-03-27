/**
 * Campos e categorias para mapeamento Excel (CELL_MAPPING).
 * Rótulos claros; cada `value` corresponde ao que o backend resolve (excelTemplate.service).
 */
import type { CampoMapeamentoExcel } from "./pautaConclusaoExcelFields";
import { CATEGORIAS_NOTAS_PAUTA_CONCLUSAO_EXCEL, CAMPOS_NOTA_PAUTA_CONCLUSAO } from "./pautaConclusaoExcelFields";

export type { CampoMapeamentoExcel };

// --- Pauta de Conclusão (cabeçalho: só caminhos que getValueByPath preenche sem linha de aluno) ---
export const CAMPOS_PAUTA_CONCLUSAO_CABECALHO: CampoMapeamentoExcel[] = [
  { value: "instituicao.nome", label: "Nome da instituição (cabeçalho)" },
  { value: "turma", label: "Turma (texto no cabeçalho)" },
  { value: "especialidade", label: "Especialidade / curso (cabeçalho)" },
  { value: "anoLetivo", label: "Ano letivo (texto, ex.: 2024/2025)" },
  { value: "classe", label: "Classe (texto no cabeçalho, se usar)" },
  {
    value: "disciplinas",
    label: "Nomes de todas as disciplinas (uma linha separada por vírgulas — cabeçalho)",
  },
];

/** Uma linha da lista = um aluno. */
export const CAMPOS_PAUTA_CONCLUSAO_ALUNO: CampoMapeamentoExcel[] = [
  { value: "student.n", label: "N.º de ordem na tabela (1, 2, 3…)" },
  { value: "student.fullName", label: "Nome completo do aluno" },
  { value: "student.numeroEstudante", label: "N.º de estudante (REC / identificação pública)" },
  { value: "student.obs", label: "Observação (ex.: APTO/A)" },
  { value: "student.estagio", label: "Estágio (nota numérica, se existir)" },
  { value: "student.cfPlano", label: "C.F. plano (nota numérica, se existir)" },
  { value: "student.pap", label: "PAP (nota numérica, se existir)" },
  { value: "student.classFinal", label: "Classificação final (nota numérica, se existir)" },
];

export const CATEGORIAS_EXCEL_PAUTA_CONCLUSAO: { titulo: string; campos: CampoMapeamentoExcel[] }[] = [
  {
    titulo: "Cabeçalho — células únicas (topo do modelo)",
    campos: CAMPOS_PAUTA_CONCLUSAO_CABECALHO,
  },
  {
    titulo: "Lista de alunos — cada linha é um estudante",
    campos: CAMPOS_PAUTA_CONCLUSAO_ALUNO,
  },
  ...CATEGORIAS_NOTAS_PAUTA_CONCLUSAO_EXCEL,
];

// --- Boletim ---
export const CAMPOS_BOLETIM_CABECALHO: CampoMapeamentoExcel[] = [
  { value: "instituicao.nome", label: "Nome da instituição" },
  {
    value: "aluno.nomeCompleto",
    label: "Nome completo do aluno (este boletim)",
  },
  {
    value: "aluno.numeroIdentificacao",
    label: "N.º de estudante (aparece também como número público, se existir)",
  },
  {
    value: "anoLetivo.ano",
    label: "Ano letivo (número, ex.: 2024)",
  },
];

export const CAMPOS_BOLETIM_DISCIPLINA: CampoMapeamentoExcel[] = [
  {
    value: "disciplina.disciplinaNome",
    label: "Nome da disciplina",
  },
  {
    value: "disciplina.notaFinal",
    label: "Nota final da disciplina",
  },
  {
    value: "disciplina.situacaoAcademica",
    label: "Situação (Aprovado, Reprovado…)",
  },
  {
    value: "disciplina.professorNome",
    label: "Nome do professor da disciplina",
  },
  {
    value: "disciplina.cargaHoraria",
    label: "Carga horária (horas)",
  },
];

export const CATEGORIAS_EXCEL_BOLETIM: { titulo: string; campos: CampoMapeamentoExcel[] }[] = [
  {
    titulo: "Cabeçalho — dados do aluno e da instituição (células únicas)",
    campos: CAMPOS_BOLETIM_CABECALHO,
  },
  {
    titulo: "Lista de disciplinas — cada linha = uma disciplina do aluno",
    campos: CAMPOS_BOLETIM_DISCIPLINA,
  },
];

/** Dropdown compacto (tabela): cabeçalho + colunas de disciplina. */
export const CAMPOS_COL_BOLETIM_FLAT: CampoMapeamentoExcel[] = [
  ...CAMPOS_BOLETIM_CABECALHO,
  ...CAMPOS_BOLETIM_DISCIPLINA,
];

// --- Mini Pauta (só caminhos que getValueByPathMiniPauta preenche) ---
export const CAMPOS_MINI_PAUTA_CABECALHO: CampoMapeamentoExcel[] = [
  { value: "instituicao.nome", label: "Nome da instituição" },
  { value: "turma", label: "Turma (ex.: 10ª A)" },
  { value: "anoLetivo", label: "Ano letivo (texto)" },
  {
    value: "labelCursoClasse",
    label: "Etiqueta curso ou classe (ex.: “Classe” ou “Curso”) — traduzível por instituição",
  },
  {
    value: "valorCursoClasse",
    label: "Valor ao lado da etiqueta (ex.: 10ª ou nome do curso)",
  },
  {
    value: "disciplina",
    label: "Nome da disciplina desta pauta",
  },
  { value: "professor", label: "Professor responsável" },
  { value: "dataEmissao", label: "Data de emissão do documento" },
  {
    value: "codigoVerificacao",
    label: "Código de verificação",
  },
  {
    value: "tipoPauta",
    label: "Tipo de pauta (DEFINITIVA / PROVISÓRIA — texto)",
  },
];

export const CAMPOS_MINI_PAUTA_ALUNO: CampoMapeamentoExcel[] = [
  { value: "student.n", label: "N.º de ordem na lista" },
  { value: "student.fullName", label: "Nome completo" },
  { value: "student.numeroEstudante", label: "N.º de estudante" },
  {
    value: "student.avaliacoes",
    label:
      "Todas as notas por avaliação (um texto, valores separados — uma coluna no Excel; ordem = ordem do sistema)",
  },
  { value: "student.exame", label: "Nota de exame ou recurso (uma coluna)" },
  { value: "student.mediaFinal", label: "Média final (MF)" },
  { value: "student.situacao", label: "Situação final (Aprovado, Reprovado…)" },
];

export const CATEGORIAS_EXCEL_MINI_PAUTA: { titulo: string; campos: CampoMapeamentoExcel[] }[] = [
  {
    titulo: "Cabeçalho — uma disciplina, turma fixa (células únicas)",
    campos: CAMPOS_MINI_PAUTA_CABECALHO,
  },
  {
    titulo: "Lista de alunos — cada linha é um estudante nesta disciplina",
    campos: CAMPOS_MINI_PAUTA_ALUNO,
  },
];

export const CAMPOS_COL_MINI_PAUTA_FLAT: CampoMapeamentoExcel[] = [
  ...CAMPOS_MINI_PAUTA_CABECALHO,
  ...CAMPOS_MINI_PAUTA_ALUNO,
];

/** Pauta conclusão: cabeçalho + aluno + notas (dropdown tabela). */
export const CAMPOS_COL_PAUTA_CONCLUSAO_FLAT: CampoMapeamentoExcel[] = [
  ...CAMPOS_PAUTA_CONCLUSAO_CABECALHO,
  ...CAMPOS_PAUTA_CONCLUSAO_ALUNO,
  ...CAMPOS_NOTA_PAUTA_CONCLUSAO,
];

/** Textos de ajuda curtos por tipo (mapeamento Excel). */
export const DICA_MAPEAMENTO_EXCEL = {
  PAUTA_CONCLUSAO:
    "No fim do nome da nota, 1 / 2 / 3 = trimestre (ex.: nota.NPT2 = NPT do 2.º). O mesmo para MAC, NPP e MT. Para cada coluna de nota por cadeira, escolha a disciplina na barra lateral antes de soltar o campo.",
  BOLETIM:
    "Primeiro mapeie o cabeçalho (instituição, aluno, ano). Depois defina a linha inicial da lista — cada linha seguinte é uma disciplina desse aluno (nome, nota final, situação, professor…).",
  MINI_PAUTA:
    "Cabeçalho: turma e uma disciplina. Lista: um aluno por linha nessa disciplina. Várias notas parciais vêm num único texto («Todas as notas por avaliação»); use também colunas separadas para exame, média final e situação, se o modelo tiver.",
} as const;
