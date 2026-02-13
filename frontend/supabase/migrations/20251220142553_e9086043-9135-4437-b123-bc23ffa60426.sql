-- Insert color configuration entries
INSERT INTO configuracoes_landing (chave, valor, tipo, descricao) VALUES
  ('cor_primaria', '#8B5CF6', 'color', 'Cor primária da landing page'),
  ('cor_primaria_hover', '#7C3AED', 'color', 'Cor primária ao passar o mouse'),
  ('cor_secundaria', '#1E293B', 'color', 'Cor secundária/de fundo escuro'),
  ('cor_accent', '#06B6D4', 'color', 'Cor de destaque/acento'),
  ('cor_texto_hero', '#1E293B', 'color', 'Cor do texto principal do hero'),
  ('cor_fundo_hero', '#F8FAFC', 'color', 'Cor de fundo do hero section'),
  ('gradiente_ativo', 'true', 'boolean', 'Usar gradiente no hero')
ON CONFLICT (chave) DO NOTHING;