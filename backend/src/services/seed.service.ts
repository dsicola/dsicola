import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

/**
 * Executa o seed do super-admin.
 * Pode ser chamado por HTTP (endpoint protegido) ou no arranque.
 */
export async function runSuperAdminSeed(): Promise<{
  created: boolean;
  email: string;
  message: string;
}> {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Administrador';

  const existingUser = await prisma.user.findFirst({
    where: { email: superAdminEmail },
    select: { id: true },
  });

  if (existingUser) {
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { password: hashedPassword, nomeCompleto: superAdminName },
    });
    const hasRole = await prisma.userRole_.findFirst({
      where: { userId: existingUser.id, role: 'SUPER_ADMIN' },
    });
    if (!hasRole) {
      await prisma.userRole_.create({
        data: { userId: existingUser.id, role: 'SUPER_ADMIN' },
      });
    }
    return {
      created: false,
      email: superAdminEmail,
      message: 'Super-admin já existia; senha e role atualizados.',
    };
  }

  const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
  const user = await prisma.user.create({
    data: { email: superAdminEmail, password: hashedPassword, nomeCompleto: superAdminName },
  });
  await prisma.userRole_.create({
    data: { userId: user.id, role: 'SUPER_ADMIN' },
  });
  return {
    created: true,
    email: superAdminEmail,
    message: 'Super-admin criado com sucesso. Use as credenciais para fazer login.',
  };
}
