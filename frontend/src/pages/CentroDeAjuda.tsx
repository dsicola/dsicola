/**
 * Centro de Ajuda - FAQ e links para documentação
 * Acesso público (autenticado) para utilizadores do sistema
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
import { ArrowLeft, HelpCircle, BookOpen, Mail, MessageCircle, Search, User, GraduationCap, DollarSign, FileText } from "lucide-react";

const FAQ_ITEMS = [
  { pergunta: "Como fazer matrícula de um estudante?", resposta: "Aceda a Estudantes e Matrículas → Gestão de Alunos. Crie o aluno se necessário, depois vá a Matrículas em Turmas para associar o aluno a uma turma.", tags: "matrícula,aluno" },
  { pergunta: "Como lançar notas?", resposta: "Aceda a Avaliações e Notas. Selecione a turma e disciplina. Crie ou selecione uma avaliação e preencha as notas dos estudantes.", tags: "notas,avaliação" },
  { pergunta: "Como gerar mensalidades?", resposta: "Aceda a Gestão Financeira ou Mensalidades. Use o botão 'Gerar Mensalidades' para lançar as mensalidades do mês para todos os estudantes matriculados.", tags: "mensalidades,financeiro" },
  { pergunta: "Como emitir certificados ou declarações?", resposta: "Aceda a Documentos Acadêmicos (Certificados). Configure os modelos e use a opção de emissão para gerar o documento em PDF.", tags: "certificado,declaração" },
  { pergunta: "Onde configurar valores de taxa de matrícula e mensalidade?", resposta: "Aceda a Taxas e Serviços. Pode definir valores padrão da instituição e valores específicos por curso ou classe.", tags: "taxas,configuração" },
  { pergunta: "Como aceder aos relatórios financeiros?", resposta: "Aceda a Gestão Financeira. Lá pode exportar Relatório de Receitas (mensal/anual), Mapa de Atrasos em PDF e outros relatórios.", tags: "relatórios,financeiro" },
  { pergunta: "Como estornar um pagamento?", resposta: "Em Gestão Financeira, clique em Estornar na mensalidade paga. Selecione o pagamento e preencha a justificativa obrigatória. O histórico é preservado.", tags: "estorno,pagamento" },
  { pergunta: "Como registrar presenças?", resposta: "Aceda a Lançamento de Aulas ou Controle de Presenças. Selecione a turma e data. Marque as presenças dos estudantes.", tags: "presença,frequência" },
  { pergunta: "Onde ver o Analytics e estatísticas?", resposta: "Aceda a Analytics (menu Sistema). Verá taxa de aprovação por turma, inadimplência, comparativo de receitas por ano e exportação para Excel/PDF.", tags: "analytics,estatísticas" },
  { pergunta: "Como configurar o ano letivo?", resposta: "Aceda a Configuração de Ensinos → Ano Letivo. Crie ou ative o ano letivo. O calendário e períodos dependem desta configuração.", tags: "ano letivo,configuração" },
];

const GUIAS_PERFIL = [
  { label: "Administrador", path: "/admin-dashboard", icon: User, desc: "Dashboard, configurações, relatórios" },
  { label: "Secretaria", path: "/admin-dashboard/pagamentos", icon: DollarSign, desc: "Mensalidades, matrículas, documentos" },
  { label: "Professor", path: "/painel-professor", icon: GraduationCap, desc: "Notas, presenças, turmas" },
  { label: "Documentos", path: "/admin-dashboard/certificados", icon: FileText, desc: "Certificados, declarações, recibos" },
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
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="h-7 w-7 text-primary" />
              Centro de Ajuda
            </h1>
            <p className="text-muted-foreground">
              Perguntas frequentes e orientações para utilizar o sistema
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Guias por perfil
            </CardTitle>
            <CardDescription>
              Acesso rápido às áreas principais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {GUIAS_PERFIL.map((g) => {
                const Icon = g.icon;
                return (
                  <Button
                    key={g.path}
                    variant="outline"
                    className="h-auto justify-start p-4"
                    onClick={() => navigate(g.path)}
                  >
                    <Icon className="h-4 w-4 mr-2 shrink-0" />
                    <div className="text-left">
                      <span className="font-medium">{g.label}</span>
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
              Perguntas Frequentes
            </CardTitle>
            <CardDescription>
              Pesquise ou navegue pelas dúvidas mais comuns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar (ex: matrícula, notas, estorno...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqsFiltradas.length > 0 ? (
                faqsFiltradas.map((item, i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger className="text-left">
                      {item.pergunta}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item.resposta}
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
              Entre em contacto com o suporte da sua instituição
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para questões técnicas ou suporte específico, contacte o administrador da sua instituição ou a equipa de suporte DSICOLA.
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
