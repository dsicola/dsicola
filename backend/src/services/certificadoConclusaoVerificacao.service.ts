import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { generateCodigoVerificacao } from './documento.service.js';

const MAX_TRIES = 20;

/**
 * Gera um código único global para gravar em `Certificado.codigoVerificacao`.
 */
export async function gerarCodigoVerificacaoCertificadoUnico(): Promise<string> {
  for (let i = 0; i < MAX_TRIES; i++) {
    const code = generateCodigoVerificacao();
    const exists = await prisma.certificado.findFirst({
      where: { codigoVerificacao: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new AppError('Não foi possível gerar código de verificação único. Tente novamente.', 500);
}

/**
 * Garante que o certificado tenha código (útil para registos anteriores à coluna ou falhas pontuais).
 */
export async function garantirCodigoVerificacaoCertificadoPorId(certificadoId: string): Promise<string> {
  const row = await prisma.certificado.findUnique({
    where: { id: certificadoId },
    select: { codigoVerificacao: true },
  });
  if (!row) {
    throw new AppError('Certificado não encontrado', 404);
  }
  if (row.codigoVerificacao) {
    return row.codigoVerificacao;
  }

  for (let i = 0; i < MAX_TRIES; i++) {
    const code = await gerarCodigoVerificacaoCertificadoUnico();
    try {
      await prisma.certificado.update({
        where: { id: certificadoId },
        data: { codigoVerificacao: code },
      });
      return code;
    } catch {
      /* colisão improvável em codigoVerificacao */
    }
  }
  throw new AppError('Não foi possível atribuir código de verificação ao certificado.', 500);
}

export type VerificacaoCertificadoPublicoResult =
  | {
      valido: true;
      tipo: 'CERTIFICADO_CONCLUSAO_SECUNDARIO';
      instituicao: string | null;
      nomeParcial: string;
      numeroCertificado: string;
      dataEmissao: string;
    }
  | { valido: false; mensagem: string };

/**
 * Verificação pública por código (sem dados sensíveis completos).
 */
export async function verificarCertificadoConclusaoPorCodigo(
  codigoRaw: string
): Promise<VerificacaoCertificadoPublicoResult> {
  const codigo = codigoRaw.trim().toUpperCase();
  if (!codigo) {
    return { valido: false, mensagem: 'Código não fornecido' };
  }

  const cert = await prisma.certificado.findFirst({
    where: { codigoVerificacao: codigo },
    include: {
      instituicao: { select: { nome: true } },
      conclusaoCurso: {
        select: {
          aluno: { select: { nomeCompleto: true } },
        },
      },
    },
  });

  if (!cert) {
    return { valido: false, mensagem: 'Certificado não encontrado ou código inválido' };
  }

  const nomeCompleto = cert.conclusaoCurso?.aluno?.nomeCompleto?.trim() || '';
  const partes = nomeCompleto.split(/\s+/).filter(Boolean);
  const nomeParcial =
    partes.length >= 2
      ? `${partes[0]} ${partes[1]} ***`
      : partes.length === 1
        ? `${partes[0]} ***`
        : '***';

  return {
    valido: true,
    tipo: 'CERTIFICADO_CONCLUSAO_SECUNDARIO',
    instituicao: cert.instituicao?.nome ?? null,
    nomeParcial,
    numeroCertificado: cert.numeroCertificado,
    dataEmissao: cert.dataEmissao.toISOString(),
  };
}
