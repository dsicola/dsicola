/**
 * Script de teste: Emitir Certificado ou Declaração
 *
 * Uso: npx tsx scripts/test-emitir-documento.ts [tipo]
 * tipo: DECLARACAO_MATRICULA | DECLARACAO_FREQUENCIA | HISTORICO | CERTIFICADO (default: DECLARACAO_MATRICULA)
 */

import { PrismaClient } from '@prisma/client';
import * as documentoService from '../src/services/documento.service';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const tipo = (process.argv[2] || 'DECLARACAO_MATRICULA') as any;
  const tiposValidos = ['DECLARACAO_MATRICULA', 'DECLARACAO_FREQUENCIA', 'HISTORICO', 'CERTIFICADO'];
  if (!tiposValidos.includes(tipo)) {
    console.error(`Tipo inválido. Use: ${tiposValidos.join(' | ')}`);
    process.exit(1);
  }

  console.log('🔍 Buscando dados para teste...');

  // 1. Buscar instituição com admin/secretaria
  const instituicao = await prisma.instituicao.findFirst({
    where: {},
    select: { id: true, nome: true },
  });
  if (!instituicao) {
    console.error('❌ Nenhuma instituição encontrada. Execute o seed ou crie uma instituição.');
    process.exit(1);
  }
  console.log(`   Instituição: ${instituicao.nome} (${instituicao.id})`);

  // 2. Buscar admin/secretaria da instituição
  const admin = await prisma.user.findFirst({
    where: {
      instituicaoId: instituicao.id,
      roles: {
        some: {
          role: { in: ['ADMIN', 'SECRETARIA'] },
        },
      },
    },
    select: { id: true, email: true, nomeCompleto: true },
  });
  if (!admin) {
    console.error('❌ Nenhum ADMIN ou SECRETARIA encontrado para a instituição.');
    process.exit(1);
  }
  console.log(`   Emitente: ${admin.nomeCompleto} (${admin.email})`);

  // 3. Buscar aluno com matrícula ativa
  const aluno = await prisma.user.findFirst({
    where: {
      instituicaoId: instituicao.id,
      roles: { some: { role: 'ALUNO' } },
    },
    include: {
      matriculasAnuais: {
        where: { status: 'ATIVA' },
        take: 1,
        include: { curso: true, classe: true },
      },
    },
  });
  if (!aluno) {
    console.error('❌ Nenhum aluno encontrado na instituição.');
    process.exit(1);
  }
  if (!aluno.matriculasAnuais?.length) {
    console.error('❌ Aluno sem matrícula ativa. O aluno precisa ter matrícula para declarações.');
    process.exit(1);
  }
  console.log(`   Estudante: ${aluno.nomeCompleto} (${aluno.id})`);

  // 4. Tipo acadêmico da instituição
  const inst = await prisma.instituicao.findUnique({
    where: { id: instituicao.id },
    select: { tipoAcademico: true },
  });
  const tipoAcademico = inst?.tipoAcademico ?? null;
  console.log(`   Tipo acadêmico: ${tipoAcademico || 'não definido'}`);

  console.log(`\n📄 Emitindo ${tipo}...`);

  try {
    const resultado = await documentoService.geraDocumento(
      tipo,
      aluno.id,
      instituicao.id,
      admin.id,
      tipoAcademico,
      {}
    );

    console.log(`✅ Documento emitido com sucesso!`);
    console.log(`   ID: ${resultado.id}`);
    console.log(`   Nº: ${resultado.numeroDocumento}`);
    console.log(`   Código verificação: ${resultado.codigoVerificacao}`);

    // Salvar PDF em arquivo
    const dir = path.join(process.cwd(), 'uploads', 'test-documentos');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filename = `documento-${resultado.numeroDocumento}.pdf`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, resultado.pdfBuffer);
    console.log(`   PDF salvo: ${filepath}`);
  } catch (err: any) {
    console.error('❌ Erro ao emitir:', err.message);
    if (err.response?.data) {
      console.error('   Detalhes:', err.response.data);
    }
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
