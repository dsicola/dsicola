import prisma from '../lib/prisma.js';
import { UserRole } from '@prisma/client';

/**
 * Gera um número de identificação pública único baseado no tipo/role
 * Filtrado por instituicaoId para garantir sequência única por instituição
 * Retorna apenas números (ex: "0002" ao invés de "ALU0002")
 */
export async function gerarNumeroIdentificacaoPublica(
  role: UserRole,
  instituicaoId?: string | null
): Promise<string> {
  // Mapear role para tipo de sequência
  const tipoMap: Record<UserRole, string> = {
    ALUNO: 'ALUNO',
    PROFESSOR: 'PROFESSOR',
    SECRETARIA: 'SECRETARIA',
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'ADMIN',
    POS: 'POS',
    RESPONSAVEL: 'FUNCIONARIO',
    DIRECAO: 'FUNCIONARIO',
    COORDENADOR: 'FUNCIONARIO',
    AUDITOR: 'FUNCIONARIO',
  };

  const tipo = tipoMap[role] || 'FUNCIONARIO';

  // Usar transação para garantir atomicidade
  const sequencia = await prisma.$transaction(async (tx) => {
    // Buscar ou criar sequência filtrada por instituicaoId
    // Usar findFirst porque a chave única composta pode não funcionar com null
    let seq = await tx.sequenciaIdentificacao.findFirst({
      where: {
        tipo,
        instituicaoId: instituicaoId || null,
      },
    });

    if (!seq) {
      // Criar sequência se não existir para esta instituição
      seq = await tx.sequenciaIdentificacao.create({
        data: {
          tipo,
          prefixo: '', // Não usamos mais prefixo
          ultimoNumero: 0,
          instituicaoId: instituicaoId || null,
        },
      });
    }

    // Incrementar e atualizar
    const novoNumero = seq.ultimoNumero + 1;
    await tx.sequenciaIdentificacao.update({
      where: { id: seq.id },
      data: { ultimoNumero: novoNumero },
    });

    return novoNumero;
  });

  // Formatar número com zeros à esquerda (4 dígitos) - SEM prefixo
  const numeroFormatado = String(sequencia).padStart(4, '0');
  
  return numeroFormatado;
}

/**
 * Valida e normaliza o nome completo
 */
export function validarNomeCompleto(nomeCompleto: string): string {
  if (!nomeCompleto || typeof nomeCompleto !== 'string') {
    throw new Error('Nome completo é obrigatório');
  }

  // Trim e normalizar espaços
  const nomeNormalizado = nomeCompleto.trim().replace(/\s+/g, ' ');

  if (nomeNormalizado.length < 2) {
    throw new Error('Nome completo deve ter no mínimo 2 caracteres');
  }

  if (nomeNormalizado.length > 255) {
    throw new Error('Nome completo deve ter no máximo 255 caracteres');
  }

  // Validar que contém caracteres válidos (letras, espaços, acentos e alguns caracteres especiais)
  // Permitir números e alguns caracteres especiais comuns para nomes
  const nomeValido = /^[a-zA-ZÀ-ÿ0-9\s'.-]+$/.test(nomeNormalizado);
  if (!nomeValido) {
    throw new Error('Nome completo contém caracteres inválidos. Use apenas letras, números, espaços e os caracteres: \' . -');
  }

  return nomeNormalizado;
}

