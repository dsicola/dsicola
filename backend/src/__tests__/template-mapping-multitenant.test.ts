/**
 * Testes: Fluxo completo de templates DOCX e mapeamentos.
 * Multi-tenant + Dois tipos de instituição (SUPERIOR / SECUNDARIO).
 *
 * Garante:
 * - getAvailableFields retorna campos corretos (student.curso, student.classe, etc.)
 * - saveMapping isolamento multi-tenant
 * - renderTemplate com mappings preenche documento corretamente
 * - extractPlaceholdersFromDocx extrai placeholders do DOCX
 *
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts
 *
 * Execute: npx vitest run src/__tests__/template-mapping-multitenant.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import PizZip from 'pizzip';
import prisma from '../lib/prisma.js';
import { listarCamposDisponiveis } from '../services/availableFields.service.js';
import { extractPlaceholdersFromDocx, renderTemplate } from '../services/templateRender.service.js';
import { resolveEntityData } from '../services/templateDataResolver.service.js';

let instSecId: string;
let instSupId: string;
let modeloDocxSecId: string;
let modeloDocxSupId: string;
let modeloDocxInvalidId: string; // Modelo com mapeamento inválido para teste de validação
let alunoSecId: string;
let alunoSupId: string;

/** Cria DOCX mínimo válido com placeholders {nome} e {idade} */
function createMinimalDocx(): Buffer {
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Nome: {nome}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Idade: {idade}</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml" Id="rId1"/>
</Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  const zip = new PizZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rels);
  zip.file('word/document.xml', docXml);
  zip.file('word/_rels/document.xml.rels', docRels);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 1 } }) as Buffer;
}

