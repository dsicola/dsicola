/**
 * Centro de Ajuda — FAQ, guias rápidos e passo a passo alinhados à UX (menu lateral, dashboards, separadores).
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getFaqRespostaCertificadosDeclaracoes,
  getFaqRespostaComoVerificarCodigo,
} from "@/components/common/AutenticidadeVerificacaoCallout";
import {
  ArrowLeft,
  HelpCircle,
  BookOpen,
  Mail,
  MessageCircle,
  Search,
  User,
  GraduationCap,
  DollarSign,
  FileText,
  LayoutDashboard,
  PanelLeft,
  School,
  HeartHandshake,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type FaqItem = { pergunta: string; resposta: string; tags: string };

const FAQ_ITEMS: FaqItem[] = [
  {
    pergunta: "Como procurar uma página ou módulo no painel?",
    resposta:
      "Use o botão «Procurar» no topo da área de trabalho ou o atalho Ctrl+K (Cmd+K no Mac). Escreva palavras-chave: o sistema pesquisa em todo o menu a que tem acesso — nome do item, secção, partes do endereço (URL) e sinónimos (ex.: mensalidades, documentos do estudante, AGT). Pode usar várias palavras ao mesmo tempo; todas devem constar em algum lado do registo. Seleccione um resultado para abrir essa página.",
    tags: "procurar,busca,atalho,cmdk,menu",
  },
  {
    pergunta: "Como me orientar no ecrã? (menu e separadores)",
    resposta:
      "1) Use o menu lateral (ícones à esquerda): só aparecem as áreas que o seu perfil pode usar. 2) O Dashboard é o ponto de partida — resumo e atalhos. 3) Dentro de muitas páginas há separadores no topo (tabs): troque de separador para ver Matrículas, Histórico, etc., sem sair da área. 4) O URL pode incluir ?tab=… — ao copiar o link, mantém o separador aberto. 5) Esta página (Centro de Ajuda) está sempre no menu para voltar às instruções.",
    tags: "menu,navegação,ux,tabs",
  },
  {
    pergunta: "Como fazer matrícula de um estudante?",
    resposta:
      "1) Menu Estudantes e Matrículas (ou Secretaria → área equivalente). 2) No separador adequado, registe o estudante se ainda não existir. 3) Abra Matrículas em Turmas, escolha ano letivo, turma e confirme a matrícula. 4) Verifique em Boletim / Notas se a turma e o plano de ensino estão corretos.",
    tags: "matrícula,aluno",
  },
  {
    pergunta: "Como lançar notas?",
    resposta:
      "Há dois fluxos principais. (A) Por disciplina e avaliação — menu Avaliações e notas (disciplina) ou, na Gestão Académica, o atalho equivalente: escolha curso ou classe, disciplina, professor e plano de ensino; crie avaliações (por trimestre/semestre) e lance notas. (B) Por turma e plano — Gestão Académica → Notas e pautas (turma) ou Painel do Professor → Notas (plano + turma): útil para ver a turma inteira; se existirem várias disciplinas, selecione também o plano de ensino.",
    tags: "notas,avaliação,turma,disciplina",
  },
  {
    pergunta: "O que significa “ano em curso” ou resultado não definitivo no boletim?",
    resposta:
      "Enquanto faltarem avaliações ou trimestres/semestres para fechar o período, a situação pode aparecer como em curso (não é reprovação final). Após lançar todas as notas exigidas pela instituição, o sistema consolida Aprovado ou Reprovado conforme a média e a frequência.",
    tags: "boletim,em curso,trimestre",
  },
  {
    pergunta: "Como gerar mensalidades?",
    resposta:
      "1) Menu Finanças ou Mensalidades / Propinas. 2) Use Gerar mensalidades (ou equivalente) para o mês desejado, respeitando turmas e taxas configuradas. 3) Em Relatórios financeiros acompanhe receitas e atrasos.",
    tags: "mensalidades,financeiro",
  },
  {
    pergunta: "Como emitir certificados ou declarações?",
    resposta: getFaqRespostaCertificadosDeclaracoes(),
    tags: "certificado,declaração,emitir,verificação,documento oficial",
  },
  {
    pergunta: "Como verificar o código num certificado ou declaração?",
    resposta: getFaqRespostaComoVerificarCodigo(),
    tags: "verificar,código,autenticidade,certificado,declaração,QR",
  },
  {
    pergunta: "Como verificar uma mini pauta em PDF?",
    resposta:
      "Nas áreas de pauta do plano de ensino (Gestão Académica, Secretaria ou Painel do professor, conforme permissões), ao clicar em Imprimir provisória ou Imprimir definitiva, o sistema gera um PDF com código de verificação (e link público, quando o domínio front-end está configurado no servidor). Para validar: use a página /verificar-pauta no mesmo site da instituição e introduza o código. A resposta confirma o registo da emissão (metadados como instituição, turma e disciplina), sem expor nomes nem notas na web. Não confundir com /verificar-documento (emitir documento oficial no estudante) nem com /verificar-certificado-conclusao.",
    tags: "pauta,mini pauta,verificação,PDF,imprimir,notas",
  },
  {
    pergunta: "Onde configurar valores de taxa de matrícula e mensalidade?",
    resposta:
      "Menu Taxas e Serviços: define valores padrão e, se aplicável, valores por curso (Ensino Superior) ou por classe (Ensino Secundário), conforme o tipo da instituição.",
    tags: "taxas,configuração",
  },
  {
    pergunta: "Como aceder aos relatórios financeiros (receitas, atrasos)?",
    resposta:
      "1) Menu Relatórios Financeiros ou Gestão Financeira. 2) Escolha o relatório (receitas, mapa de atrasos, etc.). 3) Exporte para PDF ou Excel quando existir o botão.",
    tags: "relatórios,financeiro",
  },
  {
    pergunta: "Como estornar um pagamento?",
    resposta:
      "1) Na área de mensalidades ou gestão financeira, localize a mensalidade paga. 2) Use Estornar, indique o pagamento e a justificativa obrigatória. 3) O histórico permanece registado para auditoria.",
    tags: "estorno,pagamento",
  },
  {
    pergunta: "Como registar presenças?",
    resposta:
      "Professor ou admin: menu Aulas e Presenças / Lançamento de aulas e depois Controlo de presenças (conforme o seu menu). Selecione turma, disciplina e data; marque presenças ou faltas e guarde.",
    tags: "presença,frequência",
  },
  {
    pergunta: "Onde ver Analytics e estatísticas?",
    resposta:
      "Perfil administrativo: menu Sistema / Analytics (quando disponível no plano). Verá indicadores como aprovação por turma, inadimplência e exportações.",
    tags: "analytics,estatísticas",
  },
  {
    pergunta: "Como configurar o ano letivo e períodos de notas?",
    resposta:
      "1) Configuração de ensino ou Instituição → Ano letivo: crie ou active o ano. 2) Períodos de lançamento e calendário académico regulam quando é permitido lançar notas. 3) Encerramento de ano letivo deve ser usado apenas no fim do processo, conforme regras da instituição.",
    tags: "ano letivo,configuração",
  },
];

type GuiaRapido = { label: string; path: string; icon: LucideIcon; desc: string };

const GUIAS_RAPIDOS: GuiaRapido[] = [
  { label: "Administrador — Dashboard", path: "/admin-dashboard", icon: User, desc: "Resumo institucional e atalhos" },
  { label: "Secretaria — Dashboard", path: "/secretaria-dashboard", icon: School, desc: "Estudantes, matrículas, documentos" },
  { label: "Professor — Painel", path: "/painel-professor", icon: GraduationCap, desc: "Turmas, notas, frequência, relatórios" },
  { label: "Estudante — Painel", path: "/painel-aluno", icon: BookOpen, desc: "Boletim, horário, mensalidades" },
  { label: "Encarregado — Painel", path: "/painel-responsavel", icon: HeartHandshake, desc: "Educandos, notas e mensagens" },
  { label: "Finanças — Mensalidades", path: "/admin-dashboard/pagamentos", icon: Wallet, desc: "Cobranças, recibos, propinas" },
  { label: "Relatórios oficiais", path: "/secretaria-dashboard/relatorios-oficiais", icon: FileText, desc: "Pauta, boletim, histórico" },
  { label: "Documentos académicos", path: "/admin-dashboard/certificados", icon: FileText, desc: "Certificados e declarações" },
];

type Passo = { texto: string; onde?: string; path?: string };

type RoteiroPerfil = {
  id: string;
  label: string;
  icon: LucideIcon;
  intro: string;
  passos: Passo[];
};

const ROTEIROS: RoteiroPerfil[] = [
  {
    id: "admin",
    label: "Admin / Direção",
    icon: User,
    intro:
      "A visão completa da instituição: estrutura académica, estudantes, finanças e configurações. Use o menu lateral por domínio (Académica, Estudantes, Financeiro, Sistema).",
    passos: [
      { texto: "Comece pelo Dashboard para ver alertas e estatísticas gerais.", onde: "Menu → Dashboard", path: "/admin-dashboard" },
      { texto: "Configure ou confira ano letivo, calendário e períodos de lançamento de notas.", onde: "Configuração de ensino / Instituição", path: "/admin-dashboard/configuracao-ensino" },
      { texto: "Garanta cursos ou classes, disciplinas, turmas e planos de ensino antes de matricular.", onde: "Gestão académica", path: "/admin-dashboard/gestao-academica" },
      { texto: "Cadastre estudantes e faça matrículas em turmas.", onde: "Estudantes e Matrículas", path: "/admin-dashboard/gestao-alunos" },
      { texto: "Defina taxas e valores (matrícula, mensalidade, serviços).", onde: "Taxas e Serviços", path: "/admin-dashboard/taxas-servicos" },
      { texto: "Acompanhe mensalidades, gere cobranças e relatórios financeiros.", onde: "Finanças / Relatórios financeiros", path: "/admin-dashboard/pagamentos" },
      { texto: "Emita documentos oficiais e configure modelos.", onde: "Documentos académicos", path: "/admin-dashboard/certificados" },
      { texto: "Ajuste utilizadores, backup e definições sensíveis.", onde: "Sistema / Configurações", path: "/admin-dashboard/configuracoes" },
    ],
  },
  {
    id: "secretaria",
    label: "Secretaria",
    icon: School,
    intro:
      "O dia a dia do estudante: cadastro, matrículas, documentos e comunicação. O menu pode mostrar o dashboard da secretaria e atalhos para as mesmas áreas do admin, conforme permissões.",
    passos: [
      { texto: "Abra o dashboard da secretaria para acesso rápido às tarefas frequentes.", onde: "Secretaria — Dashboard", path: "/secretaria-dashboard" },
      { texto: "Registe ou atualize dados do estudante.", onde: "Estudantes / Alunos", path: "/secretaria-dashboard/alunos" },
      { texto: "Associe o estudante a uma turma no ano letivo correto.", onde: "Matrículas", path: "/secretaria-dashboard/matriculas" },
      { texto: "Gere pauta, boletim ou histórico para conferência ou impressão.", onde: "Relatórios oficiais", path: "/secretaria-dashboard/relatorios-oficiais" },
      { texto: "Emita certificados ou declarações com os modelos aprovados.", onde: "Certificados", path: "/secretaria-dashboard/certificados" },
      { texto: "Comunique avisos ou acompanhe o mural, se disponível.", onde: "Comunicados", path: "/secretaria-dashboard/comunicados" },
    ],
  },
  {
    id: "professor",
    label: "Professor",
    icon: GraduationCap,
    intro:
      "Foco em turmas, aulas, avaliações e notas das suas disciplinas. O Painel do Professor concentra frequência, notas e relatórios de turma.",
    passos: [
      { texto: "Entre no painel e confira turmas e disciplinas atribuídas.", onde: "Painel do Professor", path: "/painel-professor" },
      { texto: "Registe aulas e presenças por data e turma.", onde: "Aulas e Presenças / Frequência", path: "/painel-professor/frequencia" },
      { texto: "Lance notas por plano de ensino e turma (mini-pauta ou avaliações).", onde: "Notas (plano + turma)", path: "/painel-professor/notas" },
      { texto: "Crie ou complete avaliações por disciplina quando usar o fluxo por plano.", onde: "Avaliações e notas (disciplina) — admin ou professor", path: "/admin-dashboard/avaliacoes-notas" },
      { texto: "Imprima pauta, lista de estudantes ou mapa de presenças.", onde: "Relatórios", path: "/painel-professor/relatorios" },
      { texto: "Consulte o seu horário.", onde: "Meus horários", path: "/painel-professor/horarios" },
    ],
  },
  {
    id: "aluno",
    label: "Estudante",
    icon: BookOpen,
    intro:
      "Consulta das suas informações académicas e financeiras. O menu é mais simples: boletim, horário, mensalidades e histórico.",
    passos: [
      { texto: "Veja resumo e atalhos no painel do estudante.", onde: "Painel do estudante", path: "/painel-aluno" },
      { texto: "Consulte notas por trimestre/semestre e situação (aprovado, em curso, etc.).", onde: "Boletim", path: "/painel-aluno/boletim" },
      { texto: "Confira o horário da turma e imprima se precisar.", onde: "Meu horário", path: "/painel-aluno/horarios" },
      { texto: "Aceda a propinas, recibos e estado de pagamento.", onde: "Minhas mensalidades", path: "/painel-aluno/mensalidades" },
      { texto: "Consulte histórico de disciplinas concluídas.", onde: "Histórico académico", path: "/painel-aluno/historico" },
      { texto: "Leia comunicados institucionais.", onde: "Comunicados", path: "/painel-aluno/comunicados" },
    ],
  },
  {
    id: "responsavel",
    label: "Encarregado de educação",
    icon: HeartHandshake,
    intro:
      "Acompanhe os educandos vinculados à sua conta: notas, frequência e mensagens. O painel usa separadores para mudar de educando ou área (notas, mensagens, etc.).",
    passos: [
      { texto: "Abra o painel do encarregado.", onde: "Painel — Encarregado", path: "/painel-responsavel" },
      { texto: "Se tiver mais do que um educando, selecione o estudante no painel ou no separador indicado.", onde: "Área do painel (educandos)" },
      { texto: "Consulte notas e frequência como o estudante veria, conforme permissões.", onde: "Separadores Notas / Frequência" },
      { texto: "Troque mensagens com a instituição ou professores quando o chat estiver disponível.", onde: "Chat / Mensagens", path: "/painel-responsavel" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: DollarSign,
    intro:
      "Cobrança, reconciliação e relatórios. O acesso costuma começar em Finanças ou Mensalidades e estender-se a relatórios e documentos fiscais (conforme o plano e perfil).",
    passos: [
      { texto: "Gerir mensalidades, estado de pagamento e recibos.", onde: "Finanças — Mensalidades", path: "/admin-dashboard/pagamentos" },
      { texto: "Analisar receitas, atrasos e exportar relatórios.", onde: "Relatórios financeiros", path: "/admin-dashboard/gestao-financeira" },
      { texto: "Ajustar taxas e serviços cobrados pela instituição.", onde: "Taxas e Serviços", path: "/admin-dashboard/taxas-servicos" },
      { texto: "Tratar documentos fiscais e conformidade (AGT), se aplicável.", onde: "Documentos fiscais", path: "/admin-dashboard/documentos-fiscais" },
    ],
  },
];

export default function CentroDeAjuda() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const faqsFiltradas = useMemo(() => {
    if (!search.trim()) return FAQ_ITEMS;
    const q = search.toLowerCase();
    return FAQ_ITEMS.filter(
      (f) =>
        f.pergunta.toLowerCase().includes(q) ||
        f.resposta.toLowerCase().includes(q) ||
        f.tags.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="h-7 w-7 text-primary" />
              Centro de Ajuda
            </h1>
            <p className="text-muted-foreground">
              Navegação no sistema, passo a passo por perfil e perguntas frequentes
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <PanelLeft className="h-5 w-5 shrink-0" />
              Como navegar (experiência de utilização)
            </CardTitle>
            <CardDescription>
              O DSICOLA organiza as funções por módulos no menu lateral e por separadores dentro de cada área
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="text-foreground font-medium">Menu lateral</span> — Lista os módulos que o seu utilizador pode usar (Académica, Finanças, Estudantes, etc.). Se não vir um item, o seu perfil não tem permissão.
              </li>
              <li>
                <span className="text-foreground font-medium">Dashboard</span> — É o hub inicial: resumo, atalhos e ligações rápidas. Volte aqui quando se perder.
              </li>
              <li>
                <span className="text-foreground font-medium">Separadores (tabs)</span> — Muitas páginas têm vários separadores no topo (ex.: Estudantes / Matrículas / Histórico). Clique no separador certo em vez de procurar noutro menu.
              </li>
              <li>
                <span className="text-foreground font-medium">Endereço do browser</span> — Parâmetros como <code className="text-xs bg-muted px-1 rounded">?tab=</code> guardam o separador ativo; pode guardar o favorito nesse estado.
              </li>
              <li>
                <span className="text-foreground font-medium">Ensino Superior vs Secundário</span> — Os nomes mudam (curso/disciplina/semestre vs classe/trimestre), mas o fluxo é o mesmo: estrutura → turmas → planos → notas.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              Atalhos para a sua área
            </CardTitle>
            <CardDescription>
              Abre diretamente o painel indicado (o menu lateral continua a ser a referência completa)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {GUIAS_RAPIDOS.map((g) => {
                const Icon = g.icon;
                return (
                  <Button
                    key={g.path + g.label}
                    variant="outline"
                    className="h-auto justify-start p-4"
                    onClick={() => navigate(g.path)}
                  >
                    <Icon className="h-4 w-4 mr-2 shrink-0" />
                    <div className="text-left">
                      <span className="font-medium leading-tight">{g.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{g.desc}</p>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Passo a passo por perfil
            </CardTitle>
            <CardDescription>
              Ordem sugerida para encontrar todas as informações; em cada passo pode abrir o ecrã correspondente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="admin" className="w-full">
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
                {ROTEIROS.map((r) => (
                  <TabsTrigger key={r.id} value={r.id} className="text-xs sm:text-sm gap-1.5">
                    <r.icon className="h-3.5 w-3.5 hidden sm:inline" />
                    {r.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {ROTEIROS.map((r) => (
                <TabsContent key={r.id} value={r.id} className="mt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">{r.intro}</p>
                  <ol className="space-y-3 list-decimal pl-5 text-sm">
                    {r.passos.map((p, idx) => (
                      <li key={idx} className="pl-1">
                        <span className="text-foreground">{p.texto}</span>
                        {p.onde && (
                          <div className="mt-1 text-muted-foreground">
                            <span className="font-medium text-foreground/80">Onde no menu: </span>
                            {p.onde}
                            {p.path && (
                              <>
                                {" "}
                                <button
                                  type="button"
                                  className="text-primary underline underline-offset-2 hover:no-underline"
                                  onClick={() => navigate(p.path!)}
                                >
                                  Abrir
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Perguntas frequentes
            </CardTitle>
            <CardDescription>
              Pesquise por palavra-chave ou expanda as perguntas abaixo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar (ex: matrícula, notas, boletim, estorno...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Pesquisar perguntas frequentes"
              />
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqsFiltradas.length > 0 ? (
                faqsFiltradas.map((item, i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger className="text-left">{item.pergunta}</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-muted-foreground whitespace-pre-line text-sm leading-relaxed">{item.resposta}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-6">
                  Nenhum resultado para &quot;{search}&quot;. Tente outra pesquisa.
                </p>
              )}
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Precisa de mais ajuda?
            </CardTitle>
            <CardDescription>
              Contacte o suporte da sua instituição ou a equipa DSICOLA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para questões técnicas, dados oficiais ou acesso de perfil, fale com o administrador da sua instituição. Para suporte à plataforma, utilize o contacto abaixo.
            </p>
            <Button variant="outline" asChild>
              <a href="mailto:suporte@dsicola.com">
                <Mail className="h-4 w-4 mr-2" />
                Enviar e-mail
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
