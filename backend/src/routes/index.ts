import { Router } from 'express';
import authRoutes from './auth.routes.js';
import aiAssistantRoutes from './aiAssistant.routes.js';
import twoFactorRoutes from './twoFactor.routes.js';
import userRoutes from './user.routes.js';
import instituicaoRoutes from './instituicao.routes.js';
import cursoRoutes from './curso.routes.js';
import classeRoutes from './classe.routes.js';
import disciplinaRoutes from './disciplina.routes.js';
import disciplinaAvisoRoutes from './disciplinaAviso.routes.js';
import turmaRoutes from './turma.routes.js';
import matriculaRoutes from './matricula.routes.js';
import notaRoutes from './nota.routes.js';
import periodoLancamentoNotasRoutes from './periodoLancamentoNotas.routes.js';
import aulaRoutes from './aula.routes.js';
import frequenciaRoutes from './frequencia.routes.js';
import mensalidadeRoutes from './mensalidade.routes.js';
import pagamentoRoutes from './pagamento.routes.js';
import comunicadoRoutes from './comunicado.routes.js';
import turnoRoutes from './turno.routes.js';
import profileRoutes from './profile.routes.js';
import userRolesRoutes from './user-roles.routes.js';
import statsRoutes from './stats.routes.js';
import candidaturaRoutes from './candidatura.routes.js';
import horarioRoutes from './horario.routes.js';
import exameRoutes from './exame.routes.js';
import planoRoutes from './plano.routes.js';
import assinaturaRoutes from './assinatura.routes.js';
import funcionarioRoutes from './funcionario.routes.js';
import estudanteRoutes from './estudante.routes.js';
import fornecedorRoutes from './fornecedor.routes.js';
import contratoFornecedorRoutes from './contratoFornecedor.routes.js';
import pagamentoFornecedorRoutes from './pagamentoFornecedor.routes.js';
import departamentoRoutes from './departamento.routes.js';
import cargoRoutes from './cargo.routes.js';
import eventoRoutes from './evento.routes.js';
import alojamentoRoutes from './alojamento.routes.js';
import alunoDisciplinaRoutes from './alunoDisciplina.routes.js';
import matriculaDisciplinaRoutes from './matriculaDisciplina.routes.js';
import matriculasDisciplinasV2Routes from './matriculasDisciplinasV2.routes.js';
import matriculaAnualRoutes from './matriculaAnual.routes.js';
import notificacaoRoutes from './notificacao.routes.js';
import documentoAlunoRoutes from './documentoAluno.routes.js';
import logAuditoriaRoutes from './logAuditoria.routes.js';
// HR routes
import folhaPagamentoRoutes from './folhaPagamento.routes.js';
import frequenciaFuncionarioRoutes from './frequenciaFuncionario.routes.js';
import contratoFuncionarioRoutes from './contratoFuncionario.routes.js';
import documentoFuncionarioRoutes from './documentoFuncionario.routes.js';
import alocacaoAlojamentoRoutes from './alocacaoAlojamento.routes.js';
import emailEnviadoRoutes from './emailEnviado.routes.js';
import boletimRoutes from './boletim.routes.js';
import tipoDocumentoRoutes from './tipoDocumento.routes.js';
import documentoEmitidoRoutes from './documentoEmitido.routes.js';
import documentoOficialRoutes from './documentoOficial.routes.js';
import metaFinanceiraRoutes from './metaFinanceira.routes.js';
import bolsaRoutes from './bolsa.routes.js';
import alunoBolsaRoutes from './alunoBolsa.routes.js';
import trimestreFechadoRoutes from './trimestreFechado.routes.js';
import configuracaoLandingRoutes from './configuracaoLanding.routes.js';
import leadRoutes from './lead.routes.js';
import configuracaoInstituicaoRoutes from './configuracaoInstituicao.routes.js';
import parametrosSistemaRoutes from './parametrosSistema.routes.js';
import videoAulaRoutes from './videoAula.routes.js';
// Additional routes
import logsRedefinicaoSenhaRoutes from './logsRedefinicaoSenha.routes.js';
import pagamentoInstituicaoRoutes from './pagamentoInstituicao.routes.js';
import saftExportRoutes from './saftExport.routes.js';
import historicoRhRoutes from './historicoRh.routes.js';
import rhRoutes from './rh.routes.js';
import estruturaOrganizacionalRoutes from './estruturaOrganizacional.routes.js';
import mensagemResponsavelRoutes from './mensagemResponsavel.routes.js';
import professorDisciplinaRoutes from './professorDisciplina.routes.js';
import professorVinculoRoutes from './professorVinculo.routes.js';
import estatisticaRoutes from './estatistica.routes.js';
import backupRoutes from './backup.routes.js';
import adminBackupRoutes from './admin.backup.routes.js';
import termoLegalRoutes from './termoLegal.routes.js';
// New utility routes
import storageRoutes from './storage.routes.js';
import pautaRoutes from './pauta.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import treinamentoRoutes from './treinamento.routes.js';
import utilsRoutes from './utils.routes.js';
import responsavelAlunoRoutes from './responsavelAluno.routes.js';
import feriadoRoutes from './feriado.routes.js';
import configuracaoMultaRoutes from './configuracaoMulta.routes.js';
import planoEnsinoRoutes from './planoEnsino.routes.js';
import aulasLancadasRoutes from './aulasLancadas.routes.js';
import presencaRoutes from './presenca.routes.js';
import avaliacaoRoutes from './avaliacao.routes.js';
import distribuicaoAulasRoutes from './distribuicaoAulas.routes.js';
import planosPrecosRoutes from './planosPrecos.routes.js';
import debugRoutes from './debug.routes.js';
import documentoFiscalRoutes from './documentoFiscal.routes.js';
import reciboRoutes from './recibo.routes.js';
import pagamentoLicencaRoutes from './pagamentoLicenca.routes.js';
import pontoRelatorioRoutes from './pontoRelatorio.routes.js';
import zktecoRoutes from './zkteco.routes.js';
import dispositivoBiometricoRoutes from './dispositivoBiometrico.routes.js';
import integracaoBiometriaRoutes from './integracaoBiometria.routes.js';
import biometriaRoutes from './biometria.routes.js';
import relatoriosRoutes from './relatorios.routes.js';
import encerramentoAcademicoRoutes from './encerramentoAcademico.routes.js';
import workflowRoutes from './workflow.routes.js';
import bibliotecaRoutes from './biblioteca.routes.js';
import semestreRoutes from './semestre.routes.js';
import trimestreRoutes from './trimestre.routes.js';
import anoLetivoRoutes from './anoLetivo.routes.js';
import eventoGovernamentalRoutes from './eventoGovernamental.routes.js';
import governoRoutes from './governo.routes.js';
import reaberturaAnoLetivoRoutes from './reaberturaAnoLetivo.routes.js';
import equivalenciaRoutes from './equivalencia.routes.js';
import conclusaoCursoRoutes from './conclusaoCurso.routes.js';
import relatoriosOficiaisRoutes from './relatoriosOficiais.routes.js';
import bloqueioAcademicoRoutes from './bloqueioAcademico.routes.js';
import segurancaRoutes from './seguranca.routes.js';
import chatRoutes from './chat.routes.js';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: API em funcionamento
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Seed super-admin (uma vez): GET /seed-superadmin?secret=SEU_SEED_SECRET
// Configure SEED_SECRET nas variáveis do Railway, depois chame e remova a variável.
router.get('/seed-superadmin', async (req, res, next) => {
  try {
    const secret = process.env.SEED_SECRET;
    if (!secret || secret !== req.query.secret) {
      return res.status(404).json({ error: 'Não encontrado' });
    }
    const { runSuperAdminSeed } = await import('../services/seed.service.js');
    const result = await runSuperAdminSeed();
    res.json({
      success: true,
      ...result,
      senha: 'SuperAdmin@123',
    });
  } catch (error) {
    next(error);
  }
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/ai', aiAssistantRoutes);
router.use('/two-factor', twoFactorRoutes);
router.use('/users', userRoutes);
router.use('/instituicoes', instituicaoRoutes);
router.use('/cursos', cursoRoutes);
router.use('/classes', classeRoutes);
router.use('/disciplinas', disciplinaAvisoRoutes); // Antes: rotas de avisos (PROFESSOR/ALUNO)
router.use('/disciplinas', disciplinaRoutes);
router.use('/turmas', turmaRoutes);
router.use('/matriculas', matriculaRoutes);
router.use('/notas', notaRoutes);
router.use('/periodos-lancamento-notas', periodoLancamentoNotasRoutes);
router.use('/aulas', aulaRoutes);
router.use('/frequencias', frequenciaRoutes);
router.use('/mensalidades', mensalidadeRoutes);
router.use('/pagamentos', pagamentoRoutes);
router.use('/comunicados', comunicadoRoutes);
router.use('/turnos', turnoRoutes);
router.use('/profiles', profileRoutes);
router.use('/user-roles', userRolesRoutes);
router.use('/stats', statsRoutes);
router.use('/candidaturas', candidaturaRoutes);
router.use('/horarios', horarioRoutes);
router.use('/exames', exameRoutes);
router.use('/planos', planoRoutes);
router.use('/assinaturas', assinaturaRoutes);
router.use('/funcionarios', funcionarioRoutes);
router.use('/estudantes', estudanteRoutes);
router.use('/fornecedores', fornecedorRoutes);
router.use('/contratos-fornecedor', contratoFornecedorRoutes);
router.use('/pagamentos-fornecedor', pagamentoFornecedorRoutes);
router.use('/departamentos', departamentoRoutes);
router.use('/cargos', cargoRoutes);
router.use('/eventos', eventoRoutes);
router.use('/alojamentos', alojamentoRoutes);
router.use('/aluno-disciplinas', alunoDisciplinaRoutes);
router.use('/matriculas-disciplinas', matriculaDisciplinaRoutes);
router.use('/v2/matriculas-disciplinas', matriculasDisciplinasV2Routes);
router.use('/matriculas-anuais', matriculaAnualRoutes);
router.use('/notificacoes', notificacaoRoutes);
router.use('/documentos-aluno', documentoAlunoRoutes);
router.use('/logs-auditoria', logAuditoriaRoutes);
router.use('/folha-pagamento', folhaPagamentoRoutes);
router.use('/funcionario-frequencias', frequenciaFuncionarioRoutes);
router.use('/contratos-funcionario', contratoFuncionarioRoutes);
router.use('/documentos-funcionario', documentoFuncionarioRoutes);
router.use('/alocacoes-alojamento', alocacaoAlojamentoRoutes);
router.use('/emails-enviados', emailEnviadoRoutes);
router.use('/boletim', boletimRoutes);
router.use('/tipos-documento', tipoDocumentoRoutes);
router.use('/documentos-emitidos', documentoEmitidoRoutes);
router.use('/documentos', documentoOficialRoutes);
router.use('/metas-financeiras', metaFinanceiraRoutes);
router.use('/bolsas', bolsaRoutes);
router.use('/aluno-bolsas', alunoBolsaRoutes);
router.use('/trimestres-fechados', trimestreFechadoRoutes);
router.use('/configuracoes-landing', configuracaoLandingRoutes);
router.use('/leads', leadRoutes);
router.use('/configuracoes-instituicao', configuracaoInstituicaoRoutes);
router.use('/parametros-sistema', parametrosSistemaRoutes);
router.use('/logs-redefinicao-senha', logsRedefinicaoSenhaRoutes);
router.use('/pagamentos-instituicao', pagamentoInstituicaoRoutes);
router.use('/saft-exports', saftExportRoutes);
router.use('/historico-rh', historicoRhRoutes);
router.use('/rh', rhRoutes);
router.use('/rh/estrutura-organizacional', estruturaOrganizacionalRoutes);
router.use('/mensagens-responsavel', mensagemResponsavelRoutes);
router.use('/professor-disciplinas', professorDisciplinaRoutes);
router.use('/professores', professorVinculoRoutes);
router.use('/estatisticas', estatisticaRoutes);
router.use('/backup', backupRoutes);
router.use('/admin', adminBackupRoutes);
router.use('/termos-legais', termoLegalRoutes);
// Utility routes
router.use('/storage', storageRoutes);
router.use('/pautas', pautaRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/treinamento', treinamentoRoutes);
router.use('/utils', utilsRoutes);
router.use('/responsavel-alunos', responsavelAlunoRoutes);
router.use('/feriados', feriadoRoutes);
router.use('/configuracao-multa', configuracaoMultaRoutes);
router.use('/plano-ensino', planoEnsinoRoutes);
router.use('/', aulasLancadasRoutes);
router.use('/', presencaRoutes);
router.use('/avaliacoes', avaliacaoRoutes);
router.use('/distribuicao-aulas', distribuicaoAulasRoutes);
router.use('/planos-precos', planosPrecosRoutes);
router.use('/debug', debugRoutes);
router.use('/documentos-fiscais', documentoFiscalRoutes);
router.use('/recibos', reciboRoutes);
router.use('/licenca/pagamento', pagamentoLicencaRoutes);
router.use('/relatorios-ponto', pontoRelatorioRoutes);
router.use('/dispositivos-biometricos', dispositivoBiometricoRoutes);
router.use('/integracao/biometria', integracaoBiometriaRoutes);
router.use('/zkteco', zktecoRoutes);
router.use('/video-aulas', videoAulaRoutes);
router.use('/biometria', biometriaRoutes);
router.use('/relatorios', relatoriosRoutes);
router.use('/encerramentos', encerramentoAcademicoRoutes);
router.use('/workflow', workflowRoutes);
router.use('/biblioteca', bibliotecaRoutes);
router.use('/semestres', semestreRoutes);
router.use('/trimestres', trimestreRoutes);
router.use('/anos-letivos', anoLetivoRoutes);
router.use('/governo', governoRoutes);
router.use('/eventos-governamentais', eventoGovernamentalRoutes);
router.use('/reaberturas-ano-letivo', reaberturaAnoLetivoRoutes);
router.use('/equivalencias', equivalenciaRoutes);
router.use('/conclusoes-cursos', conclusaoCursoRoutes);
router.use('/relatorios-oficiais', relatoriosOficiaisRoutes);
router.use('/bloqueio-academico', bloqueioAcademicoRoutes);
router.use('/seguranca', segurancaRoutes);
router.use('/chat', chatRoutes);

export default router;