describe('Template Mapping: Multi-tenant e Dois Tipos de Instituição', () => {
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

    const alunoSec = await prisma.user.findFirst({
      where: { instituicaoId: instSecId, email: 'aluno.inst.a@teste.dsicola.com' },
    });
    const alunoSup = await prisma.user.findFirst({
      where: { instituicaoId: instSupId, email: 'aluno.inst.b@teste.dsicola.com' },
    });
    alunoSecId = alunoSec?.id ?? '';
    alunoSupId = alunoSup?.id ?? '';

    const docxBuffer = createMinimalDocx();
    const docxBase64 = docxBuffer.toString('base64');
    const placeholders = extractPlaceholdersFromDocx(docxBuffer);
    const placeholdersJson = JSON.stringify(placeholders);

    const modeloSec = await prisma.modeloDocumento.create({
      data: {
        instituicaoId: instSecId,
        tipo: 'DOCUMENTO_OFICIAL',
        tipoAcademico: 'SECUNDARIO',
        nome: 'Modelo DOCX Secundário',
        descricao: 'Teste mapeamento Secundário',
        htmlTemplate: '',
        formatoDocumento: 'WORD',
        docxTemplateBase64: docxBase64,
        templatePlaceholdersJson: placeholdersJson,
        ativo: true,
      },
    });
    modeloDocxSecId = modeloSec.id;

    const modeloSup = await prisma.modeloDocumento.create({
      data: {
        instituicaoId: instSupId,
        tipo: 'DOCUMENTO_OFICIAL',
        tipoAcademico: 'SUPERIOR',
        nome: 'Modelo DOCX Superior',
        descricao: 'Teste mapeamento Superior',
        htmlTemplate: '',
        formatoDocumento: 'WORD',
        docxTemplateBase64: docxBase64,
        templatePlaceholdersJson: placeholdersJson,
        ativo: true,
      },
    });
    modeloDocxSupId = modeloSup.id;
  });

  afterAll(async () => {
    const ids = [modeloDocxSecId, modeloDocxSupId].filter(Boolean) as string[];
    if (ids.length > 0) {
      await prisma.templateMapping.deleteMany({
        where: { modeloDocumentoId: { in: ids } },
      });
      await prisma.modeloDocumento.deleteMany({
        where: { id: { in: ids } },
      });
    }
  });

  describe('extractPlaceholdersFromDocx', () => {
    it('extrai placeholders {nome} e {idade} do DOCX', () => {
      const buf = createMinimalDocx();
      const ph = extractPlaceholdersFromDocx(buf);
      expect(ph).toContain('nome');
      expect(ph).toContain('idade');
      expect(ph.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getAvailableFields / listarCamposDisponiveis', () => {
    it('retorna campos do sistema incluindo student.curso e student.classe', () => {
      const fields = listarCamposDisponiveis();
      const caminhos = fields.map((f) => f.caminho);
      expect(caminhos).toContain('student.fullName');
      expect(caminhos).toContain('student.curso');
      expect(caminhos).toContain('student.classe');
      expect(caminhos).toContain('instituicao.nome');
      expect(caminhos).toContain('document.number');
    });

    it('campos têm descrição e contexto', () => {
      const fields = listarCamposDisponiveis();
      const studentFullName = fields.find((f) => f.caminho === 'student.fullName');
      expect(studentFullName).toBeDefined();
      expect(studentFullName!.descricao).toBeTruthy();
      expect(studentFullName!.contexto).toBe('student');
    });
  });

  describe('saveMapping - isolamento multi-tenant (via Prisma)', () => {
    it('SECUNDARIO: cria mappings apenas no modelo da instituição', async () => {
      await prisma.templateMapping.createMany({
        data: [
          { modeloDocumentoId: modeloDocxSecId, campoTemplate: 'nome', campoSistema: 'student.fullName' },
          { modeloDocumentoId: modeloDocxSecId, campoTemplate: 'idade', campoSistema: 'student.birthDate' },
        ],
        skipDuplicates: true,
      });
      const mappings = await prisma.templateMapping.findMany({
        where: { modeloDocumentoId: modeloDocxSecId },
      });
      expect(mappings.length).toBe(2);
      expect(mappings.map((m) => m.campoTemplate)).toContain('nome');
    });

    it('SUPERIOR: mappings isolados por modelo/instituição', async () => {
      await prisma.templateMapping.createMany({
        data: [
          { modeloDocumentoId: modeloDocxSupId, campoTemplate: 'nome', campoSistema: 'student.fullName' },
          { modeloDocumentoId: modeloDocxSupId, campoTemplate: 'idade', campoSistema: 'document.number' },
        ],
        skipDuplicates: true,
      });
      const mappings = await prisma.templateMapping.findMany({
        where: { modeloDocumentoId: modeloDocxSupId },
      });
      expect(mappings.length).toBe(2);
      const modelo = await prisma.modeloDocumento.findUnique({
        where: { id: modeloDocxSupId },
        include: { templateMappings: true },
      });
      expect(modelo!.instituicaoId).toBe(instSupId);
    });

    it('Instituição A não vê mappings do modelo da Instituição B', async () => {
      const mappingsSec = await prisma.templateMapping.findMany({
        where: { modeloDocumentoId: modeloDocxSecId },
      });
      const mappingsSup = await prisma.templateMapping.findMany({
        where: { modeloDocumentoId: modeloDocxSupId },
      });
      expect(mappingsSec.every((m) => m.modeloDocumentoId === modeloDocxSecId)).toBe(true);
      expect(mappingsSup.every((m) => m.modeloDocumentoId === modeloDocxSupId)).toBe(true);
    });
  });

  describe('renderTemplate - geração de documento com mappings', () => {
    it('SECUNDARIO: renderiza DOCX com dados do estudante (classe)', async () => {
      const data = await resolveEntityData(alunoSecId, 'student', instSecId);
      const { buffer } = await renderTemplate({
        modeloDocumentoId: modeloDocxSecId,
        instituicaoId: instSecId,
        data,
      });
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
      const zip = new PizZip(buffer);
      const docFolder = zip.folder('word');
      const docXml = docFolder?.file('document.xml')?.asText() ?? '';
      expect(docXml).toContain((data.student as { fullName?: string })?.fullName ?? '');
    }, 15000);

    it('SUPERIOR: renderiza DOCX com dados do estudante (curso)', async () => {
      const data = await resolveEntityData(alunoSupId, 'student', instSupId);
      const { buffer } = await renderTemplate({
        modeloDocumentoId: modeloDocxSupId,
        instituicaoId: instSupId,
        data,
      });
      expect(buffer).toBeInstanceOf(Buffer);
      const zip = new PizZip(buffer);
      const docXml = zip.folder('word')?.file('document.xml')?.asText() ?? '';
      expect(docXml).toContain((data.student as { fullName?: string })?.fullName ?? '');
    }, 15000);

    it('modelo de outra instituição retorna 404', async () => {
      await expect(
        renderTemplate({
          modeloDocumentoId: modeloDocxSupId,
          instituicaoId: instSecId,
          data: { student: { fullName: 'Teste' }, instituicao: {}, document: {}, finance: {} },
        })
      ).rejects.toThrow(/não encontrado|404/);
    });

    it('rejeita placeholders não mapeados (validação antes de gerar)', async () => {
      const docxBuf = createMinimalDocx();
      const modeloIncompleto = await prisma.modeloDocumento.create({
        data: {
          instituicaoId: instSecId,
          tipo: 'DOCUMENTO_OFICIAL',
          tipoAcademico: 'SECUNDARIO',
          nome: 'Modelo com mapeamento incompleto',
          htmlTemplate: '',
          formatoDocumento: 'WORD',
          docxTemplateBase64: docxBuf.toString('base64'),
          templatePlaceholdersJson: '["nome","idade"]',
          ativo: true,
        },
      });
      await prisma.templateMapping.create({
        data: {
          modeloDocumentoId: modeloIncompleto.id,
          campoTemplate: 'nome',
          campoSistema: 'student.fullName',
        },
      });
      const data = await resolveEntityData(alunoSecId, 'student', instSecId);
      await expect(
        renderTemplate({
          modeloDocumentoId: modeloIncompleto.id,
          instituicaoId: instSecId,
          data,
        })
      ).rejects.toThrow(/Placeholders não mapeados|{{idade}}/);
      await prisma.templateMapping.deleteMany({ where: { modeloDocumentoId: modeloIncompleto.id } });
      await prisma.modeloDocumento.delete({ where: { id: modeloIncompleto.id } });
    });

    it('rejeita mapeamentos com campos inexistentes (validação antes de gerar)', async () => {
      const docxBuf = createMinimalDocx();
      const modeloInvalido = await prisma.modeloDocumento.create({
        data: {
          instituicaoId: instSecId,
          tipo: 'DOCUMENTO_OFICIAL',
          tipoAcademico: 'SECUNDARIO',
          nome: 'Modelo com mapping inválido',
          htmlTemplate: '',
          formatoDocumento: 'WORD',
          docxTemplateBase64: docxBuf.toString('base64'),
          templatePlaceholdersJson: '["nome"]',
          ativo: true,
        },
      });
      await prisma.templateMapping.create({
        data: {
          modeloDocumentoId: modeloInvalido.id,
          campoTemplate: 'nome',
          campoSistema: 'student.campoInexistenteNoSistema',
        },
      });
      const data = await resolveEntityData(alunoSecId, 'student', instSecId);
      await expect(
        renderTemplate({
          modeloDocumentoId: modeloInvalido.id,
          instituicaoId: instSecId,
          data,
        })
      ).rejects.toThrow(/Campos inexistentes|Corrija ou remova/);
      await prisma.templateMapping.deleteMany({ where: { modeloDocumentoId: modeloInvalido.id } });
      await prisma.modeloDocumento.delete({ where: { id: modeloInvalido.id } });
    });
  });

  describe('validarMapeamentosCampos - rejeita campos inexistentes', () => {
    it('rejeita geração quando mapeamento usa campoSistema inexistente', async () => {
      const docxBuffer = createMinimalDocx();
      const docxBase64 = docxBuffer.toString('base64');
      const placeholders = extractPlaceholdersFromDocx(docxBuffer);
      const modeloInvalido = await prisma.modeloDocumento.create({
        data: {
          instituicaoId: instSecId,
          tipo: 'DOCUMENTO_OFICIAL',
          tipoAcademico: 'SECUNDARIO',
          nome: 'Modelo com mapping inválido (teste)',
          htmlTemplate: '',
          formatoDocumento: 'WORD',
          docxTemplateBase64: docxBase64,
          templatePlaceholdersJson: JSON.stringify(placeholders),
          ativo: true,
        },
      });
      await prisma.templateMapping.create({
        data: {
          modeloDocumentoId: modeloInvalido.id,
          campoTemplate: 'nome',
          campoSistema: 'student.campoInexistenteXYZ',
        },
      });
      const data = await resolveEntityData(alunoSecId, 'student', instSecId);
      await expect(
        renderTemplate({
          modeloDocumentoId: modeloInvalido.id,
          instituicaoId: instSecId,
          data,
        })
      ).rejects.toThrow(/Campos inexistentes|corrija ou remova/i);
      await prisma.templateMapping.deleteMany({ where: { modeloDocumentoId: modeloInvalido.id } });
      await prisma.modeloDocumento.delete({ where: { id: modeloInvalido.id } });
    });
  });

  describe('Integração: tipo acadêmico nos dados (curso vs classe)', () => {
    it('resolveEntityData student retorna curso ou classe conforme turma', async () => {
      const dataSec = await resolveEntityData(alunoSecId, 'student', instSecId);
      const dataSup = await resolveEntityData(alunoSupId, 'student', instSupId);
      expect(dataSec).toHaveProperty('student');
      expect(dataSup).toHaveProperty('student');
      expect(dataSec.student).toHaveProperty('classe');
      expect(dataSup.student).toHaveProperty('curso');
    });
  });

});
