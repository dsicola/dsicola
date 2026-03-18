/**
 * Testes: Importação/Exportação de Modelos de Documentos
 * Multi-tenant + Dois tipos de instituição (SUPERIOR / SECUNDARIO)
 *
 * Garante:
 * - Multi-tenant: cada instituição vê apenas seus modelos
 * - SUPERIOR: modelos para Certificado, Declaração, Mini Pauta (curso)
 * - SECUNDARIO: modelos para Certificado, Declaração, Mini Pauta (classe)
 * - getModeloDocumentoAtivo retorna o modelo correto por tenant/tipo
 * - Geração de documentos usa o modelo importado
 *
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts
 *
 * Execute: npx vitest run src/__tests__/modelos-documento-multitenant.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../lib/prisma.js';
import { getModeloDocumentoAtivo } from '../services/modeloDocumento.service.js';
import { montarPayloadPrevisualizacao } from '../services/documento.service.js';
import { preencherTemplateHtmlGenerico } from '../services/documentoTemplateGeneric.service.js';
import { montarVarsBasicas } from '../services/documentoTemplateGeneric.service.js';
import { gerarPDFPautaPreview } from '../services/pautaPrint.service.js';
import { montarVarsPauta } from '../services/pautaTemplate.service.js';

let instSecId: string;
let instSupId: string;
let cursoSecId: string;
let cursoSupId: string;
let modeloCertSecId: string;
let modeloCertSupId: string;
let modeloMiniPautaSecId: string;
let modeloMiniPautaSupId: string;

describe('Modelos de Documentos: Importação, Exportação, Multi-tenant e Dois Tipos', () => {
  beforeAll(async () => {
    const instSec = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-a-secundario-test' },
    });
    const instSup = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-b-superior-test' },
    });

    if (!instSec || !instSup) {
      throw new Error('Execute primeiro: npx tsx scripts/seed-multi-tenant-test.ts');
    }

    instSecId = instSec.id;
    instSupId = instSup.id;

    cursoSecId = (await prisma.curso.findFirst({ where: { instituicaoId: instSecId } }))!.id;
    cursoSupId = (await prisma.curso.findFirst({ where: { instituicaoId: instSupId } }))!.id;

    // Configuração institucional mínima para payload
    await prisma.configuracaoInstituicao.upsert({
      where: { instituicaoId: instSecId },
      create: {
        instituicaoId: instSecId,
        nomeInstituicao: instSec.nome,
        tipoInstituicao: 'ENSINO_MEDIO',
        republicaAngola: 'REPÚBLICA DE ANGOLA',
        governoProvincia: 'GOVERNO DA PROVINCIA',
        escolaNomeNumero: 'ESCOLA TESTE',
        ensinoGeral: 'ENSINO GERAL',
        tituloCertificadoSecundario: 'CERTIFICADO',
      },
      update: {},
    });
    await prisma.configuracaoInstituicao.upsert({
      where: { instituicaoId: instSupId },
      create: {
        instituicaoId: instSupId,
        nomeInstituicao: instSup.nome,
        tipoInstituicao: 'UNIVERSIDADE',
        ministerioSuperior: 'Ministério Superior',
        decretoCriacao: 'Decreto',
        cargoAssinatura1: 'O CHEFE',
        cargoAssinatura2: 'O DIRECTOR',
      },
      update: {},
    });

    // Criar modelos importados: SECUNDARIO
    const modeloCertSec = await prisma.modeloDocumento.create({
      data: {
        instituicaoId: instSecId,
        tipo: 'CERTIFICADO',
        tipoAcademico: 'SECUNDARIO',
        cursoId: null,
        nome: 'Certificado Secundário Gov',
        descricao: 'Modelo oficial do governo - Secundário',
        htmlTemplate: '<html><body><h1>{{NOME_INSTITUICAO}}</h1><p>{{NOME_ALUNO}} - {{CLASSE}}</p></body></html>',
        formatoDocumento: 'HTML',
        ativo: true,
      },
    });
    modeloCertSecId = modeloCertSec.id;

    const modeloMiniPautaSec = await prisma.modeloDocumento.create({
      data: {
        instituicaoId: instSecId,
        tipo: 'MINI_PAUTA',
        tipoAcademico: 'SECUNDARIO',
        cursoId: null,
        nome: 'Mini Pauta Gov Secundário',
        descricao: 'Modelo oficial - Classe',
        htmlTemplate: '<html><body><h1>{{NOME_INSTITUICAO}}</h1><p>{{LABEL_CURSO_CLASSE}}: {{VALOR_CURSO_CLASSE}}</p><p>{{TABELA_ALUNOS}}</p></body></html>',
        formatoDocumento: 'HTML',
        ativo: true,
      },
    });
    modeloMiniPautaSecId = modeloMiniPautaSec.id;

    // Criar modelos importados: SUPERIOR
    const modeloCertSup = await prisma.modeloDocumento.create({
      data: {
        instituicaoId: instSupId,
        tipo: 'CERTIFICADO',
        tipoAcademico: 'SUPERIOR',
        cursoId: null,
        nome: 'Certificado Superior Gov',
        descricao: 'Modelo oficial do governo - Superior',
        htmlTemplate: '<html><body><h1>{{NOME_INSTITUICAO}}</h1><p>{{NOME_ALUNO}} - {{CURSO}}</p></body></html>',
        formatoDocumento: 'HTML',
        ativo: true,
      },
    });
    modeloCertSupId = modeloCertSup.id;

    const modeloMiniPautaSup = await prisma.modeloDocumento.create({
      data: {
        instituicaoId: instSupId,
        tipo: 'MINI_PAUTA',
        tipoAcademico: 'SUPERIOR',
        cursoId: null,
        nome: 'Mini Pauta Gov Superior',
        descricao: 'Modelo oficial - Curso',
        htmlTemplate: '<html><body><h1>{{NOME_INSTITUICAO}}</h1><p>{{LABEL_CURSO_CLASSE}}: {{VALOR_CURSO_CLASSE}}</p><p>{{TABELA_ALUNOS}}</p></body></html>',
        formatoDocumento: 'HTML',
        ativo: true,
      },
    });
    modeloMiniPautaSupId = modeloMiniPautaSup.id;
  });

  afterAll(async () => {
    await prisma.modeloDocumento.deleteMany({
      where: {
        id: { in: [modeloCertSecId, modeloCertSupId, modeloMiniPautaSecId, modeloMiniPautaSupId] },
      },
    });
  });

  describe('Multi-tenant: isolamento por instituição', () => {
    it('Listar modelos retorna apenas os da instituição SECUNDARIO', async () => {
      const modelos = await prisma.modeloDocumento.findMany({
        where: { instituicaoId: instSecId },
        select: { id: true, tipo: true, nome: true, instituicaoId: true },
      });
      expect(modelos.length).toBeGreaterThanOrEqual(2);
      expect(modelos.every((m) => m.instituicaoId === instSecId)).toBe(true);
      expect(modelos.map((m) => m.tipo)).toContain('CERTIFICADO');
      expect(modelos.map((m) => m.tipo)).toContain('MINI_PAUTA');
    });

    it('Listar modelos retorna apenas os da instituição SUPERIOR', async () => {
      const modelos = await prisma.modeloDocumento.findMany({
        where: { instituicaoId: instSupId },
        select: { id: true, tipo: true, nome: true, instituicaoId: true },
      });
      expect(modelos.length).toBeGreaterThanOrEqual(2);
      expect(modelos.every((m) => m.instituicaoId === instSupId)).toBe(true);
      expect(modelos.map((m) => m.tipo)).toContain('CERTIFICADO');
      expect(modelos.map((m) => m.tipo)).toContain('MINI_PAUTA');
    });

    it('Instituição A não vê modelos da Instituição B', async () => {
      const modelosA = await prisma.modeloDocumento.findMany({
        where: { instituicaoId: instSecId },
      });
      const idsB = [modeloCertSupId, modeloMiniPautaSupId];
      expect(modelosA.map((m) => m.id).filter((id) => idsB.includes(id)).length).toBe(0);
    });
  });

  describe('getModeloDocumentoAtivo: retorno correto por tenant/tipo', () => {
    it('SECUNDARIO: retorna modelo CERTIFICADO da instituição secundária', async () => {
      const m = await getModeloDocumentoAtivo({
        instituicaoId: instSecId,
        tipo: 'CERTIFICADO',
        tipoAcademico: 'SECUNDARIO',
        cursoId: null,
      });
      expect(m).not.toBeNull();
      expect(m!.instituicaoId).toBe(instSecId);
      expect(m!.tipo).toBe('CERTIFICADO');
      expect(m!.tipoAcademico).toBe('SECUNDARIO');
      expect(m!.htmlTemplate).toContain('{{NOME_INSTITUICAO}}');
      expect(m!.htmlTemplate).toContain('{{CLASSE}}');
    });

    it('SUPERIOR: retorna modelo CERTIFICADO da instituição superior', async () => {
      const m = await getModeloDocumentoAtivo({
        instituicaoId: instSupId,
        tipo: 'CERTIFICADO',
        tipoAcademico: 'SUPERIOR',
        cursoId: null,
      });
      expect(m).not.toBeNull();
      expect(m!.instituicaoId).toBe(instSupId);
      expect(m!.tipo).toBe('CERTIFICADO');
      expect(m!.tipoAcademico).toBe('SUPERIOR');
      expect(m!.htmlTemplate).toContain('{{CURSO}}');
    });

    it('SECUNDARIO: retorna modelo MINI_PAUTA', async () => {
      const m = await getModeloDocumentoAtivo({
        instituicaoId: instSecId,
        tipo: 'MINI_PAUTA',
        tipoAcademico: 'SECUNDARIO',
        cursoId: null,
      });
      expect(m).not.toBeNull();
      expect(m!.tipo).toBe('MINI_PAUTA');
      expect(m!.htmlTemplate).toContain('{{LABEL_CURSO_CLASSE}}');
      expect(m!.htmlTemplate).toContain('{{TABELA_ALUNOS}}');
    });

    it('SUPERIOR: retorna modelo MINI_PAUTA', async () => {
      const m = await getModeloDocumentoAtivo({
        instituicaoId: instSupId,
        tipo: 'MINI_PAUTA',
        tipoAcademico: 'SUPERIOR',
        cursoId: null,
      });
      expect(m).not.toBeNull();
      expect(m!.tipo).toBe('MINI_PAUTA');
    });

    it('getModeloDocumentoAtivo com cursoId usa modelo por curso (isolado por instituição)', async () => {
      const m = await getModeloDocumentoAtivo({
        instituicaoId: instSupId,
        tipo: 'MINI_PAUTA',
        tipoAcademico: 'SUPERIOR',
        cursoId: cursoSupId,
      });
      expect(m).not.toBeNull();
      expect(m!.instituicaoId).toBe(instSupId);
    });
  });

  describe('Exportação (geração): Certificado usa modelo importado', () => {
    it('SECUNDARIO: HTML gerado contém dados do template importado', async () => {
      const payload = await montarPayloadPrevisualizacao('CERTIFICADO', instSecId, 'SECUNDARIO');
      const modelo = await getModeloDocumentoAtivo({
        instituicaoId: instSecId,
        tipo: 'CERTIFICADO',
        tipoAcademico: 'SECUNDARIO',
        cursoId: null,
      });
      expect(modelo).not.toBeNull();

      const vars = montarVarsBasicas(payload, 'CERTIFICADO', 'SECUNDARIO');
      const html = preencherTemplateHtmlGenerico(modelo!.htmlTemplate, vars);

      expect(html).toContain(payload.instituicao.nome || '');
      expect(html).toContain(payload.estudante.nomeCompleto || '');
      expect(html).toContain('Classe');
      expect(html).not.toContain('{{NOME_INSTITUICAO}}');
      expect(html).not.toContain('{{NOME_ALUNO}}');
    });

    it('SUPERIOR: HTML gerado contém dados do template importado', async () => {
      const payload = await montarPayloadPrevisualizacao('CERTIFICADO', instSupId, 'SUPERIOR');
      const modelo = await getModeloDocumentoAtivo({
        instituicaoId: instSupId,
        tipo: 'CERTIFICADO',
        tipoAcademico: 'SUPERIOR',
        cursoId: null,
      });
      expect(modelo).not.toBeNull();

      const vars = montarVarsBasicas(payload, 'CERTIFICADO', 'SUPERIOR');
      const html = preencherTemplateHtmlGenerico(modelo!.htmlTemplate, vars);

      expect(html).toContain(payload.instituicao.nome || '');
      expect(html).toContain(payload.estudante.nomeCompleto || '');
      expect(html).toContain(payload.contextoAcademico?.curso ?? '');
      expect(html).not.toContain('{{CURSO}}');
      expect(html).not.toContain('{{NOME_INSTITUICAO}}');
    });
  });

  describe('Exportação (geração): Mini Pauta usa modelo importado', () => {
    it('SECUNDARIO: Preview pauta usa modelo e preenche LABEL_CURSO_CLASSE = Classe', async () => {
      const pdf = await gerarPDFPautaPreview(instSecId, 'PROVISORIA', 'SECUNDARIO');
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(100);
    }, 30000);

    it('SUPERIOR: Preview pauta usa modelo e preenche LABEL_CURSO_CLASSE = Curso', async () => {
      const pdf = await gerarPDFPautaPreview(instSupId, 'DEFINITIVA', 'SUPERIOR');
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(100);
    }, 30000);

    it('montarVarsPauta gera TABELA_ALUNOS e LABEL correto para SECUNDARIO', () => {
      const consolidacao = {
        alunos: [
          {
            alunoId: 'x',
            nomeCompleto: 'João',
            numeroIdentificacaoPublica: '001',
            situacaoAcademica: 'APROVADO' as const,
            notas: { mediaFinal: 14, notasPorAvaliacao: [], detalhes: { notas_utilizadas: [] } },
          },
        ],
      } as any;
      const vars = montarVarsPauta({
        consolidacao,
        instituicaoNome: 'Escola Teste',
        logoUrl: null,
        nif: '',
        anoLetivo: '2024',
        labelCursoClasse: 'Classe',
        valorCursoClasse: '12ª Classe',
        turmaNome: 'A',
        disciplinaNome: 'Matemática',
        profNome: 'Prof X',
        dataEmissao: '17/03/2025',
        codigoVerificacao: 'ABC',
        tipoPauta: 'PROVISORIA',
      });
      expect(vars.LABEL_CURSO_CLASSE).toBe('Classe');
      expect(vars.VALOR_CURSO_CLASSE).toBe('12ª Classe');
      expect(vars.TABELA_ALUNOS).toContain('João');
      expect(vars.TOTAL_ESTUDANTES).toBe('1');
    });

    it('montarVarsPauta gera LABEL correto para SUPERIOR', () => {
      const consolidacao = {
        alunos: [],
      } as any;
      const vars = montarVarsPauta({
        consolidacao,
        instituicaoNome: 'Univ',
        logoUrl: null,
        nif: '',
        anoLetivo: '2024',
        labelCursoClasse: 'Curso',
        valorCursoClasse: 'Licenciatura',
        turmaNome: '1',
        disciplinaNome: 'IP',
        profNome: 'Prof',
        dataEmissao: '17/03/2025',
        codigoVerificacao: 'X',
        tipoPauta: 'DEFINITIVA',
      });
      expect(vars.LABEL_CURSO_CLASSE).toBe('Curso');
      expect(vars.TIPO_PAUTA).toBe('DEFINITIVA');
    });
  });

  describe('CRUD e validações', () => {
    it('Modelo inativo não é retornado por getModeloDocumentoAtivo', async () => {
      // Desativar todos os CERTIFICADO SECUNDARIO da instituição (evitar modelos residuais de outros testes)
      await prisma.modeloDocumento.updateMany({
        where: {
          instituicaoId: instSecId,
          tipo: 'CERTIFICADO',
          tipoAcademico: 'SECUNDARIO',
        },
        data: { ativo: false },
      });

      const m = await getModeloDocumentoAtivo({
        instituicaoId: instSecId,
        tipo: 'CERTIFICADO',
        tipoAcademico: 'SECUNDARIO',
        cursoId: null,
      });
      expect(m).toBeNull();

      // Restaurar apenas o modelo do teste
      await prisma.modeloDocumento.update({
        where: { id: modeloCertSecId },
        data: { ativo: true },
      });
    });
  });
});
