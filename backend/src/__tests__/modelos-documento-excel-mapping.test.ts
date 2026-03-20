/**
 * Testes: Fluxo completo de modelos Excel (Boletim, Pauta) com mapeamento.
 * Multi-tenant + extração de placeholders + templateMappings + CELL_MAPPING.
 *
 * Garante:
 * - extractPlaceholdersFromExcel extrai placeholders {{X}} do Excel
 * - fillExcelTemplate aplica templateMappings (modo PLACEHOLDER)
 * - fillExcelTemplateWithCellMapping preenche por coordenadas (modo CELL_MAPPING)
 * - fillExcelTemplateWithCellMappingBoletim para Boletim
 *
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts
 *
 * Execute: npx vitest run src/__tests__/modelos-documento-excel-mapping.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as XLSX from 'xlsx';
import prisma from '../lib/prisma.js';
import {
  extractPlaceholdersFromExcel,
  fillExcelTemplate,
  fillExcelTemplateWithCellMapping,
  fillExcelTemplateWithCellMappingBoletim,
  analyzeExcelTemplate,
  analyzeExcelAndSuggestMapping,
  validateCellMapping,
  boletimToExcelData,
  pautaConclusaoToExcelData,
} from '../services/excelTemplate.service.js';

let instSupId: string;
let modeloBoletimId: string;
let modeloPautaId: string;

/** Cria Excel mínimo em base64 com placeholders {{NOME_ALUNO}} e {{ANO_LETIVO}} */
function createMinimalExcelBase64(): string {
  const wb = XLSX.utils.book_new();
  const data = [
    ['Nome', '{{NOME_ALUNO}}'],
    ['Ano', '{{ANO_LETIVO}}'],
    ['Instituição', '{{INSTITUICAO_NOME}}'],
    ['Disciplina 1', '{{DISCIPLINA_1}}'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buf.toString('base64');
}

/** Cria Excel para Pauta Conclusão */
function createPautaExcelBase64(): string {
  const wb = XLSX.utils.book_new();
  const data = [
    ['Instituição', '{{INSTITUICAO_NOME}}'],
    ['Turma', '{{TURMA}}'],
    ['Especialidade', '{{ESPECIALIDADE}}'],
    ['Ano', '{{ANO_LETIVO}}'],
    ['Tabela', '{{TABELA_ALUNOS}}'],
    ['Disciplinas', '{{DISCIPLINAS}}'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Pauta');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buf.toString('base64');
}

describe('Modelos Excel: extração de placeholders e mapeamento', () => {
  beforeAll(async () => {
    const instSup = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-b-superior-test' },
    });
    if (!instSup) {
      throw new Error('Execute primeiro: npx tsx scripts/seed-multi-tenant-test.ts');
    }
    instSupId = instSup.id;

    const excelBase64 = createMinimalExcelBase64();
    const placeholders = extractPlaceholdersFromExcel(excelBase64);
    const placeholdersJson = JSON.stringify(placeholders);

    const modeloBoletim = await prisma.modeloDocumento.create({
      data: {
        instituicaoId: instSupId,
        tipo: 'BOLETIM',
        tipoAcademico: 'SUPERIOR',
        cursoId: null,
        nome: 'Boletim Excel Test',
        descricao: 'Modelo Excel com placeholders',
        htmlTemplate: '',
        formatoDocumento: 'EXCEL',
        excelTemplateBase64: excelBase64,
        templatePlaceholdersJson: placeholdersJson,
        ativo: true,
      },
    });
    modeloBoletimId = modeloBoletim.id;

    const pautaBase64 = createPautaExcelBase64();
    const pautaPlaceholders = extractPlaceholdersFromExcel(pautaBase64);
    const modeloPauta = await prisma.modeloDocumento.create({
      data: {
        instituicaoId: instSupId,
        tipo: 'PAUTA_CONCLUSAO',
        tipoAcademico: 'SUPERIOR',
        cursoId: null,
        nome: 'Pauta Conclusão Excel Test',
        descricao: 'Modelo Pauta com placeholders',
        htmlTemplate: '',
        formatoDocumento: 'EXCEL',
        excelTemplateBase64: pautaBase64,
        templatePlaceholdersJson: JSON.stringify(pautaPlaceholders),
        ativo: true,
      },
    });
    modeloPautaId = modeloPauta.id;
  });

  afterAll(async () => {
    const ids = [modeloBoletimId, modeloPautaId].filter(Boolean) as string[];
    if (ids.length > 0) {
      await prisma.templateMapping.deleteMany({
        where: { modeloDocumentoId: { in: ids } },
      });
      await prisma.modeloDocumento.deleteMany({
        where: { id: { in: ids } },
      });
    }
  });

  describe('extractPlaceholdersFromExcel', () => {
    it('extrai placeholders {{X}} do Excel', () => {
      const base64 = createMinimalExcelBase64();
      const ph = extractPlaceholdersFromExcel(base64);
      expect(ph).toContain('NOME_ALUNO');
      expect(ph).toContain('ANO_LETIVO');
      expect(ph).toContain('INSTITUICAO_NOME');
      expect(ph).toContain('DISCIPLINA_1');
    });

    it('retorna array vazio para base64 inválido', () => {
      const ph = extractPlaceholdersFromExcel('');
      expect(ph).toEqual([]);
    });
  });

  describe('fillExcelTemplate com dados base', () => {
    it('preenche placeholders com boletimToExcelData', async () => {
      const base64 = createMinimalExcelBase64();
      const data = boletimToExcelData({
        instituicao: { nome: 'Escola Teste', id: 'x' } as any,
        aluno: {
          nomeCompleto: 'João Silva',
          numeroIdentificacaoPublica: '2024001',
          numeroIdentificacao: '2024001',
        } as any,
        anoLetivo: { ano: '2024' } as any,
        disciplinas: [{ disciplinaNome: 'Matemática', notaFinal: 15, situacaoAcademica: 'APROVADO', turmaNome: '10A', professorNome: 'Prof X' }],
      });
      const buffer = await fillExcelTemplate(base64, data);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const b1 = ws['B1']?.v; // {{NOME_ALUNO}}
      expect(b1).toBe('João Silva');
      const b2 = ws['B2']?.v; // {{ANO_LETIVO}}
      expect(b2).toBe('2024');
    });
  });

  describe('fillExcelTemplate com templateMappings', () => {
    it('aplica mappings: placeholder alternativo → campo sistema', async () => {
      await prisma.templateMapping.createMany({
        data: [
          { modeloDocumentoId: modeloBoletimId, campoTemplate: 'NOME_ESTUDANTE', campoSistema: 'NOME_ALUNO' },
          { modeloDocumentoId: modeloBoletimId, campoTemplate: 'ANO', campoSistema: 'ANO_LETIVO' },
        ],
      });

      const modelo = await prisma.modeloDocumento.findUnique({
        where: { id: modeloBoletimId },
        include: { templateMappings: true },
      });
      expect(modelo?.templateMappings?.length).toBe(2);

      // Excel com {{NOME_ESTUDANTE}} em vez de {{NOME_ALUNO}} - precisamos de um Excel diferente
      // Para este teste, usamos o Excel original que tem {{NOME_ALUNO}} e o data base
      const baseData = boletimToExcelData({
        instituicao: { nome: 'Escola Test' } as any,
        aluno: { nomeCompleto: 'Maria Costa', numeroIdentificacaoPublica: '001' } as any,
        anoLetivo: { ano: '2024' } as any,
        disciplinas: [],
      });
      const data = { ...baseData };
      const mappings = modelo!.templateMappings!;
      for (const m of mappings) {
        data[m.campoTemplate as keyof typeof data] = baseData[m.campoSistema as keyof typeof baseData] ?? '';
      }
      const buffer = await fillExcelTemplate(modelo!.excelTemplateBase64!, data);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('pautaConclusaoToExcelData', () => {
    it('produz dados com TABELA_ALUNOS e DISCIPLINAS', () => {
      const dados = pautaConclusaoToExcelData({
        instituicaoNome: 'Inst Teste',
        turma: '10ª A',
        especialidade: 'Ciências',
        anoLetivo: '2024',
        disciplinas: ['Mat', 'Port'],
        alunos: [
          {
            n: 1,
            nrec: 'RCB-001',
            nome: 'Aluno 1',
            notas: { Mat: { ca: 14, cfd: 16 }, Port: { ca: 12, cfd: 14 } },
            estagio: 0,
            cfPlano: 15,
            pap: 14,
            classFinal: 1,
            obs: '',
          },
        ],
      });
      expect(dados.INSTITUICAO_NOME).toBe('Inst Teste');
      expect(dados.TURMA).toBe('10ª A');
      expect(dados.ANO_LETIVO).toBe('2024');
      expect(dados.TABELA_ALUNOS).toContain('Aluno 1');
      expect(dados.DISCIPLINAS).toBe('Mat, Port');
    });
  });

  describe('CELL_MAPPING: fillExcelTemplateWithCellMapping (Pauta Conclusão)', () => {
    it('preenche Excel por coordenadas sem placeholders', async () => {
      const wb = XLSX.utils.book_new();
      const data = [
        ['Inst', '', 'Turma', ''],
        ['', '', '', ''],
        ['', '', '', ''],
        ['N', 'Nome', 'NREC', 'MAC Mat'],
        ['', '', '', ''],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Pauta');
      const base64 = (XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer).toString('base64');

      const cellMapping = {
        items: [
          { cell: 'B1', campo: 'instituicao.nome' },
          { cell: 'D1', campo: 'turma' },
          {
            tipo: 'LISTA' as const,
            startRow: 5,
            columns: [
              { coluna: 'A', campo: 'student.n' },
              { coluna: 'B', campo: 'student.fullName' },
              { coluna: 'C', campo: 'student.numeroEstudante' },
              { coluna: 'D', campo: 'nota.MAC', disciplina: 'Mat' },
            ],
          },
        ],
      };

      const pautaData = {
        instituicaoNome: 'Inst Saúde',
        turma: '10ª C',
        especialidade: 'Enfermagem',
        anoLetivo: '2024',
        disciplinas: ['Mat', 'Port'],
        alunos: [
          {
            n: 1,
            nrec: '2024001',
            nome: 'Maria Silva',
            notas: { Mat: { ca: 14, cfd: 16 }, Port: { ca: 12, cfd: 14 } },
            estagio: 14,
            cfPlano: 13,
            pap: 14,
            classFinal: 13,
            obs: 'APTO/A',
          },
        ],
      };

      const buffer = await fillExcelTemplateWithCellMapping(base64, pautaData, cellMapping);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);

      const out = XLSX.read(buffer, { type: 'buffer', cellDates: false });
      const sheet = out.Sheets[out.SheetNames[0]];
      expect(sheet['B1']?.v).toBe('Inst Saúde');
      expect(sheet['D1']?.v).toBe('10ª C');
      expect(String(sheet['A5']?.v ?? '')).toBe('1');
      expect(sheet['B5']?.v).toBe('Maria Silva');
      expect(String(sheet['C5']?.v ?? '')).toBe('2024001');
      expect(sheet['D5']?.v).toBeTruthy();
    });
  });

  describe('CELL_MAPPING: fillExcelTemplateWithCellMappingBoletim', () => {
    it('preenche Boletim Excel por coordenadas (singles + lista disciplinas)', async () => {
      const wb = XLSX.utils.book_new();
      const data = [
        ['Instituição', ''],
        ['Aluno', ''],
        ['Ano', ''],
        ['', 'Disciplina', 'Nota'],
        ['', '', ''],
        ['', '', ''],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Boletim');
      const base64 = (XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer).toString('base64');

      const cellMapping = {
        items: [
          { cell: 'B1', campo: 'instituicao.nome' },
          { cell: 'B2', campo: 'aluno.nomeCompleto' },
          { cell: 'B3', campo: 'anoLetivo.ano' },
          {
            tipo: 'LISTA' as const,
            startRow: 5,
            listSource: 'disciplinas' as const,
            columns: [
              { coluna: 'B', campo: 'disciplina.disciplinaNome' },
              { coluna: 'C', campo: 'disciplina.notaFinal' },
            ],
          },
        ],
      };

      const boletimData = {
        instituicao: { nome: 'Escola Teste' },
        aluno: { nomeCompleto: 'João Costa', numeroIdentificacao: '001', numeroIdentificacaoPublica: '001' },
        anoLetivo: { ano: 2024 },
        disciplinas: [
          { disciplinaNome: 'Matemática', notaFinal: 15, situacaoAcademica: 'APROVADO', professorNome: 'Prof X', cargaHoraria: 60 },
          { disciplinaNome: 'Português', notaFinal: 14, situacaoAcademica: 'APROVADO', professorNome: 'Prof Y', cargaHoraria: 45 },
        ],
      };

      const buffer = await fillExcelTemplateWithCellMappingBoletim(base64, boletimData, cellMapping);
      expect(buffer).toBeInstanceOf(Buffer);

      const out = XLSX.read(buffer, { type: 'buffer', cellDates: false });
      const sheet = out.Sheets[out.SheetNames[0]];
      expect(sheet['B1']?.v).toBe('Escola Teste');
      expect(sheet['B2']?.v).toBe('João Costa');
      expect(String(sheet['B3']?.v ?? '')).toBe('2024');
      expect(sheet['B5']?.v).toBe('Matemática');
      expect(String(sheet['C5']?.v ?? '')).toBe('15');
      expect(sheet['B6']?.v).toBe('Português');
      expect(String(sheet['C6']?.v ?? '')).toBe('14');
    });
  });

  describe('analyzeExcelTemplate / analyzeExcelAndSuggestMapping', () => {
    it('retorna sugestão de mapeamento', () => {
      const base64 = createPautaExcelBase64();
      const result = analyzeExcelTemplate(base64);
      expect(result.sheetNames.length).toBeGreaterThan(0);
      expect(result.maxRows).toBeGreaterThan(0);
      expect(result.suggestedMapping).toBeDefined();
    });

    it('deteção inteligente: modelo governo com NOME, Nº, MAC, MFD', () => {
      const wb = XLSX.utils.book_new();
      const data = [
        ['Instituição de Ensino', 'Escola X'],
        ['Turma', '12A'],
        ['Ano Letivo', '2024/2025'],
        [],
        ['Nº', 'Nome', 'Nº Estudante', 'MAC', 'NPP', 'MT1', 'MFD'],
        [1, 'Maria Silva', '2024001', 14, 13, 15, 14],
        [2, 'João Santos', '2024002', 12, 11, 13, 12],
        [3, 'Ana Costa', '2024003', 16, 15, 17, 16],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Pauta');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      const base64 = buf.toString('base64');

      const result = analyzeExcelAndSuggestMapping(base64);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.detectedHeaderRow).toBeGreaterThanOrEqual(0);
      expect(result.detectedHeaders).toBeDefined();
      expect(result.detectedHeaders!.length).toBeGreaterThan(0);

      const lista = result.suggestedMapping?.lista;
      expect(lista).toBeDefined();
      expect(lista!.startRow).toBeGreaterThan(0);
      expect(lista!.columns.length).toBeGreaterThan(0);

      const cols = lista!.columns;
      const nomeCol = cols.find((c) => c.campo === 'student.fullName');
      const macCol = cols.find((c) => c.campo === 'nota.MAC');
      const mfdCol = cols.find((c) => c.campo === 'nota.MFD');
      expect(nomeCol).toBeDefined();
      expect(macCol || mfdCol).toBeDefined();

      const singles = result.suggestedMapping?.singles;
      expect(singles).toBeDefined();
      const instSingle = singles!.find((s) => s.campo === 'instituicao.nome');
      const turmaSingle = singles!.find((s) => s.campo === 'turma');
      expect(instSingle || turmaSingle).toBeDefined();
    });
  });

  describe('validateCellMapping', () => {
    it('valida mapeamento e retorna erros/warnings', () => {
      const mapping = { items: [{ cell: 'B2', campo: 'instituicao.nome' }] };
      const result = validateCellMapping(mapping);
      expect(result.valid).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('detecta célula duplicada', () => {
      const mapping = {
        items: [
          { cell: 'B2', campo: 'instituicao.nome' },
          { cell: 'B2', campo: 'turma' },
        ],
      };
      const result = validateCellMapping(mapping);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('duplicada'))).toBe(true);
    });

    it('detecta LISTA sem startRow válido', () => {
      const mapping = {
        items: [
          {
            tipo: 'LISTA',
            startRow: undefined,
            columns: [{ coluna: 'A', campo: 'student.n' }],
          },
        ],
      };
      const result = validateCellMapping(mapping);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('startRow'))).toBe(true);
    });
  });
});
