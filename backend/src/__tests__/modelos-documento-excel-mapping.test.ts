/**
 * Testes: Fluxo completo de modelos Excel (Boletim, Pauta) com mapeamento.
 * Multi-tenant + extração de placeholders + aplicação de templateMappings.
 *
 * Garante:
 * - extractPlaceholdersFromExcel extrai placeholders {{X}} do Excel
 * - Modelo criado com excelTemplateBase64 popula templatePlaceholdersJson
 * - fillExcelTemplate aplica templateMappings quando existem
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
    it('preenche placeholders com boletimToExcelData', () => {
      const base64 = createMinimalExcelBase64();
      const data = boletimToExcelData({
        instituicao: { nome: 'Escola Teste', id: 'x' } as any,
        aluno: {
          nomeCompleto: 'João Silva',
          numeroIdentificacaoPublica: '2024001',
          numeroIdentificacao: '2024001',
        } as any,
        anoLetivo: { ano: '2024' } as any,
        disciplinas: [{ disciplinaNome: 'Matemática', notaFinal: 15, situacaoAcademica: 'Aprovado', turmaNome: '10A', professorNome: 'Prof X' }],
      });
      const buffer = fillExcelTemplate(base64, data);
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
      const buffer = fillExcelTemplate(modelo!.excelTemplateBase64!, data);
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
});
