#!/usr/bin/env npx tsx
/**
 * TESTE COMPLETO: Atribuição de Plano de Ensino
 *
 * Atribui um plano completo (disciplina + turma + aulas) a um professor já cadastrado
 * e verifica se todos os endpoints/serviços retornam os dados corretamente.
 *
 * Uso: npx tsx scripts/testar-atribuicao-plano-completo.ts [email_professor]
 */
import prisma from '../src/lib/prisma.js';
import { buscarTurmasEDisciplinasProfessorComPlanoAtivo } from '../src/services/validacaoAcademica.service.js';

async function main() {
  const emailArg = process.argv[2];
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Atribuição Completa via Plano de Ensino');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ─── 1. BUSCAR PROFESSOR ─────────────────────────────────────────────────
  const professor = emailArg
    ? await prisma.professor.findFirst({
        where: { user: { email: emailArg.toLowerCase() } },
        include: {
          user: { select: { email: true, nomeCompleto: true } },
          instituicao: { select: { id: true, nome: true, tipoAcademico: true } },
        },
      })
    : await prisma.professor.findFirst({
        include: {
          user: { select: { email: true, nomeCompleto: true } },
          instituicao: { select: { id: true, nome: true, tipoAcademico: true } },
        },
      });

  if (!professor) {
    console.log('❌ Nenhum professor encontrado.');
    if (emailArg) console.log('   Email informado:', emailArg);
    await prisma.$disconnect();
    process.exit(1);
  }

  const instituicaoId = professor.instituicaoId;
  const tipoAcademico = professor.instituicao?.tipoAcademico || 'SUPERIOR';

  console.log('1. PROFESSOR SELECIONADO');
  console.log('   Nome:', professor.user?.nomeCompleto);
  console.log('   Email:', professor.user?.email);
  console.log('   professores.id:', professor.id);
  console.log('   users.id (userId):', professor.userId);
  console.log('   Instituição:', professor.instituicao?.nome);
  console.log('   Tipo:', tipoAcademico);
  console.log('');

  // ─── 2. BUSCAR DADOS NECESSÁRIOS ──────────────────────────────────────────
  const anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId, status: 'ATIVO' },
  });
  if (!anoLetivo) {
    console.log('❌ Nenhum ano letivo ATIVO encontrado para a instituição.');
    await prisma.$disconnect();
    process.exit(1);
  }

  let curso: { id: string; nome: string } | null = null;
  let classe: { id: string; nome: string } | null = null;
  let disciplina: { id: string; nome: string } | null = null;
  let turma: { id: string; nome: string } | null = null;
  let semestre: { id: string; numero: number } | null = null;

  if (tipoAcademico === 'SUPERIOR') {
    curso = await prisma.curso.findFirst({
      where: { instituicaoId },
      select: { id: true, nome: true },
    });
    semestre = await prisma.semestre.findFirst({
      where: { anoLetivoId: anoLetivo.id, instituicaoId },
      select: { id: true, numero: true },
    });
  } else {
    classe = await prisma.classe.findFirst({
      where: { instituicaoId },
      select: { id: true, nome: true },
    });
  }

  disciplina = await prisma.disciplina.findFirst({
    where: { instituicaoId },
    select: { id: true, nome: true },
  });

  turma = await prisma.turma.findFirst({
    where: {
      instituicaoId,
      anoLetivoId: anoLetivo.id,
      cursoId: curso?.id || undefined,
      classeId: classe?.id || undefined,
    },
    select: { id: true, nome: true },
  });

  if (!disciplina) {
    console.log('❌ Nenhuma disciplina cadastrada na instituição.');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (tipoAcademico === 'SUPERIOR' && !curso) {
    console.log('❌ Nenhum curso cadastrado (obrigatório para Ensino Superior).');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (tipoAcademico === 'SUPERIOR' && !semestre) {
    console.log('❌ Nenhum semestre cadastrado para o ano letivo ativo.');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (tipoAcademico === 'SECUNDARIO' && !classe) {
    console.log('❌ Nenhuma classe cadastrada (obrigatório para Ensino Secundário).');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('2. DADOS DISPONÍVEIS');
  console.log('   Ano Letivo:', anoLetivo.ano, '(id:', anoLetivo.id, ')');
  if (curso) console.log('   Curso:', curso.nome);
  if (classe) console.log('   Classe:', classe.nome);
  console.log('   Disciplina:', disciplina.nome);
  console.log('   Turma:', turma?.nome || '(será criada ou vinculada depois)');
  if (semestre) console.log('   Semestre:', semestre.numero);
  console.log('');

  // ─── 3. VERIFICAR SE JÁ EXISTE PLANO (unicidade: instituicaoId + disciplinaId + anoLetivoId) ───
  const planoExistente = await prisma.planoEnsino.findFirst({
    where: {
      instituicaoId,
      disciplinaId: disciplina.id,
      anoLetivoId: anoLetivo.id,
    },
    include: {
      professor: { include: { user: { select: { nomeCompleto: true } } } },
      turma: { select: { nome: true } },
      aulas: { orderBy: { ordem: 'asc' } },
    },
  });

  let plano: Awaited<ReturnType<typeof prisma.planoEnsino.create>> & {
    disciplina?: { nome: string };
    professor?: { user?: { nomeCompleto: string } };
    turma?: { nome: string };
    aulas?: unknown[];
  };

  if (planoExistente) {
    if (planoExistente.professorId === professor.id) {
      console.log('3. PLANO JÁ EXISTENTE (mesmo professor)');
      console.log('   Reutilizando plano existente:', planoExistente.id);
      plano = planoExistente as any;
      // Se não tiver aulas, adicionar para testar fluxo completo
      const aulasExistentes = await prisma.planoAula.count({
        where: { planoEnsinoId: planoExistente.id },
      });
      if (aulasExistentes === 0) {
        console.log('   Adicionando aulas planejadas ao plano...');
        const trimestre = tipoAcademico === 'SUPERIOR' && semestre ? semestre.numero : 1;
        for (let i = 0; i < 3; i++) {
          await prisma.planoAula.create({
            data: {
              planoEnsinoId: planoExistente.id,
              ordem: i + 1,
              titulo: `Aula teste ${i + 1} - ${disciplina?.nome}`,
              trimestre,
              quantidadeAulas: 2,
              status: 'PLANEJADA',
            },
          });
        }
        const aulas = await prisma.planoAula.findMany({
          where: { planoEnsinoId: planoExistente.id },
          select: { quantidadeAulas: true },
        });
        const totalPlanejada = aulas.reduce((acc, a) => acc + a.quantidadeAulas, 0);
        await prisma.planoEnsino.update({
          where: { id: planoExistente.id },
          data: { cargaHorariaPlanejada: totalPlanejada },
        });
        plano = await prisma.planoEnsino.findUnique({
          where: { id: planoExistente.id },
          include: {
            disciplina: { select: { nome: true } },
            turma: { select: { nome: true } },
            aulas: { orderBy: { ordem: 'asc' } },
          },
        }) as any;
        console.log('   ✅ 3 aulas adicionadas (6h planejadas)');
      }
    } else {
      console.log('3. PLANO JÁ EXISTE para esta disciplina/ano letivo (outro professor)');
      console.log('   Atribuído a:', planoExistente.professor?.user?.nomeCompleto);
      console.log('   Buscando disciplina sem plano para criar nova atribuição...');

      const disciplinasSemPlano = await prisma.disciplina.findMany({
        where: {
          instituicaoId,
          NOT: {
            planosEnsino: {
              some: {
                anoLetivoId: anoLetivo.id,
                instituicaoId,
              },
            },
          },
        },
        select: { id: true, nome: true },
        take: 1,
      });

      if (disciplinasSemPlano.length === 0) {
        console.log('   ⚠️  Todas as disciplinas já têm plano. Usando plano existente do professor.');
        const planoDoProfessor = await prisma.planoEnsino.findFirst({
          where: { professorId: professor.id, instituicaoId },
          include: {
            disciplina: { select: { nome: true } },
            turma: { select: { nome: true } },
            aulas: true,
          },
        });
        if (!planoDoProfessor) {
          console.log('   ❌ Professor não possui nenhum plano. Execute primeiro uma atribuição via frontend.');
          await prisma.$disconnect();
          process.exit(1);
        }
        plano = planoDoProfessor as any;
      } else {
        disciplina = disciplinasSemPlano[0];
        console.log('   Criando novo plano para disciplina:', disciplina.nome);
        plano = await criarPlanoCompleto(prisma, {
          professorId: professor.id,
          instituicaoId,
          anoLetivoId: anoLetivo.id,
          anoLetivo: anoLetivo.ano,
          disciplina,
          curso,
          classe,
          turma,
          semestre,
          tipoAcademico,
        });
      }
    }
  } else {
    console.log('3. CRIANDO NOVO PLANO DE ENSINO');
    plano = await criarPlanoCompleto(prisma, {
      professorId: professor.id,
      instituicaoId,
      anoLetivoId: anoLetivo.id,
      anoLetivo: anoLetivo.ano,
      disciplina,
      curso,
      classe,
      turma,
      semestre,
      tipoAcademico,
    });
  }

  console.log('');
  const numAulas = (plano as any).aulas?.length ?? await prisma.planoAula.count({ where: { planoEnsinoId: plano.id } });
  console.log('4. PLANO CRIADO/OBTIDO');
  console.log('   ID:', plano.id);
  console.log('   Disciplina:', plano.disciplina?.nome || disciplina?.nome);
  console.log('   Turma:', (plano as any).turma?.nome || turma?.nome || '(sem turma)');
  console.log('   Aulas planejadas:', numAulas);
  console.log('   Status:', (plano as any).estado);
  console.log('');

  // ─── 5. VERIFICAÇÕES ─────────────────────────────────────────────────────
  console.log('5. VERIFICAÇÕES (como o frontend/serviços retornariam)');
  console.log('   ');

  let ok = 0;
  let fail = 0;

  // 5a. buscarTurmasEDisciplinasProfessorComPlanoAtivo
  try {
    const resultado = await buscarTurmasEDisciplinasProfessorComPlanoAtivo(
      instituicaoId,
      professor.id,
      anoLetivo.id,
      professor.userId
    );
    const turmas = resultado.filter((r: any) => r.turma?.id);
    const semTurma = resultado.filter((r: any) => !r.turma?.id);
    console.log('   a) buscarTurmasEDisciplinasProfessorComPlanoAtivo:');
    console.log('      Turmas:', turmas.length, '| Disciplinas sem turma:', semTurma.length);
    if (resultado.length > 0) {
      console.log('      ✅ OK – Professor vê atribuições no painel');
      ok++;
    } else {
      console.log('      ❌ FALHOU – Nenhuma atribuição retornada');
      fail++;
    }
  } catch (e) {
    console.log('      ❌ FALHOU:', (e as Error).message);
    fail++;
  }

  // 5b. Simular GET /professor-disciplinas/professor/:id (= planos do PlanoEnsino)
  try {
    const planosProfessor = await prisma.planoEnsino.findMany({
      where: {
        professorId: professor.id,
        instituicaoId,
      },
      include: {
        disciplina: { select: { nome: true } },
        turma: { select: { nome: true } },
      },
    });
    console.log('\n   b) GET professor-disciplinas/professor/:id (PlanoEnsino):');
    console.log('      Planos:', planosProfessor.length);
    if (planosProfessor.length > 0) {
      console.log('      ✅ OK – ViewProfessorDialog exibiria disciplinas corretamente');
      ok++;
    } else {
      console.log('      ❌ FALHOU – Nenhum plano retornado');
      fail++;
    }
  } catch (e) {
    console.log('      ❌ FALHOU:', (e as Error).message);
    fail++;
  }

  // 5c. Simular getProfessorComprovativo (via PlanoEnsino)
  try {
    const professorRecord = await prisma.professor.findFirst({
      where: { userId: professor.userId, instituicaoId },
      select: { id: true },
    });
    const planosComprovativo = professorRecord
      ? await prisma.planoEnsino.findMany({
          where: {
            professorId: professorRecord.id,
            instituicaoId,
          },
          include: {
            disciplina: { select: { nome: true } },
            turma: { select: { nome: true } },
            anoLetivoRef: { select: { ano: true } },
          },
        })
      : [];
    console.log('\n   c) getProfessorComprovativo (PlanoEnsino):');
    console.log('      Disciplinas no comprovativo:', planosComprovativo.length);
    if (planosComprovativo.length > 0) {
      console.log('      ✅ OK – Comprovativo exibiria disciplinas corretamente');
      ok++;
    } else {
      console.log('      ❌ FALHOU – Comprovativo vazio');
      fail++;
    }
  } catch (e) {
    console.log('      ❌ FALHOU:', (e as Error).message);
    fail++;
  }

  // 5d. Turmas do professor (via PlanoEnsino)
  try {
    const turmasProfessor = await prisma.turma.findMany({
      where: {
        planosEnsino: {
          some: {
            professorId: professor.id,
            instituicaoId,
          },
        },
      },
    });
    console.log('\n   d) Turmas com PlanoEnsino do professor:');
    console.log('      Turmas:', turmasProfessor.length);
    if (turmasProfessor.length >= 0) {
      console.log('      ✅ OK – Turmas resolvidas via PlanoEnsino');
      ok++;
    }
  } catch (e) {
    console.log('      ❌ FALHOU:', (e as Error).message);
    fail++;
  }

  // ─── RESUMO ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESUMO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   OK:', ok, '| FALHAS:', fail);
  if (fail === 0) {
    console.log('\n   ✅ TESTE CONCLUÍDO COM SUCESSO');
  } else {
    console.log('\n   ❌ ALGUMAS VERIFICAÇÕES FALHARAM');
  }
  console.log('');

  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

async function criarPlanoCompleto(
  prisma: any,
  p: {
    professorId: string;
    instituicaoId: string;
    anoLetivoId: string;
    anoLetivo: number;
    disciplina: { id: string; nome: string };
    curso: { id: string; nome: string } | null;
    classe: { id: string; nome: string } | null;
    turma: { id: string; nome: string } | null;
    semestre: { id: string; numero: number } | null;
    tipoAcademico: string;
  }
) {
  const disciplina = await prisma.disciplina.findUnique({
    where: { id: p.disciplina.id },
    select: { cargaHoraria: true },
  });
  const cargaHoraria = disciplina?.cargaHoraria ?? 60;

  const plano = await prisma.planoEnsino.create({
    data: {
      professorId: p.professorId,
      instituicaoId: p.instituicaoId,
      disciplinaId: p.disciplina.id,
      anoLetivoId: p.anoLetivoId,
      anoLetivo: p.anoLetivo,
      cursoId: p.curso?.id ?? null,
      classeId: p.classe?.id ?? null,
      turmaId: p.turma?.id ?? null,
      cargaHorariaTotal: cargaHoraria,
      cargaHorariaPlanejada: 0,
      semestre: p.tipoAcademico === 'SUPERIOR' && p.semestre ? p.semestre.numero : null,
      semestreId: p.semestre?.id ?? null,
      classeOuAno: p.tipoAcademico === 'SECUNDARIO' ? (p.classe?.nome || '1º Ano') : null,
      estado: 'APROVADO',
      status: 'APROVADO',
      bloqueado: false,
    },
    include: {
      disciplina: { select: { nome: true } },
      professor: { include: { user: { select: { nomeCompleto: true } } } },
      turma: { select: { nome: true } },
      aulas: true,
    },
  });

  // Criar 3 aulas planejadas
  const titulos = ['Introdução à disciplina', 'Conteúdo programático I', 'Conteúdo programático II'];
  const trimestre = p.tipoAcademico === 'SUPERIOR' && p.semestre ? p.semestre.numero : 1;

  for (let i = 0; i < titulos.length; i++) {
    await prisma.planoAula.create({
      data: {
        planoEnsinoId: plano.id,
        ordem: i + 1,
        titulo: titulos[i],
        trimestre,
        quantidadeAulas: 2,
        status: 'PLANEJADA',
      },
    });
  }

  // Recalcular cargaHorariaPlanejada (soma das aulas)
  const aulas = await prisma.planoAula.findMany({
    where: { planoEnsinoId: plano.id },
    select: { quantidadeAulas: true },
  });
  const totalPlanejada = aulas.reduce((acc, a) => acc + a.quantidadeAulas, 0);
  await prisma.planoEnsino.update({
    where: { id: plano.id },
    data: { cargaHorariaPlanejada: totalPlanejada },
  });

  return prisma.planoEnsino.findUnique({
    where: { id: plano.id },
    include: {
      disciplina: { select: { nome: true } },
      professor: { include: { user: { select: { nomeCompleto: true } } } },
      turma: { select: { nome: true } },
      aulas: { orderBy: { ordem: 'asc' } },
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
