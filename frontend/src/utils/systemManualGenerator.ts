import jsPDF from 'jspdf';

interface ManualConfig {
  instituicao: {
    nome: string;
    logoUrl?: string | null;
    tipoInstituicao?: string;
    tipoAcademico?: 'SECUNDARIO' | 'SUPERIOR' | string;
  };
}

export const gerarManualSistemaPDF = async (config: ManualConfig): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;
  let currentPage = 1;
  
  // Detectar modo da instituição: tipo_academico (SECUNDARIO/SUPERIOR) ou tipoInstituicao (ENSINO_MEDIO/UNIVERSIDADE)
  const tipo = (config.instituicao.tipoAcademico ?? config.instituicao.tipoInstituicao ?? '').toUpperCase();
  const isSecundario = tipo === 'SECUNDARIO' || tipo === 'ENSINO_MEDIO';
  const periodoLabel = isSecundario ? 'Trimestre' : 'Semestre';
  const periodosLabel = isSecundario ? 'Trimestres' : 'Semestres';

  const checkNewPage = (neededSpace = 30) => {
    if (yPos > pageHeight - neededSpace) {
      doc.addPage();
      currentPage++;
      yPos = addHeader('Manual do Sistema DSICOLA');
    }
  };

  const addHeader = (title: string) => {
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(config.instituicao.nome, pageWidth / 2, 13, { align: 'center' });
    doc.setFontSize(11);
    doc.text(title, pageWidth / 2, 25, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`Página ${currentPage}`, pageWidth - 15, 32, { align: 'right' });
    return 45;
  };

  const addSectionTitle = (title: string) => {
    checkNewPage(40);
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, yPos);
    yPos += 10;
    doc.setTextColor(0, 0, 0);
  };

  const addSubsectionTitle = (title: string) => {
    checkNewPage(30);
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, yPos);
    yPos += 8;
    doc.setTextColor(0, 0, 0);
  };

  const addParagraph = (text: string) => {
    checkNewPage(30);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 4.5 + 4;
  };

  const addListItem = (item: string, indent = 0) => {
    checkNewPage(15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const bullet = indent > 0 ? '  ○' : '•';
    const lines = doc.splitTextToSize(`${bullet} ${item}`, pageWidth - margin * 2 - indent * 5);
    doc.text(lines, margin + indent * 5, yPos);
    yPos += lines.length * 4.5 + 2;
  };

  const addStep = (stepNum: number, text: string) => {
    checkNewPage(20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text(`Passo ${stepNum}:`, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - 25);
    doc.text(lines, margin + 25, yPos);
    yPos += lines.length * 4.5 + 4;
  };

  const addNote = (text: string) => {
    checkNewPage(25);
    doc.setFillColor(255, 250, 205);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - 10);
    const boxHeight = lines.length * 4.5 + 8;
    doc.rect(margin, yPos - 4, pageWidth - margin * 2, boxHeight, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 80, 0);
    doc.text('💡 ' + lines.join('\n'), margin + 5, yPos);
    yPos += boxHeight + 4;
    doc.setTextColor(0, 0, 0);
  };

  const addModeBox = (modoMedio: string, modoUniversitario: string) => {
    checkNewPage(40);
    doc.setFillColor(240, 249, 255);
    doc.rect(margin, yPos - 4, pageWidth - margin * 2, 32, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('📘 MODO ENSINO MÉDIO:', margin + 5, yPos + 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const linesMedio = doc.splitTextToSize(modoMedio, pageWidth - margin * 2 - 15);
    doc.text(linesMedio, margin + 5, yPos + 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('🎓 MODO UNIVERSITÁRIO:', margin + 5, yPos + 18);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const linesUni = doc.splitTextToSize(modoUniversitario, pageWidth - margin * 2 - 15);
    doc.text(linesUni, margin + 5, yPos + 24);
    yPos += 38;
  };

  // === CAPA ===
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('DSICOLA', pageWidth / 2, 60, { align: 'center' });
  
  doc.setFontSize(18);
  doc.text('Manual Completo do Sistema', pageWidth / 2, 80, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema Integrado de Gestão Acadêmica e Financeira', pageWidth / 2, 100, { align: 'center' });
  
  // Badge de suporte a ambos os modos
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(50, 115, pageWidth - 100, 25, 3, 3, 'F');
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('✓ Suporte a Ensino Médio e Universitário', pageWidth / 2, 125, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Trimestres • Semestres • Classes • Turmas • Cursos', pageWidth / 2, 133, { align: 'center' });
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(config.instituicao.nome, pageWidth / 2, 160, { align: 'center' });
  
  // Linha decorativa
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(60, 175, pageWidth - 60, 175);
  
  doc.setFontSize(10);
  doc.text('Guia Completo de Utilização', pageWidth / 2, 190, { align: 'center' });
  doc.text('Para Super Admin, Administradores, Secretaria, Professores e Alunos', pageWidth / 2, 200, { align: 'center' });
  
  doc.setFontSize(9);
  doc.text(`Versão 3.2 - ${new Date().toLocaleDateString('pt-AO')}`, pageWidth / 2, pageHeight - 20, { align: 'center' });

  // === ÍNDICE ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Índice');
  
  const indice = [
    { num: '1', title: 'Introdução ao Sistema DSICOLA', page: 3 },
    { num: '1.1', title: '  Modos de Operação (Ensino Médio vs Universitário)', page: 3 },
    { num: '2', title: 'Acesso ao Sistema', page: 4 },
    { num: '2.1', title: '  Login e Recuperação de Senha', page: 4 },
    { num: '2.2', title: '  Perfis de Acesso', page: 4 },
    { num: '3', title: 'Ativação e Assinatura', page: 5 },
    { num: '3.1', title: '  Formas de Pagamento', page: 5 },
    { num: '3.2', title: '  Bloqueio e Renovação', page: 6 },
    { num: '4', title: 'Gestão Acadêmica (Admin/Secretaria)', page: 7 },
    { num: '4.1', title: '  Cadastro de Cursos', page: 8 },
    { num: '4.2', title: '  Classes (Ensino Médio)', page: 9 },
    { num: '4.3', title: '  Turmas e Turno', page: 10 },
    { num: '4.4', title: '  Disciplinas por Curso', page: 11 },
    { num: '4.5', title: '  Professores e Atribuições', page: 12 },
    { num: '4.6', title: '  Trimestres e Semestres', page: 13 },
    { num: '5', title: 'Configuração de Ensinos (Fluxo Acadêmico)', page: 14 },
    { num: '5.1', title: '  Calendário Acadêmico', page: 14 },
    { num: '5.2', title: '  Plano de Ensino', page: 15 },
    { num: '5.3', title: '  Distribuição de Aulas', page: 16 },
    { num: '5.4', title: '  Lançamento de Aulas', page: 17 },
    { num: '5.5', title: '  Controle de Presenças', page: 18 },
    { num: '5.6', title: '  Avaliações e Notas', page: 19 },
    { num: '6', title: 'Gestão de Alunos (Admin/Secretaria)', page: 20 },
    { num: '6.1', title: '  Cadastro com Curso Obrigatório', page: 20 },
    { num: '6.2', title: '  Documentos e Matrículas', page: 21 },
    { num: '7', title: 'Pautas e Documentos', page: 22 },
    { num: '7.1', title: '  Layout Profissional das Pautas', page: 22 },
    { num: '7.2', title: '  Exportação PDF e Excel', page: 23 },
    { num: '8', title: 'Comunicação e Relatórios', page: 24 },
    { num: '9', title: 'Estatísticas e Analytics', page: 25 },
    { num: '10', title: 'Configurações Avançadas', page: 26 },
    { num: '11', title: 'Perfil SUPER_ADMIN', page: 27 },
    { num: '12', title: 'Suporte e Segurança', page: 28 },
    { num: '13', title: 'Backup e Recuperação', page: 29 },
    { num: '14', title: 'Guia Prático - Ensino Secundário (Passo a Passo)', page: 30 },
    { num: '15', title: 'Guia Prático - Ensino Superior (Passo a Passo)', page: 32 },
  ];

  doc.setTextColor(0, 0, 0);
  indice.forEach((item) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', item.num.includes('.') ? 'normal' : 'bold');
    doc.text(`${item.num}. ${item.title}`, margin, yPos);
    yPos += item.num.includes('.') ? 5 : 7;
    checkNewPage(12);
  });

  // === ÍNDICE POR PERFIL ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Índice por Perfil de Usuário');
  
  addSubsectionTitle('👑 SUPER_ADMIN');
  addParagraph('Seções relevantes para Super Administradores (área comercial):');
  addListItem('Seção 11: Perfil SUPER_ADMIN - Como Funciona (completo)');
  addListItem('  • 11.3: Fluxo Comercial Completo');
  addListItem('  • 11.4: Criar Instituição (Onboarding)');
  addListItem('  • 11.5: Confirmar Pagamento de Licença');
  addListItem('Seção 3: Ativação e Assinatura');
  addListItem('Seção 12: Suporte e Segurança');
  yPos += 5;

  addSubsectionTitle('🏛️ ADMIN / DIRECAO / COORDENADOR');
  addParagraph('Seções relevantes para Administradores e Coordenadores:');
  addListItem('Seção 3: Ativação e Assinatura');
  addListItem('Seção 4: Gestão Acadêmica');
  addListItem('Seção 5: Configuração de Ensinos (Calendário, Plano de Ensino com controle de versão)');
  addListItem('Seção 6: Gestão de Alunos');
  addListItem('Seção 7: Pautas e Documentos');
  addListItem('Seção 8: Comunicação e Relatórios');
  addListItem('Seção 9: Estatísticas e Analytics');
  addListItem('Seção 10: Configurações Avançadas');
  yPos += 5;

  addSubsectionTitle('👨‍🏫 PROFESSOR');
  addParagraph('Seções relevantes para Professores:');
  addListItem('Seção 2: Acesso ao Sistema');
  addListItem('Seção 5: Configuração de Ensinos (Fluxo Completo)');
  addListItem('  5.3: Plano de Ensino');
  addListItem('  5.4: Distribuição de Aulas');
  addListItem('  5.5: Lançamento de Aulas');
  addListItem('  5.6: Controle de Presenças');
  addListItem('  5.7: Avaliações e Notas');
  yPos += 5;

  addSubsectionTitle('👨‍🎓 ALUNO');
  addParagraph('Seções relevantes para Alunos:');
  addListItem('Seção 2: Acesso ao Sistema');
  addListItem('Seção 6: Gestão de Alunos (consulta de documentos)');
  addListItem('Seção 7: Pautas e Documentos (visualização)');
  addListItem('Seção 8: Comunicação (receber comunicados)');
  yPos += 5;

  addSubsectionTitle('📋 SECRETARIA');
  addParagraph('Seções relevantes para Secretaria:');
  addListItem('Seção 4: Gestão Acadêmica');
  addListItem('Seção 6: Gestão de Alunos');
  addListItem('Seção 7: Pautas e Documentos');
  addListItem('Seção 8: Comunicação e Relatórios');
  addListItem('Seção 9: Estatísticas e Analytics');
  addListItem('Seção 14 ou 15: Guia Prático do seu tipo (Secundário/Superior)');
  yPos += 5;

  addSubsectionTitle('🛠️ EQUIPA DE SUPORTE');
  addParagraph('Para atendimento a clientes, consulte os guias práticos:');
  addListItem('Seção 14: Guia Passo a Passo - Ensino Secundário (7ª-13ª classe, Trimestres)');
  addListItem('Seção 15: Guia Passo a Passo - Ensino Superior (Universidades, Semestres)');
  yPos += 5;

  // === 1. INTRODUÇÃO ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('1. Introdução ao Sistema DSICOLA');
  addParagraph('O DSICOLA é um Sistema Integrado de Gestão Acadêmica e Financeira desenvolvido para instituições de ensino em Angola. O sistema oferece suporte completo tanto para Ensino Médio (escolas secundárias) quanto para Ensino Superior (universidades e institutos).');
  yPos += 3;
  
  addSubsectionTitle('1.1 Suporte a Múltiplas Instituições');
  addParagraph('O DSICOLA opera como plataforma SaaS multi-tenant, onde cada instituição possui seu próprio ambiente isolado com subdomínio personalizado (ex: escola.dsicola.com).');
  yPos += 3;

  addSubsectionTitle('1.2 Modos de Operação');
  addParagraph('O sistema adapta-se automaticamente ao tipo de instituição configurada:');
  yPos += 3;
  
  addModeBox(
    'Organizado por Trimestres (1º, 2º, 3º), Classes (7ª a 13ª), e Cursos técnicos. Notas: Prova + Trabalho = Média.',
    'Organizado por Semestres (1º e 2º), Anos acadêmicos, Disciplinas por cadeira. Sistema de créditos.'
  );

  addSubsectionTitle('1.3 Principais Características');
  addListItem('Interface moderna, intuitiva e responsiva (computadores, tablets, smartphones)');
  addListItem('Sistema baseado em perfis com diferentes níveis de acesso');
  addListItem('Integração completa entre módulos acadêmicos e financeiros');
  addListItem('Geração automática de relatórios, pautas e documentos em PDF/Excel');
  addListItem('Controle automático de inadimplência com bloqueio/reativação');
  addListItem('Sistema de alertas e notificações em tempo real');
  addListItem('Logs de auditoria para rastreamento de todas as ações');

  // === 2. ACESSO AO SISTEMA ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('2. Acesso ao Sistema');
  
  addSubsectionTitle('2.1 Como Fazer Login');
  addStep(1, 'Abra o navegador e acesse o endereço da sua instituição (ex: escola.dsicola.com).');
  addStep(2, 'Na tela de login, insira seu email cadastrado.');
  addStep(3, 'Digite sua senha.');
  addStep(4, 'Clique no botão "Entrar".');
  addStep(5, 'Você será redirecionado automaticamente para o painel do seu perfil.');
  yPos += 3;

  addSubsectionTitle('2.2 Recuperação de Senha');
  addParagraph('Se esqueceu sua senha:');
  addStep(1, 'Na tela de login, clique em "Esqueceu a senha?".');
  addStep(2, 'Informe seu email cadastrado.');
  addStep(3, 'Um link de recuperação será enviado ao seu email.');
  addStep(4, 'Clique no link e defina uma nova senha.');
  yPos += 3;
  
  addNote('Se não receber o email, verifique a pasta de spam ou contate o administrador do sistema.');
  yPos += 5;

  addSubsectionTitle('2.3 Perfis de Acesso');
  addParagraph('O sistema possui 7 perfis de usuário principais:');
  addListItem('SUPER_ADMIN: Gerencia a plataforma e todas as instituições');
  addListItem('ADMIN (Administrador): Acesso total a todos os módulos da instituição');
  addListItem('COORDENADOR: Coordenação acadêmica; pode aprovar planos e criar novas versões (padrão SIGAE)');
  addListItem('SECRETARIA: Gestão financeira, matrículas e documentos');
  addListItem('PROFESSOR: Gestão de notas e frequência das turmas atribuídas');
  addListItem('ALUNO: Consulta do próprio histórico acadêmico e financeiro');
  addListItem('RESPONSÁVEL: Acompanhamento dos alunos vinculados (filhos)');

  // === 3. ATIVAÇÃO E ASSINATURA ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('3. Ativação e Assinatura');
  addParagraph('O DSICOLA opera com modelo de assinatura. Cada instituição deve manter sua assinatura ativa para uso contínuo do sistema.');
  yPos += 5;

  addSubsectionTitle('3.1 Ativar Conta Institucional');
  addStep(1, 'Após cadastro, o Super Admin cria a instituição e define o plano.');
  addStep(2, 'O administrador da instituição recebe credenciais por email.');
  addStep(3, 'Ao fazer login, se houver pendência financeira, aparecerá aviso de assinatura.');
  addStep(4, 'A instituição deve efetuar o pagamento conforme instruções.');
  addStep(5, 'Após validação pelo Super Admin, o acesso é liberado.');
  yPos += 5;

  addSubsectionTitle('3.2 Formas de Pagamento');
  addParagraph('O sistema aceita os seguintes métodos:');
  addListItem('Multicaixa Express: Transferência via número de telefone');
  addListItem('IBAN/Transferência Bancária: Depósito em conta bancária');
  addListItem('Envio de Comprovativo: Upload manual do comprovativo de pagamento');
  yPos += 5;

  addSubsectionTitle('3.3 Enviar Comprovativo de Pagamento');
  addStep(1, 'No painel de assinatura, clique em "Enviar Comprovativo".');
  addStep(2, 'Selecione a forma de pagamento utilizada.');
  addStep(3, 'Informe o telefone de contato para confirmação.');
  addStep(4, 'Faça upload da imagem ou PDF do comprovativo.');
  addStep(5, 'Adicione uma descrição opcional.');
  addStep(6, 'Clique em "Enviar".');
  addStep(7, 'Aguarde a análise pelo Super Admin (prazo: até 48h úteis).');
  yPos += 3;

  addNote('O sistema exibe contagem regressiva até o vencimento e alerta quando a assinatura está prestes a expirar.');

  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');

  addSubsectionTitle('3.4 Bloqueio Automático');
  addParagraph('Caso a assinatura não seja renovada:');
  addListItem('Após X dias do vencimento, o sistema entra em modo de "Análise"');
  addListItem('Durante a análise, o acesso permanece parcial');
  addListItem('Após período de carência, o sistema é bloqueado');
  addListItem('Usuários verão tela de "Assinatura Expirada" ao tentar acessar');
  addListItem('Para desbloquear, é necessário regularizar o pagamento');
  yPos += 5;

  addSubsectionTitle('3.5 Fluxo de Validação pelo Super Admin');
  addParagraph('O Super Admin valida os pagamentos:');
  addStep(1, 'Super Admin acessa a aba "Assinaturas" no painel.');
  addStep(2, 'Visualiza comprovativo enviado pela instituição.');
  addStep(3, 'Verifica autenticidade e valor do pagamento.');
  addStep(4, 'Se válido: Aprova e define nova data de vencimento.');
  addStep(5, 'Se inválido: Rejeita e notifica a instituição.');
  addStep(6, 'A instituição é notificada automaticamente sobre o resultado.');

  // === 4. GESTÃO ACADÊMICA ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('4. Gestão Acadêmica');
  addParagraph('O módulo de gestão acadêmica é o coração do sistema, permitindo configurar toda a estrutura curricular da instituição.');
  yPos += 5;

  addSubsectionTitle('4.1 Estrutura Acadêmica');
  addParagraph('A estrutura acadêmica varia conforme o modo da instituição:');
  yPos += 3;

  addModeBox(
    'Curso → Classe (7ª-13ª) → Turma → Disciplinas → Trimestres',
    'Curso → Ano → Semestre → Turma → Disciplinas'
  );

  addSubsectionTitle('4.2 Cadastro de Cursos (Obrigatório)');
  addParagraph('Os cursos são a base da estrutura. Exemplos: Enfermagem, Ciências Humanas, Informática.');
  addStep(1, 'Acesse "Gestão Acadêmica" > aba "Cursos".');
  addStep(2, 'Clique em "Novo Curso".');
  addStep(3, 'Preencha: Nome do Curso, Código, Carga Horária, Valor da Mensalidade.');
  addStep(4, 'Adicione descrição opcional.');
  addStep(5, 'Clique em "Salvar".');
  yPos += 3;

  addNote('Cada turma e disciplina deve estar vinculada a um curso. A mensalidade do curso é usada como base para cálculos financeiros.');

  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');

  addSubsectionTitle('4.3 Classes (Específico Ensino Médio)');
  addParagraph('No modo Ensino Médio, as classes representam os anos escolares:');
  addListItem('7ª Classe a 9ª Classe: Ensino Fundamental II');
  addListItem('10ª Classe a 12ª Classe: Ensino Médio');
  addListItem('13ª Classe: Preparatório (opcional)');
  yPos += 3;

  addParagraph('▶ Gerenciar Classes:');
  addStep(1, 'Acesse "Gestão Acadêmica" > aba "Classes".');
  addStep(2, 'Visualize as classes disponíveis por curso.');
  addStep(3, 'Cada classe pode ter múltiplas turmas (ex: 10ª A, 10ª B).');
  yPos += 5;

  addSubsectionTitle('4.4 Turmas e Turnos');
  addParagraph('Turmas representam grupos de alunos que estudam juntos no mesmo período.');
  addStep(1, 'Acesse "Gestão Acadêmica" > aba "Turmas".');
  addStep(2, 'Clique em "Nova Turma".');
  addStep(3, 'Preencha: Nome da Turma (ex: "10ª A - Informática 2025").');
  addStep(4, 'Selecione o Curso correspondente.');
  addStep(5, 'Selecione o Professor responsável.');
  addStep(6, `Defina o Ano Letivo e ${periodoLabel}.`);
  addStep(7, 'Selecione o Turno: Manhã, Tarde ou Noite.');
  addStep(8, 'Opcionalmente, informe Sala e Horário.');
  addStep(9, 'Clique em "Salvar".');

  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');

  addSubsectionTitle('4.5 Disciplinas por Curso');
  addParagraph('Disciplinas são componentes curriculares. Cada curso pode ter disciplinas diferentes.');
  yPos += 3;

  addParagraph('▶ Exemplo de Diferenciação:');
  addListItem('Alunos de "Informática" têm: Programação, Redes, Banco de Dados');
  addListItem('Alunos de "Ciências Humanas" têm: Filosofia, Sociologia, História');
  addListItem('Ambos podem ter: Português, Matemática (disciplinas comuns)');
  yPos += 3;

  addParagraph('▶ Cadastrar Disciplina:');
  addStep(1, 'Acesse "Gestão Acadêmica" > aba "Disciplinas".');
  addStep(2, 'Clique em "Nova Disciplina".');
  addStep(3, 'Selecione o Curso ao qual pertence.');
  addStep(4, `Preencha Nome, ${periodoLabel} (1º, 2º, 3º) e Carga Horária.`);
  addStep(5, 'Marque se é obrigatória ou opcional.');
  addStep(6, 'Clique em "Salvar".');
  yPos += 5;

  addSubsectionTitle('4.6 Atribuição de Professores');
  addParagraph('Professores devem ser vinculados às disciplinas que lecionam:');
  addStep(1, 'Acesse "Gestão Acadêmica" > aba "Atribuição de Disciplinas".');
  addStep(2, 'Clique em "Nova Atribuição".');
  addStep(3, `Selecione Professor, Disciplina, Ano e ${periodoLabel}.`);
  addStep(4, 'Clique em "Salvar".');
  yPos += 3;

  addNote('Professores só podem ver alunos e lançar notas nas turmas onde estão atribuídos. Esta validação garante segurança dos dados.');

  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');

  addSubsectionTitle(`4.7 ${periodosLabel} e Períodos Letivos`);
  addParagraph(`O sistema organiza o ano letivo em ${periodosLabel.toLowerCase()}:`);
  yPos += 3;

  addModeBox(
    '1º Trimestre (Fev-Abr) • 2º Trimestre (Mai-Jul) • 3º Trimestre (Ago-Nov) + Recursos',
    '1º Semestre (Fev-Jun) • 2º Semestre (Ago-Dez) + Exames Especiais'
  );

  addParagraph('▶ Fechamento de Período:');
  addStep(1, 'Ao final de cada período, o admin pode "Fechar" o período.');
  addStep(2, 'Períodos fechados impedem alterações de notas por professores.');
  addStep(3, 'Apenas admins podem reabrir períodos para correções.');

  // === 5. CONFIGURAÇÃO DE ENSINOS ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('5. Configuração de Ensinos - Fluxo Acadêmico Completo');
  addParagraph('O módulo "Configuração de Ensinos" gerencia todo o fluxo académico do início ao fim. É obrigatório seguir a ordem das etapas, pois o sistema bloqueia automaticamente etapas seguintes até que as anteriores sejam concluídas.');
  yPos += 5;

  addNote('⚠️ IMPORTANTE: O sistema bloqueia etapas seguintes até que as anteriores sejam concluídas. Esta ordem NÃO pode ser alterada.');
  yPos += 5;

  addSubsectionTitle('5.1 Ordem Obrigatória do Fluxo');
  addParagraph('O fluxo académico segue esta sequência obrigatória:');
  yPos += 3;
  addListItem('1️⃣ Calendário Acadêmico → Define dias letivos, feriados e períodos');
  addListItem('2️⃣ Plano de Ensino → Define conteúdos, aulas e trimestres');
  addListItem('3️⃣ Distribuição de Aulas → Gera automaticamente as datas das aulas');
  addListItem('4️⃣ Lançamento de Aulas → Marca aulas como ministradas');
  addListItem('5️⃣ Controle de Presenças → Registra presença dos alunos');
  addListItem('6️⃣ Avaliações e Notas → Lança avaliações e notas');
  yPos += 3;

  addSubsectionTitle('5.2 Calendário Acadêmico (Admin/Direção)');
  addParagraph('O calendário é a base de todo o sistema académico. Deve ser configurado PRIMEIRO antes de qualquer outro módulo.');
  yPos += 3;
  
  addParagraph('▶ Como Configurar o Calendário:');
  addStep(1, 'Acesse "Configuração de Ensinos" > aba "Calendário Acadêmico".');
  addStep(2, 'Clique em "Novo Evento".');
  addStep(3, 'Preencha: Título (obrigatório), Data Início (obrigatória), Data Fim (opcional).');
  addStep(4, 'Selecione o Tipo: Feriado, Férias, Prova/Exame, Reunião, Evento, etc.');
  addStep(5, 'Adicione Hora e Descrição se necessário.');
  addStep(6, 'Clique em "Criar".');
  yPos += 3;

  addNote('Feriados e períodos de férias são automaticamente ignorados na distribuição automática de aulas. Configure todos os feriados do ano letivo.');
  yPos += 5;

  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');

  addSubsectionTitle('5.3 Plano de Ensino (Professor/Admin/Coordenador)');
  addParagraph('O plano de ensino define O QUE será ensinado, QUANTAS aulas cada tópico terá, e em QUAL trimestre. O sistema possui controle de versão (padrão SIGAE): cada plano aprovado pode gerar uma nova versão para alterações.');
  yPos += 3;

  addParagraph('▶ Como Criar um Plano de Ensino:');
  addStep(1, 'Acesse "Configuração de Ensinos" > aba "Plano de Ensino" (só aparece se calendário estiver configurado).');
  addStep(2, 'Preencha o contexto: Curso/Classe, Disciplina, Professor, Ano Letivo, Turma (opcional).');
  addStep(3, 'Siga as 5 etapas do plano:');
  yPos += 3;
  addListItem('  1. Apresentação: Dados gerais, objetivos, metodologia');
  addListItem('  2. Planejar: Adicione cada aula do plano');
  addListItem('  3. Executar: Visualize o plano completo');
  addListItem('  4. Gerenciar: Edite, remova ou reordene aulas');
  addListItem('  5. Finalizar: Submeta para aprovação; ADMIN/COORDENADOR podem aprovar');
  yPos += 3;
  
  addParagraph('▶ Controle de Versão (SIGAE):');
  addStep(1, 'Após aprovação, o plano fica bloqueado para edição direta.');
  addStep(2, 'Para alterar: ADMIN ou COORDENADOR clicam em "Criar nova versão" na aba Finalizar.');
  addStep(3, 'O sistema cria um novo plano em RASCUNHO (v2, v3...) vinculado ao anterior.');
  addStep(4, 'Edite o novo plano e submeta novamente para aprovação.');
  yPos += 3;
  
  addParagraph('▶ Adicionar Aulas:');
  addStep(1, 'Na tab "2. Planejar", clique em "Nova Aula".');
  addStep(2, 'Preencha: Título, Descrição, Tipo (Teórica/Prática).');
  addStep(3, `Selecione o Trimestre (1º, 2º ou 3º).`);
  addStep(4, 'Informe a Quantidade de Aulas para este tópico.');
  addStep(5, 'Clique em "Salvar".');
  yPos += 3;

  addNote('Após criar todas as aulas, o plano fica disponível para distribuição. Verifique se a carga horária total está correta.');
  yPos += 5;

  addSubsectionTitle('5.4 Distribuição Automática de Aulas (Professor)');
  addParagraph('A distribuição gera automaticamente as DATAS para cada aula do plano, respeitando o calendário académico. Se o Horário (Gestão Acadêmica → Horários) estiver cadastrado para o plano, os dias da semana são obtidos automaticamente do Horário (fonte oficial).');
  yPos += 3;

  addParagraph('▶ Como Gerar Distribuição:');
  addStep(1, 'Acesse "Configuração de Ensinos" > aba "Distribuição de Aulas" (só aparece se plano estiver criado).');
  addStep(2, 'Selecione o mesmo contexto do Plano de Ensino.');
  addStep(3, 'Configure: Data de Início (primeira data de aula).');
  addStep(4, 'Dias da Semana: Se houver Horário cadastrado, os dias vêm automaticamente. Caso contrário, selecione manualmente (ex: Segunda, Quarta, Sexta).');
  addStep(5, 'Clique em "Gerar Distribuição Automática".');
  addStep(6, 'O sistema calcula automaticamente, ignorando feriados e férias.');
  yPos += 3;

  addNote('Se alterar o Horário após gerar a distribuição, o sistema exibirá aviso de divergência. Use "Re-gerar Distribuição" para sincronizar.');
  yPos += 5;

  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');

  addSubsectionTitle('5.5 Lançamento de Aulas (Professor)');
  addParagraph('Após distribuir as aulas, você precisa marcar cada aula como "Ministrada" quando ela realmente acontecer.');
  yPos += 3;

  addParagraph('▶ Como Lançar uma Aula:');
  addStep(1, 'Acesse "Configuração de Ensinos" > aba "Lançamento de Aulas" (só aparece se aulas estiverem distribuídas).');
  addStep(2, 'Selecione o contexto: Disciplina, Professor, Ano Letivo.');
  addStep(3, 'Visualize a lista de aulas planejadas com suas datas.');
  addStep(4, 'Clique em "Lançar Aula" na aula que deseja registrar.');
  addStep(5, 'Informe a Data real da aula (pode ser diferente da planejada).');
  addStep(6, 'Adicione Observações se necessário (ex: "Conteúdo revisado", "Aula remarcada").');
  addStep(7, 'Clique em "Confirmar Lançamento".');
  yPos += 3;

  addNote('A aula só pode ter presenças registradas depois de ser lançada como "Ministrada". Você pode lançar múltiplas aulas para o mesmo tópico se necessário.');
  yPos += 5;

  addSubsectionTitle('5.6 Controle de Presenças (Professor)');
  addParagraph('Após lançar a aula como ministrada, registre as presenças dos alunos.');
  yPos += 3;

  addParagraph('▶ Como Registrar Presenças:');
  addStep(1, 'Acesse "Configuração de Ensinos" > aba "Controle de Presenças" (só aparece se aulas estiverem lançadas).');
  addStep(2, 'Selecione o contexto e a Aula lançada que deseja registrar.');
  addStep(3, 'Visualize a lista de alunos matriculados na turma.');
  addStep(4, 'Para cada aluno, selecione: Presente, Ausente ou Justificado.');
  addStep(5, 'Adicione observações se necessário (ex: motivo da falta).');
  addStep(6, 'Clique em "Salvar Presenças".');
  yPos += 3;

  addNote('O sistema calcula automaticamente a frequência de cada aluno. Alunos com frequência abaixo de 75% são bloqueados para receber notas.');
  yPos += 5;

  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');

  addSubsectionTitle('5.7 Avaliações e Notas (Professor)');
  addParagraph('No final, crie avaliações e lance as notas dos alunos que cumpriram a frequência mínima.');
  yPos += 3;

  addParagraph('▶ Como Criar uma Avaliação:');
  addStep(1, 'Acesse "Configuração de Ensinos" > aba "Avaliações e Notas" > tab "Avaliações".');
  addStep(2, 'Selecione o contexto: Disciplina, Professor, Ano Letivo.');
  addStep(3, 'Clique em "Nova Avaliação".');
  addStep(4, 'Preencha: Tipo (Prova, Teste, Trabalho), Trimestre, Data, Peso.');
  addStep(5, 'Adicione Nome e Descrição (opcional).');
  addStep(6, 'Clique em "Criar".');
  yPos += 3;

  addParagraph('▶ Como Lançar Notas:');
  addStep(1, 'Na tab "Lançamento de Notas", selecione a avaliação desejada.');
  addStep(2, 'Clique em "Lançar Notas".');
  addStep(3, 'Visualize a lista de alunos com frequência calculada.');
  addStep(4, 'Alunos com frequência insuficiente (<75%) estarão bloqueados.');
  addStep(5, 'Para cada aluno elegível, digite a Nota (0 a 20).');
  addStep(6, 'Adicione observações se necessário.');
  addStep(7, 'Clique em "Salvar Notas".');
  yPos += 3;

  addNote('O sistema verifica automaticamente se o aluno tem frequência mínima (75%). Alunos bloqueados não podem receber notas até regularizarem a frequência.');
  yPos += 5;

  addSubsectionTitle('5.8 Resumo do Fluxo para o Professor');
  addParagraph('Fluxo diário durante o ano letivo:');
  addListItem('No início do ano: Direção configura Calendário → Você cria Plano → Você distribui datas');
  addListItem('Semanalmente: Você ministra aula → Lança como "Ministrada" → Registra presenças');
  addListItem('Quando tem avaliação: Cria avaliação → Lança notas dos alunos elegíveis');
  yPos += 3;

  addNote('O sistema lembra seu contexto entre as abas, facilitando o trabalho. Se uma aba estiver bloqueada, verifique se concluiu as etapas anteriores.');
  
  // === 6. GESTÃO DE ALUNOS ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('6. Gestão de Alunos');
  
  addSubsectionTitle('6.1 Cadastro de Aluno (Curso Obrigatório)');
  addParagraph('Ao cadastrar um aluno, é obrigatório selecionar o curso de matrícula.');
  addStep(1, 'Acesse "Gestão de Alunos" > clique em "Novo Aluno".');
  addStep(2, 'Preencha dados obrigatórios: Email, Nome Completo, BI.');
  addStep(3, 'Informe: Data de Nascimento, Gênero, Telefone.');
  addStep(4, 'Preencha nomes do Pai e Mãe.');
  addStep(5, 'Informe endereço: Morada, Cidade, País.');
  addStep(6, 'OBRIGATÓRIO: Selecione o Curso de matrícula.');
  addStep(7, 'Selecione a Turma para matrícula inicial.');
  addStep(8, 'Opcionalmente, faça upload de foto.');
  addStep(9, 'Clique em "Cadastrar Aluno".');
  yPos += 3;

  addNote('Uma senha temporária será enviada por email. O aluno poderá acessar o sistema com essas credenciais.');
  yPos += 5;

  addSubsectionTitle('6.2 Documentos do Aluno');
  addParagraph('O sistema permite upload e gestão de documentos:');
  addListItem('Bilhete de Identidade (BI)');
  addListItem('Certificado de Habilitações');
  addListItem('Atestado Médico');
  addListItem('Comprovativo de Residência');
  addListItem('Outros documentos relevantes');
  yPos += 3;

  addParagraph('▶ Upload de Documento:');
  addStep(1, 'Acesse "Documentos de Alunos" no menu.');
  addStep(2, 'Selecione o aluno.');
  addStep(3, 'Clique em "Novo Documento".');
  addStep(4, 'Selecione o tipo e faça upload do arquivo.');
  addStep(5, 'Clique em "Salvar".');

  // === 7. PAUTAS E DOCUMENTOS ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('7. Pautas e Documentos');
  
  addSubsectionTitle('7.1 Layout Profissional das Pautas');
  addParagraph('As pautas são geradas com layout profissional contendo:');
  yPos += 3;

  addListItem('Cabeçalho: Nome da Instituição, Logo, Ano Letivo');
  addListItem('Identificação: Curso, Turma, Classe, Turno');
  addListItem(`Período: ${periodoLabel} ou Ano completo`);
  addListItem('Tabela de Notas: Aluno, Notas por avaliação, Média, Estado');
  addListItem('Resumo: Total de alunos, Aprovados, Reprovados, Em Recurso');
  addListItem('Rodapé: Data de emissão, Assinaturas');
  yPos += 3;

  addModeBox(
    'Pauta sem campo BI. Colunas: Nome, P1, T1, P2, T2, P3, T3, Média, Estado',
    'Pauta com campo de matrícula. Colunas: Nome, P1, P2, Exame, Recurso, Média, Estado'
  );

  addSubsectionTitle('7.2 Gerar Pauta');
  addStep(1, 'Acesse "Gestão Acadêmica" > aba "Pautas".');
  addStep(2, 'Selecione Ano Letivo e Turma.');
  addStep(3, `Selecione o ${periodoLabel} (ou "Anual" para pauta completa).`);
  addStep(4, 'Clique em "Gerar Pauta".');
  addStep(5, 'Visualize o resumo com estatísticas.');
  addStep(6, 'Clique em "Exportar PDF" ou "Exportar Excel".');
  yPos += 5;

  addSubsectionTitle('7.3 Outros Documentos');
  addParagraph('O sistema gera diversos documentos oficiais:');
  addListItem('Declaração de Matrícula');
  addListItem('Histórico Escolar');
  addListItem('Certificado de Conclusão');
  addListItem('Boletim Individual');
  addListItem('Recibos de Pagamento');

  // === 8. COMUNICAÇÃO E RELATÓRIOS ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('8. Comunicação e Relatórios');
  
  addSubsectionTitle('8.1 Comunicados');
  addParagraph('Administradores podem publicar comunicados:');
  addStep(1, 'Acesse "Comunicados" no menu.');
  addStep(2, 'Clique em "Novo Comunicado".');
  addStep(3, 'Preencha Título e Conteúdo.');
  addStep(4, 'Selecione Tipo: Geral, Acadêmico, Financeiro, Urgente.');
  addStep(5, 'Selecione Destinatários: Todos, Alunos, Professores, etc.');
  addStep(6, 'Clique em "Publicar".');
  yPos += 5;

  addSubsectionTitle('8.2 Emails Automáticos');
  addParagraph('O sistema envia emails automáticos para:');
  addListItem('Boas-vindas: Credenciais de acesso para novos usuários');
  addListItem('Lembrete de Propina: Mensalidades próximas do vencimento');
  addListItem('Alerta de Inadimplência: Mensalidades em atraso');
  addListItem('Aviso de Recurso: Alunos que podem fazer recuperação');
  addListItem('Notificação de Notas: Quando novas notas são lançadas');
  yPos += 5;

  addSubsectionTitle('8.3 Logs de Auditoria');
  addParagraph('Todas as ações importantes são registradas:');
  addListItem('Login/Logout de usuários');
  addListItem('Cadastros, edições e exclusões');
  addListItem('Lançamento e alteração de notas');
  addListItem('Pagamentos registrados');
  addListItem('Alterações de configuração');

  // === 9. ESTATÍSTICAS ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('9. Estatísticas e Analytics');
  
  addSubsectionTitle('9.1 Indicadores Acadêmicos');
  addListItem('Total de Alunos ativos por curso/turma');
  addListItem('Taxa de Aprovação por turma e disciplina');
  addListItem('Média geral de notas');
  addListItem('Alunos em recuperação por período');
  addListItem('Frequência média por turma');
  yPos += 5;

  addSubsectionTitle('9.2 Indicadores Financeiros');
  addListItem('Total de mensalidades a receber');
  addListItem('Total recebido no mês/ano');
  addListItem('Taxa de inadimplência');
  addListItem('Evolução da arrecadação (gráfico)');
  addListItem('Previsão de receita');
  yPos += 5;

  addSubsectionTitle('9.3 Relatórios Disponíveis');
  addParagraph('Todos os relatórios podem ser exportados em PDF ou Excel:');
  addListItem('Relatório de Alunos por turma/curso');
  addListItem('Relatório Financeiro mensal/anual');
  addListItem('Relatório de Aprovação/Reprovação');
  addListItem('Relatório de Frequência');
  addListItem('Relatório de Mensalidades em atraso');

  // === 10. CONFIGURAÇÕES ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('10. Configurações Avançadas');
  
  addSubsectionTitle('10.1 Dados Institucionais');
  addParagraph('Personalize os dados da instituição:');
  addListItem('Nome da Instituição');
  addListItem('Logo (aparece em documentos e sistema)');
  addListItem('Imagem de Capa da tela de login');
  addListItem('Endereço completo');
  addListItem('Telefone e Email de contato');
  addListItem('IBAN para pagamentos');
  addListItem('Cor primária do tema');
  yPos += 5;

  addSubsectionTitle('10.2 Tipo de Instituição');
  addParagraph('O tipo define o modo de operação:');
  addListItem('Ensino Médio: Trimestres, Classes, formato específico de notas');
  addListItem('Universitário: Semestres, Anos, sistema de créditos');
  yPos += 3;

  addNote('A alteração do tipo de instituição deve ser feita com cuidado, pois afeta toda a estrutura de avaliações.');
  yPos += 5;

  addSubsectionTitle('10.3 Configuração de Assinatura');
  addParagraph('Super Admin define parâmetros:');
  addListItem('Dias de carência antes do bloqueio');
  addListItem('Dias de antecedência para lembrete');
  addListItem('Instruções de pagamento');
  addListItem('Dados bancários (IBAN, Multicaixa)');

  // === 11. SUPER ADMIN ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('11. Perfil SUPER_ADMIN - Como Funciona');
  addParagraph('O Super Admin (área comercial) gerencia toda a plataforma DSICOLA: uma única plataforma servindo várias instituições ao mesmo tempo. Cada instituição possui seu próprio subdomínio (ex: escola.dsicola.com) e ambiente isolado.');
  yPos += 5;

  addSubsectionTitle('11.1 Acesso ao Painel Super Admin');
  addParagraph('Acesse via app.dsicola.com ou domínio principal. Faça login com credenciais de SUPER_ADMIN. O painel exibe abas horizontais para cada área de gestão.');
  yPos += 5;

  addSubsectionTitle('11.2 Abas do Painel Super Admin');
  addParagraph('O painel contém as seguintes abas (tabs):');
  addListItem('Leads: Contatos recebidos do formulário da landing page de vendas');
  addListItem('Onboarding: Cadastro de novas instituições e administrador inicial');
  addListItem('Instituições: Lista e gestão de todas as instituições cadastradas');
  addListItem('Planos: Configuração de planos (BASIC, PRO, ENTERPRISE) e preços');
  addListItem('Assinaturas: Visualizar e editar assinaturas das instituições');
  addListItem('Pagamentos: Confirmar pagamentos de licença (transferência bancária)');
  addListItem('Landing: Configurar página de vendas e textos comerciais');
  addListItem('Super Admins: Gerenciar outros usuários SUPER_ADMIN');
  addListItem('Admins Instituições: Ver administradores de cada instituição');
  addListItem('Estatísticas: Dashboards e métricas globais');
  addListItem('Backup: Gerar e restaurar backups da plataforma');
  addListItem('Segurança: Logs de auditoria e monitoramento');
  addListItem('Videoaulas: Criar tutoriais para admin e professores');
  yPos += 5;

  addSubsectionTitle('11.3 Fluxo Comercial Completo (Passo a Passo)');
  addParagraph('Este é o fluxo desde o primeiro contato até a instituição utilizar o sistema:');
  yPos += 3;
  addStep(1, 'Lead: O interessado preenche o formulário na landing page. O lead aparece na aba "Leads" com status "Novo".');
  addStep(2, 'Comercial: A área comercial entra em contato, negocia e atualiza status do lead para "Em Contato".');
  addStep(3, 'Contrato Fechado: Quando fechar o contrato, marque o lead como "Convertido".');
  addStep(4, 'Criar Instituição: Na aba "Onboarding" ou a partir do lead convertido (botão "Criar Instituição a partir do Lead"), preencha os dados da instituição e do administrador. A instituição é criada e recebe email de boas-vindas com URL de acesso e credenciais.');
  addStep(5, 'Pagamento: A instituição efetua o pagamento via transferência bancária e cria um pagamento PENDING na aba de assinatura (ou o admin cria).');
  addStep(6, 'Confirmar Pagamento: Na aba "Pagamentos", localize o pagamento PENDING e clique em "Confirmar". O sistema renova a licença automaticamente e envia email ASSINATURA_ATIVADA com instruções de acesso.');
  addStep(7, 'Instituição Ativa: A instituição acessa via seu subdomínio (ex: subdominio.dsicola.com/auth) e utiliza o sistema normalmente.');
  yPos += 5;

  addSubsectionTitle('11.4 Criar Nova Instituição (Onboarding)');
  addParagraph('Acesse a aba "Onboarding" e preencha o formulário:');
  addStep(1, 'Dados da Instituição: Nome, Subdomínio (ex: escola → escola.dsicola.com), Tipo (Secundário/Superior), Email de contato, Telefone, Endereço.');
  addStep(2, 'Dados do Administrador: Nome completo, Email, Senha (ou clique "Gerar senha").');
  addStep(3, 'Plano: Selecione o plano inicial (a instituição precisa ter assinatura para criar pagamentos).');
  addStep(4, 'Opções: Marque "Iniciar período de teste" se aplicável e "Enviar email de boas-vindas".');
  addStep(5, 'Clique em "Iniciar Onboarding". A instituição é criada e o admin recebe email com URL e credenciais.');
  yPos += 3;
  addNote('Se o lead está convertido, use "Criar Instituição a partir do Lead" no diálogo de detalhes do lead. O formulário será preenchido automaticamente com os dados do lead.');
  yPos += 5;

  addSubsectionTitle('11.5 Confirmar Pagamento de Licença');
  addParagraph('Os pagamentos manuais (transferência, depósito) são confirmados pelo Super Admin:');
  addStep(1, 'Acesse a aba "Pagamentos".');
  addStep(2, 'Localize o pagamento com status "Pendente" (PENDING).');
  addStep(3, 'Verifique que o comprovativo ou transferência foi recebido.');
  addStep(4, 'Clique em "Confirmar" no pagamento.');
  addStep(5, 'O sistema renova a licença automaticamente e envia email com instruções de acesso à instituição.');
  yPos += 3;
  addNote('Após confirmar, a instituição recebe email ASSINATURA_ATIVADA com a URL de login (https://subdominio.dsicola.com/auth) e a mensagem "Pronto para utilizar".');
  yPos += 5;

  addSubsectionTitle('11.6 Gestão de Leads');
  addParagraph('Na aba "Leads", filtre por status (Novo, Em Contato, Convertido, Perdido). Atualize status e notas. Para leads convertidos, use "Criar Instituição a partir do Lead" para abrir o onboarding já preenchido.');
  yPos += 5;

  addSubsectionTitle('11.7 Gestão de Planos e Assinaturas');
  addParagraph('Planos definem os níveis de serviço (ex: BASIC, PRO). Cada instituição tem uma assinatura vinculada a um plano. Em "Assinaturas" você pode alterar plano, datas de vencimento e status. Em "Planos" configure preços por período (Mensal/Anual) e tipo de instituição (Secundário/Superior).');
  yPos += 5;

  addSubsectionTitle('11.8 Pagamento e Gateways');
  addParagraph('Por padrão, o pagamento é manual (transferência bancária). O sistema está preparado para integração futura com gateways angolanos (Multicaixa, Paymente) e internacionais (Stripe, PayPal). A confirmação manual segue o fluxo: Instituição cria PENDING → Comercial confirma → Licença renovada e email enviado.');

  // === 12. SUPORTE E SEGURANÇA ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('12. Suporte e Segurança');
  
  addSubsectionTitle('12.1 Canal de Contato');
  addParagraph('Em caso de problemas ou dúvidas:');
  addListItem('Email: suporte@dsicola.com');
  addListItem('Whatsapp: +244 XXX XXX XXX');
  addListItem('Horário: Segunda a Sexta, 8h às 18h');
  yPos += 5;

  addSubsectionTitle('12.2 Boas Práticas de Segurança');
  addListItem('Nunca compartilhe suas credenciais');
  addListItem('Altere sua senha regularmente');
  addListItem('Use senhas fortes (mínimo 8 caracteres, letras e números)');
  addListItem('Faça logout ao terminar de usar');
  addListItem('Não acesse de computadores públicos');
  yPos += 5;

  addSubsectionTitle('12.3 Privacidade de Dados');
  addParagraph('O DSICOLA segue práticas de proteção de dados:');
  addListItem('Dados são armazenados de forma criptografada');
  addListItem('Acesso controlado por perfis e permissões');
  addListItem('Logs de auditoria registram todas as ações');
  addListItem('Backups automáticos diários');
  addListItem('Isolamento de dados entre instituições (multi-tenant)');

  // === 13. BACKUP ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('13. Backup e Recuperação de Dados');
  
  addSubsectionTitle('13.1 Backup Manual');
  addStep(1, 'Acesse "Backup" no menu (Admin).');
  addStep(2, 'Clique em "Gerar Backup Agora".');
  addStep(3, 'Selecione o tipo: Completo ou Parcial.');
  addStep(4, 'Aguarde a geração.');
  addStep(5, 'Faça download do arquivo.');
  yPos += 5;

  addSubsectionTitle('13.2 Backup Automático');
  addParagraph('Configure backups agendados:');
  addStep(1, 'Na aba "Agendamentos", clique em "Novo".');
  addStep(2, 'Selecione frequência: Diário, Semanal ou Mensal.');
  addStep(3, 'Defina hora de execução (recomendado: madrugada).');
  addStep(4, 'Ative e salve.');
  yPos += 5;

  addSubsectionTitle('13.3 Restauração');
  addParagraph('Em caso de necessidade:');
  addStep(1, 'Localize o backup no histórico.');
  addStep(2, 'Clique em "Restaurar".');
  addStep(3, 'ATENÇÃO: A restauração substitui dados atuais.');
  addStep(4, 'Confirme com sua senha.');
  yPos += 3;

  addNote('Recomendação: Sempre gere um backup antes de restaurar dados antigos ou fazer alterações em massa.');

  // === 14. GUIA PRÁTICO PASSO A PASSO - ENSINO SECUNDÁRIO ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('14. Guia Prático Passo a Passo - Ensino Secundário');
  addParagraph('Este guia destina-se à equipa de suporte e utilizadores de escolas secundárias (7ª a 13ª classe). Siga a ordem indicada para configurar e utilizar o DSICOLA corretamente.');
  yPos += 5;

  addSubsectionTitle('14.1 Configuração Inicial (Admin/Direção) - Pré-Requisitos');
  addParagraph('Antes de começar o ano letivo, complete estas etapas na ordem:');
  addStep(1, 'Configurações Institucionais: Configurações > Dados Institucionais. Verifique Nome, Logo, Endereço, IBAN.');
  addStep(2, 'Ano Letivo: Gestão Acadêmica > Anos Letivos. Crie ou ative o ano (ex: 2025) e marque como Ativo.');
  addStep(3, 'Trimestres: Configuração de Ensinos > Trimestres. Cadastre 1º, 2º e 3º Trimestre com datas de início/fim.');
  addStep(4, 'Calendário Acadêmico: Configuração de Ensinos > Calendário. Adicione todos os feriados, férias e eventos do ano.');
  addStep(5, 'Cursos: Gestão Acadêmica > Cursos. Ex: "Curso Geral", "Informática", "Humanidades". Defina valor da mensalidade.');
  addStep(6, 'Classes: Gestão Acadêmica > Classes. Vincule 7ª a 13ª classe a cada curso conforme o plano curricular.');
  addStep(7, 'Disciplinas: Gestão Acadêmica > Disciplinas. Cadastre cada disciplina por curso e trimestre. Ex: Matemática 10ª, 1º Trim.');
  addStep(8, 'Professores: Gestão de Funcionários > Professores. Cadastre e atribua às disciplinas (Atribuição de Disciplinas).');
  addStep(9, 'Turmas: Gestão Acadêmica > Turmas. Ex: "10ª A - Informática 2025". Vincule Curso, Classe, Professor, Ano Letivo, Trimestre.');
  yPos += 5;

  addSubsectionTitle('14.2 Fluxo Acadêmico Trimestral (Professor) - Ordem Obrigatória');
  addParagraph('O sistema bloqueia etapas até que as anteriores sejam concluídas. Ordem:');
  addStep(1, 'Plano de Ensino: Defina cada tópico/aula do trimestre. Ex: "Equações do 2º grau" - 4 aulas - 1º Trim.');
  addStep(2, 'Distribuição de Aulas: Gere as datas das aulas. Selecione dias da semana e data de início. O sistema ignora feriados.');
  addStep(3, 'Lançamento de Aulas: Após ministrar, clique em "Lançar Aula" e confirme a data real.');
  addStep(4, 'Controle de Presenças: Para cada aula lançada, marque Presente/Ausente/Justificado para cada aluno.');
  addStep(5, 'Avaliações e Notas: Crie avaliações (Prova, Teste, Trabalho). Lance notas. Média: (Prova + Trabalho) / 2 por trimestre.');
  yPos += 5;

  addSubsectionTitle('14.3 Sistema de Notas no Secundário');
  addParagraph('Em cada trimestre: Prova (P) + Trabalho (T) = Média do trimestre. Média final anual: média dos 3 trimestres.');
  addListItem('Aprovado: Média ≥ 10 e Frequência ≥ 75%');
  addListItem('Recurso: Média entre 8 e 9,9 - pode fazer exame de recuperação');
  addListItem('Reprovado: Média < 8 ou Frequência < 75%');
  addNote('Alunos com frequência < 75% não podem receber notas. O sistema bloqueia automaticamente.');
  yPos += 5;

  addSubsectionTitle('14.4 Gestão de Alunos (Secretaria)');
  addStep(1, 'Cadastro: Gestão de Alunos > Novo Aluno. Preencha BI, dados pessoais, Pai/Mãe. OBRIGATÓRIO: Curso e Classe.');
  addStep(2, 'Matrícula: Vincule à Turma. O sistema gera credenciais e envia por email.');
  addStep(3, 'Documentos: Upload de BI, Certificado, Atestado em Documentos de Alunos.');
  addStep(4, 'Propinas: O valor da mensalidade vem do Curso. Gestão Financeira > Mensalidades.');
  yPos += 5;

  addSubsectionTitle('14.5 Pautas e Boletins - Formato Secundário');
  addParagraph('Pauta trimestral: Nome, P1, T1, P2, T2, P3, T3, Média, Estado (Aprovado/Recurso/Reprovado). Sem campo BI.');
  addStep(1, 'Gestão Acadêmica > Pautas. Selecione Ano, Turma, Trimestre.');
  addStep(2, 'Clique em "Gerar Pauta". Exporte PDF ou Excel.');
  yPos += 3;

  addSubsectionTitle('14.6 Resolução de Problemas Comuns (Suporte)');
  addListItem('Aba bloqueada: Verifique se concluiu a etapa anterior (ex: Plano antes de Distribuição).');
  addListItem('Aluno não recebe nota: Verifique frequência mínima 75%. Justifique faltas se necessário.');
  addListItem('Trimestre não aparece: Certifique-se de que o Trimestre foi criado em Anos Letivos > Trimestres.');
  addListItem('Professor não vê turma: Verifique Atribuição de Disciplinas para o professor na turma/disciplina/ano.');

  // === 15. GUIA PRÁTICO PASSO A PASSO - ENSINO SUPERIOR ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  addSectionTitle('15. Guia Prático Passo a Passo - Ensino Superior');
  addParagraph('Este guia destina-se à equipa de suporte e utilizadores de universidades e institutos superiores. Siga a ordem indicada para configurar e utilizar o DSICOLA.');
  yPos += 5;

  addSubsectionTitle('15.1 Configuração Inicial (Admin) - Pré-Requisitos');
  addParagraph('Antes do semestre letivo, complete na ordem:');
  addStep(1, 'Configurações: Dados da instituição, Logo, IBAN. Tipo Acadêmico = SUPERIOR (definido no onboarding).');
  addStep(2, 'Ano Letivo: Crie o ano acadêmico (ex: 2025) e ative-o.');
  addStep(3, 'Semestres: Configuração de Ensinos > Semestres. Cadastre 1º e 2º Semestre com datas.');
  addStep(4, 'Calendário Acadêmico: Feriados, férias, período de exames.');
  addStep(5, 'Cursos: Ex: "Licenciatura em Informática", "Engenharia Civil". Valor da propina e créditos.');
  addStep(6, 'Disciplinas: Cadastre por curso e semestre. Ex: "Cálculo I" - 1º Sem, 6 créditos.');
  addStep(7, 'Professores: Cadastre e atribua às disciplinas (Ano, Semestre).');
  addStep(8, 'Turmas: Ex: "Turma A - Cálculo I - 2025/1". Vincule Curso, Ano, Semestre, Professor.');
  yPos += 5;

  addSubsectionTitle('15.2 Fluxo Acadêmico Semestral (Professor) - Ordem Obrigatória');
  addStep(1, 'Plano de Ensino: Conteúdos e aulas por semestre. Indique trimestre/semestre no plano.');
  addStep(2, 'Distribuição de Aulas: Gere datas. O sistema considera calendário e dias de aula.');
  addStep(3, 'Lançamento de Aulas: Marque aulas ministradas com data real.');
  addStep(4, 'Controle de Presenças: Registre presença por aula.');
  addStep(5, 'Avaliações e Notas: Crie avaliações (P1, P2, Exame, Recurso). Lance notas. Média conforme régimento.');
  yPos += 5;

  addSubsectionTitle('15.3 Sistema de Avaliação no Superior');
  addParagraph('Estrutura típica: Avaliação Contínua (P1, P2) + Exame Final. Exame de Recurso para alunos em prova de recuperação.');
  addListItem('Aprovado: Média ≥ 10 e Frequência ≥ 75%');
  addListItem('Exame/Recurso: Conforme regulamento da instituição');
  addListItem('Reprovado: Média < 10 ou Frequência < 75%');
  addListItem('Créditos: Sistema de créditos por disciplina. Total necessário para conclusão do curso.');
  addNote('O formato exato (pesos, regras de exame) pode variar. Configure em Avaliações conforme o regulamento.');
  yPos += 5;

  addSubsectionTitle('15.4 Gestão de Alunos (Secretaria)');
  addStep(1, 'Cadastro: OBRIGATÓRIO: Curso e Ano/Semestre. Número de matrícula pode ser gerado automaticamente.');
  addStep(2, 'Matrícula por Disciplina: Em universidades, alunos podem matricular-se em disciplinas específicas por semestre.');
  addStep(3, 'Inscrição em Turmas: Vincule aluno à turma da disciplina.');
  addStep(4, 'Propinas: Valor por curso. Mensalidades ou propina semestral conforme plano.');
  yPos += 5;

  addSubsectionTitle('15.5 Pautas e Documentos - Formato Superior');
  addParagraph('Pauta semestral: Nome, Matrícula, P1, P2, Exame, Recurso, Média, Estado. Com campo de número de matrícula.');
  addStep(1, 'Gestão Acadêmica > Pautas. Selecione Curso, Turma, Semestre.');
  addStep(2, 'Exporte PDF/Excel. Histórico Acadêmico e Certificado de Conclusão disponíveis.');
  yPos += 5;

  addSubsectionTitle('15.6 Conclusão de Curso e Diplomas');
  addParagraph('Para cursos superiores, o sistema suporta:');
  addListItem('Verificação de créditos concluídos');
  addListItem('Emissão de Certificado de Conclusão');
  addListItem('Histórico acadêmico completo');
  addListItem('Integração com processo de colação de grau');
  yPos += 3;

  addSubsectionTitle('15.7 Resolução de Problemas Comuns (Suporte)');
  addListItem('Semestre não disponível: Verifique Cadastro de Semestres vinculado ao Ano Letivo.');
  addListItem('Disciplina não aparece na matrícula: Confirme que a disciplina está no semestre correto e curso do aluno.');
  addListItem('Nota de exame: Crie avaliação tipo "Exame" ou "Recurso" e lance nas colunas corretas.');
  addListItem('Aluno em múltiplas turmas: No Superior é normal. Verifique matrícula por disciplina.');

  // === PÁGINA FINAL ===
  doc.addPage();
  currentPage++;
  yPos = addHeader('Manual do Sistema DSICOLA');
  
  yPos = 50;
  doc.setFillColor(240, 249, 255);
  doc.rect(margin, yPos, pageWidth - margin * 2, 120, 'F');
  yPos += 15;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('✅ Manual do Sistema DSICOLA', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Gerado com sucesso!', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  doc.text('Pronto para uso em instituições de Ensino Médio e Universitário.', pageWidth / 2, yPos, { align: 'center' });
  yPos += 20;
  
  // Badge de modos suportados
  doc.setFillColor(30, 64, 175);
  doc.roundedRect(55, yPos, pageWidth - 110, 30, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('📘 Ensino Médio: Trimestres • Classes • Notas (P+T)/2', pageWidth / 2, yPos + 10, { align: 'center' });
  doc.text('🎓 Universitário: Semestres • Anos • Sistema de Créditos', pageWidth / 2, yPos + 22, { align: 'center' });
  yPos += 45;

  doc.setTextColor(30, 64, 175);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Sistema DSICOLA', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Gestão Acadêmica e Financeira Integrada', pageWidth / 2, yPos, { align: 'center' });
  yPos += 20;
  
  doc.setFontSize(9);
  doc.text(config.instituicao.nome, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;
  doc.text(`Manual gerado em ${new Date().toLocaleString('pt-AO')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;
  doc.text(`Total de páginas: ${currentPage}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;
  doc.text('Versão 3.2 - Guias Práticos Secundário e Superior', pageWidth / 2, yPos, { align: 'center' });

  // Salvar
  doc.save(`manual-dsicola-v3.2-${Date.now()}.pdf`);
};
