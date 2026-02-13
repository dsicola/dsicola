-- Tabela de tipos de documentos acadêmicos
CREATE TABLE public.tipos_documento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT,
  template_html TEXT NOT NULL,
  requer_assinatura BOOLEAN NOT NULL DEFAULT true,
  taxa NUMERIC DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de documentos emitidos
CREATE TABLE public.documentos_emitidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_documento TEXT NOT NULL UNIQUE,
  tipo_documento_id UUID NOT NULL REFERENCES public.tipos_documento(id),
  aluno_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emitido_por UUID REFERENCES auth.users(id),
  data_emissao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_validade TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'Emitido', -- Emitido, Cancelado, Expirado
  observacoes TEXT,
  dados_adicionais JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tipos_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_emitidos ENABLE ROW LEVEL SECURITY;

-- Políticas para tipos de documento
CREATE POLICY "Todos autenticados podem ver tipos de documento" 
ON public.tipos_documento FOR SELECT 
TO authenticated 
USING (ativo = true);

CREATE POLICY "Admin pode gerenciar tipos de documento" 
ON public.tipos_documento FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role));

-- Políticas para documentos emitidos
CREATE POLICY "Alunos podem ver seus documentos" 
ON public.documentos_emitidos FOR SELECT 
USING (aluno_id = auth.uid());

CREATE POLICY "Admin pode gerenciar documentos" 
ON public.documentos_emitidos FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Secretaria pode gerenciar documentos" 
ON public.documentos_emitidos FOR ALL 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- Trigger para updated_at
CREATE TRIGGER update_tipos_documento_updated_at
BEFORE UPDATE ON public.tipos_documento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar número de documento
CREATE OR REPLACE FUNCTION public.gerar_numero_documento()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ano INTEGER;
  sequencial INTEGER;
  numero TEXT;
BEGIN
  ano := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT COALESCE(MAX(CAST(SPLIT_PART(numero_documento, '/', 1) AS INTEGER)), 0) + 1
  INTO sequencial
  FROM public.documentos_emitidos
  WHERE numero_documento LIKE '%/' || ano::TEXT;
  
  numero := LPAD(sequencial::TEXT, 5, '0') || '/' || ano::TEXT;
  RETURN numero;
END;
$$;

-- Inserir tipos de documento padrão
INSERT INTO public.tipos_documento (nome, codigo, descricao, template_html, requer_assinatura, taxa) VALUES
('Declaração de Matrícula', 'DECL_MAT', 'Declara que o aluno está regularmente matriculado na instituição', 
'<h1 style="text-align:center">DECLARAÇÃO DE MATRÍCULA</h1>
<p>Declaramos, para os devidos fins, que <strong>{{nome_aluno}}</strong>, portador(a) do documento de identificação nº <strong>{{numero_identificacao}}</strong>, encontra-se regularmente matriculado(a) nesta instituição de ensino, no curso de <strong>{{nome_curso}}</strong>, turma <strong>{{nome_turma}}</strong>, no período letivo de <strong>{{ano_letivo}}</strong>.</p>
<p>Por ser verdade, firmamos a presente declaração.</p>
<p style="text-align:center;margin-top:50px">{{cidade}}, {{data_extenso}}</p>
<p style="text-align:center;margin-top:80px">_________________________________<br>{{nome_instituicao}}</p>', 
true, 500),

('Declaração de Frequência', 'DECL_FREQ', 'Declara a frequência do aluno às aulas', 
'<h1 style="text-align:center">DECLARAÇÃO DE FREQUÊNCIA</h1>
<p>Declaramos, para os devidos fins, que <strong>{{nome_aluno}}</strong>, portador(a) do documento de identificação nº <strong>{{numero_identificacao}}</strong>, frequenta regularmente as aulas do curso de <strong>{{nome_curso}}</strong>, com carga horária de <strong>{{carga_horaria}}</strong> horas semanais, no horário das <strong>{{horario}}</strong>.</p>
<p>Por ser verdade, firmamos a presente declaração.</p>
<p style="text-align:center;margin-top:50px">{{cidade}}, {{data_extenso}}</p>
<p style="text-align:center;margin-top:80px">_________________________________<br>{{nome_instituicao}}</p>', 
true, 500),

('Histórico Escolar', 'HIST_ESC', 'Documento oficial com o histórico acadêmico completo do aluno', 
'<h1 style="text-align:center">HISTÓRICO ESCOLAR</h1>
<p><strong>Aluno:</strong> {{nome_aluno}}</p>
<p><strong>Documento:</strong> {{numero_identificacao}}</p>
<p><strong>Curso:</strong> {{nome_curso}}</p>
<p><strong>Período:</strong> {{periodo_letivo}}</p>
<div style="margin-top:20px">{{tabela_notas}}</div>
<p style="text-align:center;margin-top:50px">{{cidade}}, {{data_extenso}}</p>
<p style="text-align:center;margin-top:80px">_________________________________<br>{{nome_instituicao}}</p>', 
true, 1000),

('Certificado de Conclusão', 'CERT_CONC', 'Certificado de conclusão de curso', 
'<h1 style="text-align:center">CERTIFICADO DE CONCLUSÃO</h1>
<p style="text-align:center">Certificamos que <strong>{{nome_aluno}}</strong>, portador(a) do documento de identificação nº <strong>{{numero_identificacao}}</strong>, concluiu com êxito o curso de <strong>{{nome_curso}}</strong>, com carga horária total de <strong>{{carga_horaria_total}}</strong> horas, tendo sido aprovado(a) em todas as disciplinas do currículo.</p>
<p style="text-align:center;margin-top:50px">{{cidade}}, {{data_extenso}}</p>
<p style="text-align:center;margin-top:80px">_________________________________<br>{{nome_instituicao}}</p>', 
true, 2000),

('Atestado de Vínculo', 'ATEST_VINC', 'Atesta o vínculo do aluno com a instituição', 
'<h1 style="text-align:center">ATESTADO DE VÍNCULO</h1>
<p>Atestamos, para os devidos fins, que <strong>{{nome_aluno}}</strong>, portador(a) do documento de identificação nº <strong>{{numero_identificacao}}</strong>, mantém vínculo com esta instituição de ensino na qualidade de aluno(a) do curso de <strong>{{nome_curso}}</strong>, desde <strong>{{data_ingresso}}</strong>.</p>
<p>Por ser verdade, firmamos o presente atestado.</p>
<p style="text-align:center;margin-top:50px">{{cidade}}, {{data_extenso}}</p>
<p style="text-align:center;margin-top:80px">_________________________________<br>{{nome_instituicao}}</p>', 
true, 500);