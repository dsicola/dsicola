/**
 * Testes: Certificados Multi-tenant e Dois Tipos de Instituição
 *
 * Garante:
 * - Multi-tenant: cada instituição usa sua própria configuração
 * - SECUNDARIO: modelo Certificado de Habilitações (Angola II Ciclo)
 * - SUPERIOR: modelo Certificado Licenciatura (Angola)
 *
 * Pré-requisitos: npx tsx scripts/seed-multi-tenant-test.ts
 *
 * Execute: npx vitest run src/__tests__/certificados-multitenant-tipos.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../lib/prisma.js';
import { montarPayloadPrevisualizacao } from '../services/documento.service.js';
import { preencherTemplateCertificadoSecundario } from '../services/certificadoSecundario.service.js';
import { preencherTemplateCertificadoSuperior } from '../services/certificadoSuperior.service.js';

let instSecId: string;
let instSupId: string;

describe('Certificados: Multi-tenant e dois tipos de instituição', () => {
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

    // Garantir config específica para cada tipo
    await prisma.configuracaoInstituicao.upsert({
      where: { instituicaoId: instSecId },
      create: {
        instituicaoId: instSecId,
        nomeInstituicao: instSec.nome,
        tipoInstituicao: 'ENSINO_MEDIO',
        republicaAngola: 'REPÚBLICA DE ANGOLA',
        governoProvincia: 'GOVERNO DA PROVINCIA DE LUANDA',
        escolaNomeNumero: 'ESCOLA DO IIº CICLO DO ENSINO SECUNDÁRIO N° 5106 - NEVES & SOUSA',
        ensinoGeral: 'ENSINO GERAL',
        tituloCertificadoSecundario: 'CERTIFICADO DE HABILITAÇÕES',
        cargoAssinatura1Secundario: 'O Subdirector Pedagógico',
        cargoAssinatura2Secundario: 'A Directora',
        nomeAssinatura1Secundario: 'Dibanzilua Tando Jones',
        nomeAssinatura2Secundario: 'Madalena Galula César',
      },
      update: {
        republicaAngola: 'REPÚBLICA DE ANGOLA',
        governoProvincia: 'GOVERNO DA PROVINCIA DE LUANDA',
        escolaNomeNumero: 'ESCOLA DO IIº CICLO DO ENSINO SECUNDÁRIO N° 5106 - NEVES & SOUSA',
        ensinoGeral: 'ENSINO GERAL',
        tituloCertificadoSecundario: 'CERTIFICADO DE HABILITAÇÕES',
        cargoAssinatura1Secundario: 'O Subdirector Pedagógico',
        cargoAssinatura2Secundario: 'A Directora',
        nomeAssinatura1Secundario: 'Dibanzilua Tando Jones',
        nomeAssinatura2Secundario: 'Madalena Galula César',
      },
    });

    await prisma.configuracaoInstituicao.upsert({
      where: { instituicaoId: instSupId },
      create: {
        instituicaoId: instSupId,
        nomeInstituicao: instSup.nome,
        tipoInstituicao: 'UNIVERSIDADE',
        ministerioSuperior: 'Ministério do Ensino Superior, Ciência, Tecnologia e Inovação',
        decretoCriacao: 'Decreto n.º 7/09, de 12 de Maio',
        nomeChefeDaa: 'Msc. Aristides Jaime Yandelela Cânduta',
        nomeDirectorGeral: 'Prof. Alfredo Rodrigues Paulo',
        cargoAssinatura1: 'O CHEFE DO DAA',
        cargoAssinatura2: 'O DIRECTOR GERAL',
      },
      update: {
        ministerioSuperior: 'Ministério do Ensino Superior, Ciência, Tecnologia e Inovação',
        decretoCriacao: 'Decreto n.º 7/09, de 12 de Maio',
        nomeChefeDaa: 'Msc. Aristides Jaime Yandelela Cânduta',
        nomeDirectorGeral: 'Prof. Alfredo Rodrigues Paulo',
        cargoAssinatura1: 'O CHEFE DO DAA',
        cargoAssinatura2: 'O DIRECTOR GERAL',
      },
    });
  });

  describe('Multi-tenant: isolamento por instituição', () => {
    it('SECUNDARIO: payload usa config da instituição secundária', async () => {
      const payload = await montarPayloadPrevisualizacao(
        'CERTIFICADO',
        instSecId,
        'SECUNDARIO'
      );

      expect(payload.instituicao.republicaAngola).toBe('REPÚBLICA DE ANGOLA');
      expect(payload.instituicao.governoProvincia).toBe('GOVERNO DA PROVINCIA DE LUANDA');
      expect(payload.instituicao.tituloCertificadoSecundario).toBe('CERTIFICADO DE HABILITAÇÕES');
      expect(payload.instituicao.escolaNomeNumero).toContain('ESCOLA DO IIº CICLO');
      expect(payload.contextoAcademico.tipo).toBe('SECUNDARIO');
      expect(payload.instituicao.ministerioSuperior).toBeUndefined();
    });

    it('SUPERIOR: payload usa config da instituição superior', async () => {
      const payload = await montarPayloadPrevisualizacao(
        'CERTIFICADO',
        instSupId,
        'SUPERIOR'
      );

      expect(payload.instituicao.ministerioSuperior).toContain('Ministério do Ensino Superior');
      expect(payload.instituicao.decretoCriacao).toContain('Decreto');
      expect(payload.instituicao.cargoAssinatura1).toBe('O CHEFE DO DAA');
      expect(payload.instituicao.cargoAssinatura2).toBe('O DIRECTOR GERAL');
      expect(payload.contextoAcademico.tipo).toBe('SUPERIOR');
      expect(payload.instituicao.republicaAngola).toBeUndefined();
    });
  });

  describe('Modelo SECUNDARIO: Certificado de Habilitações', () => {
    it('HTML contém elementos do modelo Angola II Ciclo', async () => {
      const payload = await montarPayloadPrevisualizacao(
        'CERTIFICADO',
        instSecId,
        'SECUNDARIO'
      );

      const html = await preencherTemplateCertificadoSecundario(payload, {
        formatoAngola: true,
      });

      expect(html).toContain('CERTIFICADO DE HABILITAÇÕES');
      expect(html).toContain('REPÚBLICA DE ANGOLA');
      expect(html).toContain('GOVERNO DA PROVINCIA DE LUANDA');
      expect(html).toContain('ESCOLA DO IIº CICLO');
      expect(html).toContain('ENSINO GERAL');
      expect(html).toContain('10ª Classe');
      expect(html).toContain('11ª Classe');
      expect(html).toContain('12ª Classe');
      expect(html).toContain('O Subdirector Pedagógico');
      expect(html).toContain('A Directora');
      expect(html).toContain('Dibanzilua Tando Jones');
      expect(html).toContain('Madalena Galula César');
      expect(html).toContain('João Paulo Viti Crijostomo');
      expect(html).not.toContain('O CHEFE DO DAA');
      expect(html).not.toContain('Ministério do Ensino Superior');
    });
  });

  describe('Modelo SUPERIOR: Certificado Licenciatura', () => {
    it('HTML contém elementos do modelo Angola Superior', async () => {
      const payload = await montarPayloadPrevisualizacao(
        'CERTIFICADO',
        instSupId,
        'SUPERIOR'
      );

      const html = await preencherTemplateCertificadoSuperior(payload, {});

      expect(html).toContain('Ministério do Ensino Superior');
      expect(html).toContain('Decreto');
      expect(html).toContain('O CHEFE DO DAA');
      expect(html).toContain('O DIRECTOR GERAL');
      expect(html).toContain('Msc. Aristides Jaime Yandelela Cânduta');
      expect(html).toContain('Prof. Alfredo Rodrigues Paulo');
      expect(html).toContain('Licenciatura em Direito');
      expect(html).toContain('João Paulo Viti Crijostomo');
      expect(html).not.toContain('CERTIFICADO DE HABILITAÇÕES');
      expect(html).not.toContain('10ª Classe');
      expect(html).not.toContain('O Subdirector Pedagógico');
    });
  });

  describe('Config override: pré-visualização com valores do formulário', () => {
    it('SECUNDARIO: configOverride sobrescreve valores da config salva', async () => {
      const payload = await montarPayloadPrevisualizacao(
        'CERTIFICADO',
        instSecId,
        'SECUNDARIO',
        {
          tituloCertificadoSecundario: 'CERTIFICADO CUSTOMIZADO TESTE',
          escolaNomeNumero: 'ESCOLA TESTE 9999',
        }
      );

      expect(payload.instituicao.tituloCertificadoSecundario).toBe('CERTIFICADO CUSTOMIZADO TESTE');
      expect(payload.instituicao.escolaNomeNumero).toBe('ESCOLA TESTE 9999');
    });

    it('SUPERIOR: configOverride sobrescreve valores da config salva', async () => {
      const payload = await montarPayloadPrevisualizacao(
        'CERTIFICADO',
        instSupId,
        'SUPERIOR',
        {
          ministerioSuperior: 'Ministério Customizado Teste',
          nomeDirectorGeral: 'Director Teste',
        }
      );

      expect(payload.instituicao.ministerioSuperior).toBe('Ministério Customizado Teste');
      expect(payload.instituicao.nomeDirectorGeral).toBe('Director Teste');
    });
  });
});
