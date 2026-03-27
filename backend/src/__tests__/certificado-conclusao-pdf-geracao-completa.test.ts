/**
 * Geração completa do PDF de certificado de conclusão (Ensino Secundário).
 * Exercita pdfkit, texto institucional, código de verificação no rodapé e imagens (logo + carimbo).
 *
 * Execute: npx vitest run src/__tests__/certificado-conclusao-pdf-geracao-completa.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFParse } from 'pdf-parse';

async function extrairTextoPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const { text } = await parser.getText();
    return text;
  } finally {
    await parser.destroy();
  }
}

/** PNG 1×1 válido (mínimo) para doc.image(logo) e carimbo */
const MIN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const instituicaoId = '00000000-0000-4000-8000-000000000001';
const conclusaoCursoId = '00000000-0000-4000-8000-000000000002';

const instituicaoSecundaria = {
  id: instituicaoId,
  nome: 'Escola Teste PDF',
  tipoAcademico: 'SECUNDARIO' as const,
  logoUrl: null as string | null,
  configuracao: {
    id: 'cfg-1',
    instituicaoId,
    nomeInstituicao: 'Escola Teste PDF Completo',
    tituloCertificadoSecundario: 'CERTIFICADO DE HABILITAÇÕES (TESTE)',
    labelValoresCertificado: 'valores',
    cargoAssinatura1Secundario: 'O Director',
    nomeAssinatura1Secundario: 'Eng.º Maria Santos',
    cargoAssinatura2Secundario: 'O Secretary',
    nomeAssinatura2Secundario: 'Dr. João Pires',
    textoFechoCertificadoSecundario: null as string | null,
    logoData: null as Buffer | null,
    logoUrl: null as string | null,
    carimboCertificadoSecundarioData: null as Buffer | null,
    carimboCertificadoSecundarioUrl: null as string | null,
    imagemFundoDocumentoData: null as Buffer | null,
    imagemFundoDocumentoUrl: null as string | null,
  },
};

const certificadoCompleto = {
  id: 'cert-pdf-test',
  numeroCertificado: 'CERT-PDF-2025-TEST',
  dataEmissao: new Date('2025-03-15T14:30:00.000Z'),
  livro: 'Reg. 3',
  folha: '142',
  conclusaoCurso: {
    alunoId: 'aluno-pdf-test',
    classeId: 'classe-pdf-test',
    mediaGeral: 15.25,
    dataConclusao: new Date('2025-02-28'),
    status: 'CONCLUIDO' as const,
    aluno: { nomeCompleto: 'António Manuel Costa Ferreira' },
    curso: null as { nome: string } | null,
    classe: { nome: '12ª Classe — Ciências' },
  },
};

const mockInstituicaoFindUnique = vi.fn();
const mockCertificadoFindFirst = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  default: {
    instituicao: {
      findUnique: (...args: unknown[]) => mockInstituicaoFindUnique(...args),
    },
    certificado: {
      findFirst: (...args: unknown[]) => mockCertificadoFindFirst(...args),
    },
  },
}));

vi.mock('../services/conclusaoCurso.service.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/conclusaoCurso.service.js')>();
  return {
    ...mod,
    verificarRegistoAcademicoMinimo: vi
      .fn()
      .mockResolvedValue({ ok: true, alunoExiste: true }),
  };
});

vi.mock('../services/certificadoConclusaoVerificacao.service.js', () => ({
  gerarCodigoVerificacaoCertificadoUnico: vi.fn(),
  garantirCodigoVerificacaoCertificadoPorId: vi.fn(() => Promise.resolve('A1B2C3D4')),
  verificarCertificadoConclusaoPorCodigo: vi.fn(),
}));

vi.mock('../services/certificadoConclusaoPdfHelpers.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/certificadoConclusaoPdfHelpers.js')>();
  return {
    ...mod,
    loadLogoBuffer: vi.fn(() => Promise.resolve(MIN_PNG)),
    loadCarimboCertificadoSecundarioPdf: vi.fn(() => Promise.resolve(MIN_PNG)),
  };
});

import { gerarCertificadoConclusaoPdfPorConclusaoId } from '../services/certificadoConclusaoPdf.service.js';
import { AppError } from '../middlewares/errorHandler.js';

describe('gerarCertificadoConclusaoPdfPorConclusaoId — geração completa', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('FRONTEND_URL', '');
    vi.stubEnv('PUBLIC_APP_URL', '');
    mockInstituicaoFindUnique.mockReset();
    mockCertificadoFindFirst.mockReset();
  });

  it('gera buffer PDF válido (%PDF-) com número do certificado e texto extraível', async () => {
    mockInstituicaoFindUnique.mockResolvedValue(instituicaoSecundaria);
    mockCertificadoFindFirst.mockResolvedValue(certificadoCompleto);

    const { buffer, numeroCertificado } = await gerarCertificadoConclusaoPdfPorConclusaoId(
      conclusaoCursoId,
      instituicaoId
    );

    expect(numeroCertificado).toBe('CERT-PDF-2025-TEST');
    expect(buffer.length).toBeGreaterThan(2000);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const text = await extrairTextoPdf(buffer);
    expect(text).toContain('CERT-PDF-2025-TEST');
    expect(text).toMatch(/ANTÓNIO|ANTONIO/i);
    expect(text).toContain('MANUEL');
    expect(text).toContain('12');
    expect(text).toMatch(/Classe/i);
    expect(text).toContain('Ciências');
    expect(text).toContain('Código de verificação institucional');
    expect(text).toContain('A1B2C3D4');
    expect(text).toContain('Livro: Reg. 3');
    expect(text).toContain('Folha: 142');
    expect(text).toContain('DSICOLA');
  });

  it('inclui URL de verificação quando FRONTEND_URL está definido', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('FRONTEND_URL', 'https://app.exemplo.ao');
    mockInstituicaoFindUnique.mockResolvedValue(instituicaoSecundaria);
    mockCertificadoFindFirst.mockResolvedValue(certificadoCompleto);

    const { buffer } = await gerarCertificadoConclusaoPdfPorConclusaoId(
      conclusaoCursoId,
      instituicaoId
    );

    const text = await extrairTextoPdf(buffer);
    expect(text).toContain('https://app.exemplo.ao/verificar-certificado-conclusao');
    expect(text).toContain('codigo=A1B2C3D4');
  });

  it('rejeita instituição só Superior', async () => {
    mockInstituicaoFindUnique.mockResolvedValue({
      ...instituicaoSecundaria,
      tipoAcademico: 'SUPERIOR',
    });

    await expect(
      gerarCertificadoConclusaoPdfPorConclusaoId(conclusaoCursoId, instituicaoId)
    ).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(
      gerarCertificadoConclusaoPdfPorConclusaoId(conclusaoCursoId, instituicaoId)
    ).rejects.toBeInstanceOf(AppError);
  });

  it('404 quando não existe certificado registado', async () => {
    mockInstituicaoFindUnique.mockResolvedValue(instituicaoSecundaria);
    mockCertificadoFindFirst.mockResolvedValue(null);

    await expect(
      gerarCertificadoConclusaoPdfPorConclusaoId(conclusaoCursoId, instituicaoId)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('400 quando conclusão sem classeId', async () => {
    mockInstituicaoFindUnique.mockResolvedValue(instituicaoSecundaria);
    mockCertificadoFindFirst.mockResolvedValue({
      ...certificadoCompleto,
      conclusaoCurso: {
        ...certificadoCompleto.conclusaoCurso,
        classeId: null,
      },
    });

    await expect(
      gerarCertificadoConclusaoPdfPorConclusaoId(conclusaoCursoId, instituicaoId)
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
