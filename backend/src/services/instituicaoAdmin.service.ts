import prisma from '../lib/prisma.js';

/**
 * Obtém o email do administrador da instituição para envio de notificações.
 * Prefere o email do primeiro ADMIN encontrado; fallback para emailContato da instituição.
 */
export async function getAdminEmailForInstituicao(instituicaoId: string): Promise<string | null> {
  const adminUser = await prisma.user.findFirst({
    where: {
      instituicaoId,
      roles: { some: { role: 'ADMIN' } },
    },
    select: { email: true },
  });
  if (adminUser?.email) return adminUser.email;

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { emailContato: true },
  });
  return instituicao?.emailContato || null;
}

/**
 * Obtém email e nome do admin para personalização de emails.
 */
export async function getAdminInfoForInstituicao(instituicaoId: string): Promise<{
  email: string | null;
  nomeCompleto: string | null;
  emailContato: string | null;
}> {
  const adminUser = await prisma.user.findFirst({
    where: {
      instituicaoId,
      roles: { some: { role: 'ADMIN' } },
    },
    select: { email: true, nomeCompleto: true },
  });

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { emailContato: true },
  });

  const email = adminUser?.email || instituicao?.emailContato || null;
  return {
    email,
    nomeCompleto: adminUser?.nomeCompleto || null,
    emailContato: instituicao?.emailContato || null,
  };
}
