/**
 * Resolve entityId + entityType para objeto de dados para templates.
 * POST /templates/:id/render { entityId, entityType } → data para docxtemplater.
 * Multi-tenant: instituicaoId obrigatório.
 */
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

export type EntityType = 'student' | 'planoEnsino' | 'matricula' | 'pagamento' | 'documento';

/**
 * Resolve dados do sistema a partir de entityId e entityType.
 * Retorna objeto no formato { student: {...}, instituicao: {...}, document: {...}, ... }
 */
export async function resolveEntityData(
  entityId: string,
  entityType: EntityType,
  instituicaoId: string
): Promise<Record<string, unknown>> {
  const inst = await prisma.instituicao.findFirst({
    where: { id: instituicaoId },
    include: { configuracao: { select: { nif: true, endereco: true, telefone: true } } },
  });
  const baseInst = inst
    ? {
        nome: inst.nome,
        nif: inst.configuracao?.nif,
        endereco: inst.configuracao?.endereco ?? inst.endereco,
        telefone: inst.configuracao?.telefone ?? inst.telefone,
        email: inst.emailContato,
      }
    : {};

  if (entityType === 'student') {
    const user = await prisma.user.findFirst({
      where: { id: entityId, instituicaoId },
      include: {
        matriculas: {
          where: { status: 'Ativa' },
          include: {
            turma: {
              include: {
                curso: true,
                classe: true,
                anoLetivoRef: true,
              },
            },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!user) throw new AppError('Estudante não encontrado', 404);
    const mat = user.matriculas?.[0];
    const turma = mat?.turma;
    return {
      student: {
        fullName: user.nomeCompleto,
        birthDate: user.dataNascimento
          ? new Date(user.dataNascimento).toLocaleDateString('pt-AO')
          : null,
        gender: (user as any).genero,
        bi: (user as any).bi ?? (user as any).documentoId,
        numeroEstudante: user.numeroIdentificacaoPublica,
        email: user.email,
        telefone: (user as any).telefone,
        endereco: (user as any).endereco,
        curso: turma?.curso?.nome,
        classe: turma?.classe?.nome,
        turma: turma?.nome,
        anoLetivo: turma?.anoLetivoRef?.ano?.toString(),
      },
      instituicao: baseInst,
      document: { number: '-', codigoVerificacao: '', dataEmissao: new Date().toISOString(), tipo: 'DOCUMENTO' },
      finance: {},
    };
  }

  if (entityType === 'planoEnsino') {
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: entityId, instituicaoId },
      include: {
        disciplina: true,
        turma: { include: { curso: true, classe: true, anoLetivoRef: true } },
        professor: { include: { user: { select: { nomeCompleto: true } } } },
      },
    });
    if (!plano) throw new AppError('Plano de ensino não encontrado', 404);
    const { montarVarsPauta } = await import('./pautaTemplate.service.js');
    const { consolidarPlanoEnsino } = await import('./frequencia.service.js');
    let consolidacao;
    try {
      consolidacao = await consolidarPlanoEnsino(entityId, instituicaoId, null);
    } catch {
      consolidacao = { alunos: [] } as any;
    }
    const vars = montarVarsPauta({
      consolidacao,
      instituicaoNome: inst?.nome ?? '',
      nif: inst?.configuracao?.nif ?? '',
      anoLetivo: plano.turma?.anoLetivoRef?.ano?.toString() ?? '',
      labelCursoClasse: plano.turma?.classeId ? 'Classe' : 'Curso',
      valorCursoClasse: plano.turma?.classe?.nome ?? plano.turma?.curso?.nome ?? '',
      turmaNome: plano.turma?.nome ?? '',
      disciplinaNome: plano.disciplina?.nome ?? '',
      profNome: plano.professor?.user?.nomeCompleto ?? '',
      dataEmissao: new Date().toLocaleDateString('pt-AO'),
      codigoVerificacao: '',
      tipoPauta: 'PROVISORIA',
    });
    return {
      pauta: vars,
      instituicao: baseInst,
      student: {},
      document: {},
      finance: {},
    };
  }

  if (entityType === 'pagamento') {
    const pag = await prisma.pagamento.findFirst({
      where: { id: entityId },
      include: { mensalidade: { include: { aluno: true } } },
    });
    if (!pag) throw new AppError('Pagamento não encontrado', 404);
    const aluno = pag.mensalidade?.aluno;
    const recibo = await prisma.recibo.findUnique({ where: { pagamentoId: entityId }, select: { numeroRecibo: true, formaPagamento: true } });
    return {
      finance: {
        amount: String((pag as any).valor ?? pag.valor),
        dataPagamento: pag.dataPagamento ? new Date(pag.dataPagamento).toLocaleDateString('pt-AO') : null,
        formaPagamento: recibo?.formaPagamento ?? pag.metodoPagamento,
        reciboNumero: recibo?.numeroRecibo ?? '',
      },
      student: aluno
        ? { fullName: aluno.nomeCompleto, numeroEstudante: aluno.numeroIdentificacaoPublica }
        : {},
      instituicao: baseInst,
      document: {},
    };
  }

  throw new AppError(`entityType não suportado: ${entityType}. Use: student, planoEnsino, pagamento`, 400);
}
