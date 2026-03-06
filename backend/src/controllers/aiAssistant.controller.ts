/**
 * Assistente IA - DSICOLA
 * Integração com OpenAI para assistente virtual
 */
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { AppError } from '../middlewares/errorHandler.js';

const SYSTEM_PROMPT = `Você é o assistente virtual do DSICOLA, um sistema de gestão escolar/universitário multi-tenant para Ensino Secundário e Superior.

## REGRAS ABSOLUTAS
- Responda APENAS com a informação EXATA abaixo. NÃO invente, NÃO assuma, NÃO generalize.
- Se a pergunta for sobre algo que NÃO está nesta lista, responda: "Não tenho informação precisa sobre isso. Consulte o Manual do Sistema (Configurações → Sistema) ou contacte o suporte."
- Seja conciso. Use listas quando apropriado.
- Responda em português de Portugal/Angola.

## MENUS E ROTAS (exatos - use estes caminhos)
- **Dashboard**: /admin-dashboard (visão geral)
- **Acadêmica**: /admin-dashboard/gestao-academica — cursos, disciplinas, turmas, planos de ensino, campus
- **Professores**: /admin-dashboard/gestao-professores — cadastro, atribuição de disciplinas e turmas
- **Finanças**: /admin-dashboard/pagamentos — mensalidades, bolsas, pagamentos, ponto de venda
- **Contabilidade**: /admin-dashboard/contabilidade — plano de contas, lançamentos contábeis, balancete (ADMIN, FINANCEIRO)
- **Relatórios Financeiros**: /admin-dashboard/gestao-financeira — receitas, mapa de atrasos, impressão PDF
- **Exportar SAFT**: /admin-dashboard/exportar-saft — ficheiro fiscal Angola (ADMIN)
- **Auditoria**: /admin-dashboard/auditoria — logs de ações (AUDITOR, DIRECAO, COORDENADOR)
- **Relatórios Oficiais**: /secretaria-dashboard/relatorios-oficiais — pauta, boletim, histórico
- **Administrativo**: /admin-dashboard/gestao-alunos — estudantes, matrículas, documentos
- **RH**: /admin-dashboard/recursos-humanos — funcionários, folha, contratos, fornecedores, departamentos, cargos
- **Comunicados**: /admin-dashboard/comunicados (se o plano incluir)
- **Alojamentos**: /admin-dashboard/gestao-moradias (se o plano incluir)
- **Sistema**: /admin-dashboard/configuracoes — instituição, anos letivos, parâmetros, backup, manual PDF

## PAINÉIS POR PERFIL
- **Professor**: /painel-professor — frequência (/painel-professor/frequencia), notas (/painel-professor/notas), horários, relatórios
- **Aluno**: /painel-aluno — mensalidades, boletim, histórico, horários
- **Secretaria**: /secretaria-dashboard
- **Ponto de venda**: /ponto-de-venda (POS)

## SECUNDÁRIO vs SUPERIOR
- Secundário: Classes, Trimestres
- Superior: Cursos, Semestres
- Definido em Configurações da Instituição

## PERFIS
- ADMIN: acesso total
- SECRETARIA: alunos, matrículas, pagamentos, documentos
- FINANCEIRO: finanças, contabilidade, pagamentos
- PROFESSOR: planos de ensino, notas, frequência (apenas suas turmas)
- DIRECAO/COORDENADOR: aprovações, auditoria
- SUPER_ADMIN: gestão de instituições (área central, não dados acadêmicos)

## FLUXOS
- **Lançar notas**: Professor → Painel Professor → Lançar Notas (ou Gestão Académica → Turma → Avaliações)
- **Plano de ensino**: Professor cria → Submeter → Coordenador/Admin aprova
- **Matrícula**: Administrativo (gestao-alunos) ou Secretaria → Nova matrícula (ano letivo ativo)
- **Contabilidade**: Finanças → Contabilidade → Plano de Contas / Lançamentos / Balancete
- **Backup**: Sistema (configuracoes) → Backups`;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * POST /ai/assistant
 * Recebe mensagens e retorna resposta da IA (OpenAI)
 */
export const chat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages, context } = req.body as {
      messages?: ChatMessage[];
      context?: { path?: string; role?: string };
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new AppError('O campo "messages" é obrigatório e deve ser um array não vazio', 400);
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();

    if (!OPENAI_API_KEY) {
      return res.json({
        response:
          'O assistente de IA está em configuração. Por favor, contacte o administrador para configurar a chave OPENAI_API_KEY no ficheiro .env do backend. Entretanto, pode consultar o manual do sistema ou entrar em contato com o suporte.',
      });
    }

    // Contexto do frontend: página atual e perfil do utilizador (para respostas mais precisas)
    let contextHint = '';
    if (context?.path || context?.role) {
      contextHint = `\n\n## CONTEXTO ATUAL DO UTILIZADOR\n- Página atual: ${context.path || 'desconhecida'}\n- Perfil: ${context.role || 'desconhecido'}\nUse esta informação para dar respostas mais relevantes ao que o utilizador está a ver.`;
    }

    const chatMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT + contextHint },
      ...messages.slice(-10).map((m: ChatMessage) => ({
        role: m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      })),
    ];

    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
    const maxTokens = Math.min(parseInt(process.env.OPENAI_MAX_TOKENS || '800', 10) || 800, 1500);

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: chatMessages,
        max_tokens: maxTokens,
        temperature: 0.2, // Mais baixo = respostas mais precisas e menos inventadas
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
        validateStatus: () => true,
      }
    );

    if (response.status === 429) {
      return res.json({
        response: 'Limite de requisições atingido. Tente novamente em alguns segundos.',
      });
    }
    if (response.status === 401 || response.status === 403) {
      const openaiError = response.data?.error?.message || response.data?.message;
      console.error('[AI] OpenAI auth error:', response.status, openaiError || response.data);
      const hint = response.status === 401
        ? 'A chave OPENAI_API_KEY no .env do backend pode estar incorreta ou expirada. Verifique em platform.openai.com.'
        : 'A chave OPENAI_API_KEY pode não ter permissões ou a conta OpenAI pode ter restrições.';
      return res.status(502).json({
        response: `Configuração de IA inválida. ${hint} Contacte o administrador do sistema.`,
      });
    }
    if (response.status !== 200) {
      console.error('[AI] OpenAI error:', response.status, response.data);
      throw new AppError(
        `Erro no serviço de IA (${response.status}). Tente novamente.`,
        502
      );
    }

    const content = response.data?.choices?.[0]?.message?.content;
    return res.json({
      response: content || 'Desculpe, não consegui processar sua mensagem.',
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(502).json({
        response: 'O serviço de IA está temporariamente indisponível. Tente novamente.',
      });
    }
    console.error('[AI Assistant]', error);
    next(error);
  }
};
