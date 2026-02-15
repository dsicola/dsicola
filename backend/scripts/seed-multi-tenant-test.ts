#!/usr/bin/env npx tsx
/**
 * SEED: Dados para teste de validação Multi-Tenant
 *
 * Cria:
 * - Instituição A (Secundário) - tipoAcademico SECUNDARIO
 * - Instituição B (Superior) - tipoAcademico SUPERIOR
 * - Admin A (instituicaoId = A)
 * - Admin B (instituicaoId = B)
 * - Professor A (instituicaoId = A)
 * - Aluno A (instituicaoId = A)
 * - Aluno B (instituicaoId = B)
 *
 * Senha padrão para todos: TestMultiTenant123!
 *
 * Uso: npx tsx scripts/seed-multi-tenant-test.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SENHA = 'TestMultiTenant123!';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SEED - DADOS PARA TESTE MULTI-TENANT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const hashedPassword = await bcrypt.hash(SENHA, 10);

  // 1. Instituição A (Secundário)
  let instA = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
  });
  if (!instA) {
    instA = await prisma.instituicao.create({
      data: {
        nome: 'Instituição A - Secundário (Teste)',
        subdominio: 'inst-a-secundario-test',
        tipoInstituicao: 'ENSINO_MEDIO',
        tipoAcademico: 'SECUNDARIO',
        status: 'ativa',
      },
    });
    console.log('  ✔ Instituição A (Secundário) criada:', instA.id);
  } else {
    console.log('  ✔ Instituição A já existe:', instA.id);
  }

  // 2. Instituição B (Superior)
  let instB = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
  });
  if (!instB) {
    instB = await prisma.instituicao.create({
      data: {
        nome: 'Instituição B - Superior (Teste)',
        subdominio: 'inst-b-superior-test',
        tipoInstituicao: 'UNIVERSIDADE',
        tipoAcademico: 'SUPERIOR',
        status: 'ativa',
      },
    });
    console.log('  ✔ Instituição B (Superior) criada:', instB.id);
  } else {
    console.log('  ✔ Instituição B já existe:', instB.id);
  }

  const criarOuAtualizarUser = async (
    email: string,
    nome: string,
    instituicaoId: string,
    roles: string[]
  ) => {
    let user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nomeCompleto: nome,
          instituicaoId,
        },
        include: { roles: true },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { instituicaoId, password: hashedPassword },
      });
    }
    for (const role of roles) {
      const exists = await prisma.userRole_.findFirst({
        where: { userId: user!.id, role: role as any },
      });
      if (!exists) {
        await prisma.userRole_.create({
          data: {
            userId: user!.id,
            role: role as any,
            instituicaoId,
          },
        });
      } else {
        await prisma.userRole_.updateMany({
          where: { userId: user!.id, role: role as any },
          data: { instituicaoId },
        });
      }
    }
    return { user: await prisma.user.findUniqueOrThrow({ where: { id: user!.id } }) };
  };

  // 3. Admin A
  const { user: adminA } = await criarOuAtualizarUser(
    'admin.inst.a@teste.dsicola.com',
    'Admin Instituição A',
    instA.id,
    ['ADMIN']
  );
  console.log('  ✔ Admin A:', adminA.email);

  // 4. Admin B
  const { user: adminB } = await criarOuAtualizarUser(
    'admin.inst.b@teste.dsicola.com',
    'Admin Instituição B',
    instB.id,
    ['ADMIN']
  );
  console.log('  ✔ Admin B:', adminB.email);

  // 5. Professor A
  const { user: profA } = await criarOuAtualizarUser(
    'prof.inst.a@teste.dsicola.com',
    'Professor Instituição A',
    instA.id,
    ['PROFESSOR']
  );
  let professorA = await prisma.professor.findFirst({
    where: { userId: profA.id, instituicaoId: instA.id },
  });
  if (!professorA) {
    professorA = await prisma.professor.create({
      data: {
        userId: profA.id,
        instituicaoId: instA.id,
      },
    });
    console.log('  ✔ Professor A (entidade) criado');
  }
  console.log('  ✔ Professor A:', profA.email);

  // 6. Aluno A
  const { user: alunoA } = await criarOuAtualizarUser(
    'aluno.inst.a@teste.dsicola.com',
    'Aluno Instituição A',
    instA.id,
    ['ALUNO']
  );
  console.log('  ✔ Aluno A:', alunoA.email);

  // 6b. Professor B (para fluxo Superior)
  const { user: profB } = await criarOuAtualizarUser(
    'prof.inst.b@teste.dsicola.com',
    'Professor Instituição B',
    instB.id,
    ['PROFESSOR']
  );
  let professorB = await prisma.professor.findFirst({
    where: { userId: profB.id, instituicaoId: instB.id },
  });
  if (!professorB) {
    professorB = await prisma.professor.create({
      data: {
        userId: profB.id,
        instituicaoId: instB.id,
      },
    });
    console.log('  ✔ Professor B (entidade) criado');
  }
  console.log('  ✔ Professor B:', profB.email);

  // 7. Aluno B
  const { user: alunoB } = await criarOuAtualizarUser(
    'aluno.inst.b@teste.dsicola.com',
    'Aluno Instituição B',
    instB.id,
    ['ALUNO']
  );
  console.log('  ✔ Aluno B:', alunoB.email);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  CONFIGURE O .env PARA OS TESTES:');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`
TEST_USER_INST_A_EMAIL="admin.inst.a@teste.dsicola.com"
TEST_USER_INST_A_PASSWORD="TestMultiTenant123!"

TEST_USER_INST_B_EMAIL="admin.inst.b@teste.dsicola.com"
TEST_USER_INST_B_PASSWORD="TestMultiTenant123!"

# Para teste Professor A não vê alunos B:
TEST_PROF_INST_A_EMAIL="prof.inst.a@teste.dsicola.com"
TEST_PROF_INST_A_PASSWORD="TestMultiTenant123!"
`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
