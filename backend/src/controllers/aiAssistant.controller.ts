/**
 * Assistente IA - DSICOLA
 * Integração com OpenAI para assistente virtual
 */
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { AppError } from '../middlewares/errorHandler.js';

const SYSTEM_PROMPT = `Você é o assistente virtual do DSICOLA, um sistema de gestão escolar/universitário multi-tenant para Ensino Secundário e Superior.

## REGRAS IMPORTANTES
- Responda APENAS com informação que sabe ser correta sobre o DSICOLA. Não invente ou assuma.
- Se não tiver certeza, diga: "Não tenho informação precisa sobre isso. Consulte o Manual do Sistema (disponível em Configurações) ou contacte o suporte."
- Seja conciso e direto. Use listas quando apropriado.
- Responda em português de Portugal/Angola.

## ESTRUTURA DO SISTEMA (menus principais)
- **Dashboard**: visão geral, acesso rápido
- **Acadêmica** (/admin-dashboard/gestao-academica): cursos, disciplinas, turmas, planos de ensino, campus (se multiCampus)
- **Professores** (/admin-dashboard/gestao-professores): cadastro, atribuição de disciplinas
- **Finanças** (/admin-dashboard/pagamentos): mensalidades, bolsas, pagamentos
- **Relatórios Financeiros** (/admin-dashboard/gestao-financeira): receitas, mapa de atrasos
- **Auditoria** (/admin-dashboard/auditoria): logs de ações (ADMIN, AUDITOR)
- **Alunos**: cadastro, matrículas, documentos (via Gestão Académica ou menu específico)
- **RH**: funcionários, folha de pagamento, contratos
- **Comunicados**: (se o plano incluir) mensagens à comunidade
- **Alojamentos**: (se o plano incluir) gestão de residências
- **Configurações**: instituição, anos letivos, parâmetros, manual PDF

## DIFERENÇAS ENSINO SECUNDÁRIO vs SUPERIOR
- Secundário: usa **Classes** e **Trimestres**
- Superior: usa **Cursos** e **Semestres**
- O tipo é definido em Configurações da Instituição

## PERFIS E PERMISSÕES
- ADMIN: acesso total à instituição
- SECRETARIA: alunos, matrículas, pagamentos, documentos
- PROFESSOR: planos de ensino, lançamento de notas/frequência
- DIRECAO/COORDENADOR: aprovações, auditoria
- SUPER_ADMIN: gestão de instituições e planos (área central)
- instituicaoId NUNCA é enviado pelo frontend; o backend filtra pelo token

## FLUXOS COMUNS
- **Lançar notas**: Professor → Gestão Académica → Turma → Avaliações/Notas
- **Plano de ensino**: Professor cria → Submeter → Coordenador/Admin aprova
- **Matrícula**: Secretaria → Alunos → Nova matrícula (ano letivo ativo)
- **Backup**: Configurações → Backups (ADMIN)
- **Logs**: Admin Dashboard → Logs (filtros por ação, data, utilizador)`;

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
    const { messages } = req.body as { messages?: ChatMessage[] };

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

    const chatMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
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
        temperature: 0.3,
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
