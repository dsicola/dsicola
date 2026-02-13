import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Você é um assistente virtual inteligente para um sistema de gestão escolar/universitário chamado DSICOLA. 
    
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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10), // Limitar histórico para evitar tokens excessivos
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

    return new Response(
      JSON.stringify({ response: assistantResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('AI Assistant error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
