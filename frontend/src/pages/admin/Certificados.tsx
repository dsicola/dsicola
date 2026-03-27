import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CertificadosTab } from "@/components/admin/CertificadosTab";
import { ModelosDocumentosTab } from "@/components/admin/ModelosDocumentosTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { Award, FileText, MapPinned, FileStack, Settings2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

export default function CertificadosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const rawRoles = (user as { roles?: string[] } | null)?.roles ?? [];
  const userRoles = Array.isArray(rawRoles) ? rawRoles : [];
  const podeConfigurarInstituicao = userRoles.some((r) => r === "ADMIN" || r === "SUPER_ADMIN");

  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl === "modelos" ? "modelos" : "certificados";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Certificados e documentos oficiais</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Emitir boletins e documentos por modelo. A <strong>conclusão de curso</strong> com registo no livro e o PDF com
            código de verificação são tratados no <strong>perfil do estudante</strong> (separadores Conclusão e Emitir
            documento).
          </p>
        </div>

        <Card className="border-primary/15 bg-muted/25">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-primary shrink-0" />
              Onde fica cada configuração
            </CardTitle>
            <CardDescription>
              Separação clara: o que faz <strong>aqui</strong> vs o que fica em <strong>Configurações da instituição</strong>
              (textos, carimbos, impressão).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-background p-4 space-y-2">
              <div className="flex items-center gap-2 font-medium text-sm">
                <FileStack className="h-4 w-4 text-muted-foreground shrink-0" />
                Nesta página (separadores abaixo)
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>
                  <strong className="text-foreground">Emitir certificados</strong> — boletins e emissão com dados já
                  registados no sistema.
                </li>
                <li>
                  <strong className="text-foreground">Importar modelos</strong> — ficheiros Word/HTML e mapeamento de
                  placeholders para o DSICOLA preencher automaticamente.
                </li>
              </ul>
            </div>

            {podeConfigurarInstituicao ? (
              <div className="rounded-lg border bg-background p-4 space-y-3">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  Instituição — layout e regras dos PDFs
                </div>
                <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4 leading-relaxed">
                  <li>
                    <strong className="text-foreground">Textos legais, carimbos, fundo, cópias e numeração</strong> — menu
                    lateral <strong>Sistema</strong>, depois separador{' '}
                    <Link
                      to="/admin-dashboard/configuracoes?tab=documentos"
                      className="text-primary font-medium underline underline-offset-2 whitespace-nowrap"
                    >
                      «Certificados e documentos»
                    </Link>
                    .
                  </li>
                  <li>
                    <strong className="text-foreground">Média final, ciclos de conclusão e pesos da pauta (secundário)</strong>{' '}
                    —{' '}
                    <Link
                      to="/admin-dashboard/configuracoes?tab=avancadas"
                      className="text-primary font-medium underline underline-offset-2"
                    >
                      Configurações → Avançadas
                    </Link>
                    .
                  </li>
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild variant="secondary" size="sm">
                    <Link to="/admin-dashboard/configuracoes?tab=documentos#doc-indice">Textos legais e impressão</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin-dashboard/configuracoes?tab=geral#cfg-fundo-docs">Fundo do PDF e carimbos</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin-dashboard/configuracoes?tab=avancadas">Média final e ciclos (sec.)</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <Alert className="border-amber-500/35 bg-amber-500/[0.06]">
                <AlertDescription className="text-xs leading-relaxed">
                  Os <strong>textos oficiais</strong>, <strong>carimbos</strong> e <strong>imagem de fundo</strong> dos PDFs
                  são definidos pelo perfil <strong>Administrador</strong>, em <strong>Sistema → Configurações</strong>. Se
                  precisar de alterações, contacte a direção ou o administrador da instituição.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setSearchParams(v === "modelos" ? { tab: "modelos", subtab: "importados" } : { tab: v })}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="certificados" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Emitir certificados
            </TabsTrigger>
            <TabsTrigger value="modelos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Importar modelos
            </TabsTrigger>
          </TabsList>
          <TabsContent value="certificados">
            <CertificadosTab />
          </TabsContent>
          <TabsContent value="modelos">
            <ModelosDocumentosTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
