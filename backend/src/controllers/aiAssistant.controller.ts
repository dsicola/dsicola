/**
 * Assistente IA - DSICOLA
 * Integração com OpenAI para assistente virtual
 */
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { AppError } from '../middlewares/errorHandler.js';

const SYSTEM_PROMPT = `Você é um assistente virtual inteligente para um sistema de gestão escolar/universitário chamado DSICOLA.

Você pode ajudar os usuários com:
- Dúvidas sobre navegação no sistema
- Como cadastrar alunos, professores e funcionários
- Como lançar notas e frequências
- Como gerar relatórios e boletins
- Como gerenciar mensalidades e pagamentos
- Configurações da instituição
- Dúvidas sobre funcionalidades do sistema

Seja sempre educado, prestativo e conciso. Responda em português de Portugal/Angola.
Se não souber a resposta, sugira que o usuário consulte o manual do sistema ou entre em contato com o suporte.

Algumas funcionalidades do sistema:
- Gestão de Alunos: cadastro, matrículas, documentos
- Gestão Académica: cursos, disciplinas, turmas, horários
- Gestão de Professores: cadastro, atribuição de disciplinas
- Gestão Financeira: mensalidades, bolsas, pagamentos
- Recursos Humanos: funcionários, folha de pagamento, contratos
- Comunicação: comunicados, emails, notificações
- Relatórios: boletins, pautas, certificados
- Calendário Académico: eventos, feriados, períodos letivos`;

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

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: chatMessages,
        max_tokens: 500,
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
      console.error('[AI] OpenAI auth error:', response.status);
      return res.status(502).json({
        response: 'Configuração de IA inválida. Contacte o administrador.',
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
