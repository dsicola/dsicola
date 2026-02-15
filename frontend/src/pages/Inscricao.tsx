import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { instituicoesApi, candidaturasApi } from "@/services/api";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SmartSearch } from "@/components/common/SmartSearch";
import { toast } from "@/hooks/use-toast";
import { AxiosError } from "axios";
import { 
  GraduationCap, 
  ArrowLeft, 
  CheckCircle2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  Upload,
  FileText,
  X
} from "lucide-react";

interface FormData {
  nome_completo: string;
  email: string;
  telefone: string;
  numero_identificacao: string;
  data_nascimento: string;
  genero: string;
  morada: string;
  cidade: string;
  pais: string;
  curso_pretendido: string;
  classe_pretendida: string;
  turno_preferido: string;
  documentos: File[];
}

export default function Inscricao() {
  const navigate = useNavigate();
  const { instituicao, configuracao } = useTenant();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    nome_completo: "",
    email: "",
    telefone: "",
    numero_identificacao: "",
    data_nascimento: "",
    genero: "",
    morada: "",
    cidade: "",
    pais: "Angola",
    curso_pretendido: "",
    classe_pretendida: "",
    turno_preferido: "",
    documentos: [],
  });

  // DIFERENCIAÇÃO: Secundário = Classes, Superior = Cursos (endpoint público)
  const { data: opcoesData } = useQuery({
    queryKey: ["opcoes-inscricao", instituicao?.subdominio],
    queryFn: async () => {
      if (!instituicao?.subdominio) return null;
      return await instituicoesApi.getOpcoesInscricao(instituicao.subdominio);
    },
    enabled: !!instituicao?.subdominio,
  });

  const isSecundario = opcoesData?.tipoAcademico === "SECUNDARIO";
  const opcoes = opcoesData?.opcoes ?? [];

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Upload documentos se houver
      let documentosUrl: string[] = [];
      if (data.documentos && data.documentos.length > 0) {
        // Em produção, fazer upload real dos arquivos
        // Por enquanto, apenas simular URLs (em produção, usar storageApi.uploadDocument)
        documentosUrl = data.documentos.map((file, index) => {
          // TODO: Implementar upload real para storage
          // Por enquanto, retornar placeholder
          return `documento_${Date.now()}_${index}_${file.name}`;
        });
      }

      await candidaturasApi.create({
        nomeCompleto: data.nome_completo,
        email: data.email,
        telefone: data.telefone || null,
        numeroIdentificacao: data.numero_identificacao,
        dataNascimento: data.data_nascimento || null,
        genero: data.genero || null,
        morada: data.morada || null,
        cidade: data.cidade || null,
        pais: data.pais,
        cursoPretendido: isSecundario ? undefined : (data.curso_pretendido || undefined),
        classePretendida: isSecundario ? (data.classe_pretendida || undefined) : undefined,
        turnoPreferido: data.turno_preferido || null,
        instituicaoId: instituicao?.id || null,
        documentosUrl: documentosUrl.length > 0 ? documentosUrl : undefined,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Candidatura enviada!",
        description: "A sua candidatura foi submetida com sucesso. Entraremos em contacto em breve.",
      });
    },
    onError: (error: unknown) => {
      let errorMessage = "Não foi possível submeter a candidatura. Por favor, verifique os dados e tente novamente.";
      
      // Tratar AxiosError
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const responseData = error.response?.data;
        
        // Tratar especificamente o erro 409 (Conflict)
        if (status === 409) {
          errorMessage = responseData?.message || 
            "Já existe uma candidatura activa com este endereço de correio electrónico ou número de identificação. Por favor, verifique os dados ou contacte a instituição.";
        } else {
          // Para outros erros, tentar extrair a mensagem do backend
          errorMessage = responseData?.message || 
                        responseData?.error || 
                        error.message || 
                        errorMessage;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Não foi possível submeter a candidatura",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome_completo || !formData.email || !formData.numero_identificacao) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate(formData);
  };

  const handleChange = (field: keyof FormData, value: string | File[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Candidatura Enviada!</h2>
            <p className="text-muted-foreground mb-6">
              A sua candidatura foi submetida com sucesso. 
              Iremos analisar os seus dados e entraremos em contacto através do email fornecido.
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate("/")} className="w-full">
                Voltar à Página Inicial
              </Button>
              <Button onClick={() => setSubmitted(false)} variant="outline" className="w-full">
                Submeter Nova Candidatura
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {configuracao?.logo_url ? (
                <img 
                  src={configuracao.logo_url} 
                  alt={configuracao?.nomeInstituicao ?? configuracao?.nome_instituicao ?? instituicao?.nome ?? ''}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
              <div>
                <h1 className="font-bold">{configuracao?.nomeInstituicao ?? configuracao?.nome_instituicao ?? instituicao?.nome ?? "Universidade"}</h1>
                <p className="text-xs text-muted-foreground">Portal de Inscrições</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Candidatura Online</h2>
            <p className="text-muted-foreground">
              Preencha o formulário abaixo para se candidatar a uma vaga na nossa instituição.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados Pessoais
              </CardTitle>
              <CardDescription>
                Campos marcados com * são obrigatórios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label htmlFor="nome_completo">Nome Completo *</Label>
                    <Input
                      id="nome_completo"
                      value={formData.nome_completo}
                      onChange={(e) => handleChange("nome_completo", e.target.value)}
                      placeholder="Digite seu nome completo"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        className="pl-10"
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="seu@email.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="telefone"
                        className="pl-10"
                        value={formData.telefone}
                        onChange={(e) => handleChange("telefone", e.target.value)}
                        placeholder="+244 XXX XXX XXX"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="numero_identificacao">Número de BI *</Label>
                    <Input
                      id="numero_identificacao"
                      value={formData.numero_identificacao}
                      onChange={(e) => handleChange("numero_identificacao", e.target.value)}
                      placeholder="Número do Bilhete de Identidade"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="data_nascimento"
                        type="date"
                        className="pl-10"
                        value={formData.data_nascimento}
                        onChange={(e) => handleChange("data_nascimento", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="genero">Gênero</Label>
                    <Select value={formData.genero} onValueChange={(v) => handleChange("genero", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Feminino">Feminino</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="cidade">Cidade</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="cidade"
                        className="pl-10"
                        value={formData.cidade}
                        onChange={(e) => handleChange("cidade", e.target.value)}
                        placeholder="Sua cidade"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="morada">Morada</Label>
                    <Textarea
                      id="morada"
                      value={formData.morada}
                      onChange={(e) => handleChange("morada", e.target.value)}
                      placeholder="Endereço completo"
                      rows={2}
                    />
                  </div>
                </div>

                {/* DIFERENCIAÇÃO: Secundário = Classe, Superior = Curso */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    {isSecundario ? "Classe Pretendida" : "Curso Pretendido"}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor={isSecundario ? "classe" : "curso"}>
                        {isSecundario ? "Classe (Ano)" : "Curso"}
                      </Label>
                      <SmartSearch
                        placeholder={
                          isSecundario
                            ? "Digite o nome ou código da classe (ex: 10ª, 11ª)..."
                            : "Digite o nome ou código do curso..."
                        }
                        value={
                          opcoes.find(
                            (o: { id: string }) =>
                              o.id === (isSecundario ? formData.classe_pretendida : formData.curso_pretendido)
                          )?.nome || ""
                        }
                        selectedId={
                          (isSecundario ? formData.classe_pretendida : formData.curso_pretendido) || undefined
                        }
                        onSelect={(item) =>
                          handleChange(
                            isSecundario ? "classe_pretendida" : "curso_pretendido",
                            item ? item.id : ""
                          )
                        }
                        onClear={() =>
                          handleChange(isSecundario ? "classe_pretendida" : "curso_pretendido", "")
                        }
                        searchFn={async (term) => {
                          const search = term.toLowerCase().trim();
                          return opcoes
                            .filter(
                              (o: { nome: string; codigo?: string }) =>
                                (o.nome || "").toLowerCase().includes(search) ||
                                (o.codigo || "").toLowerCase().includes(search)
                            )
                            .slice(0, 15)
                            .map((o: { id: string; nome: string; codigo?: string }) => ({
                              id: o.id,
                              nome: o.nome,
                              nomeCompleto: o.nome,
                              complemento: o.codigo ? `Código: ${o.codigo}` : "",
                            }));
                        }}
                        minSearchLength={1}
                        emptyMessage={
                          isSecundario
                            ? "Nenhuma classe cadastrada. Contacte a instituição."
                            : "Nenhum curso cadastrado. Contacte a instituição."
                        }
                        silent
                      />
                    </div>

                    <div>
                      <Label htmlFor="turno">Turno Preferido</Label>
                      <Select 
                        value={formData.turno_preferido} 
                        onValueChange={(v) => handleChange("turno_preferido", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o turno" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Manhã">Manhã</SelectItem>
                          <SelectItem value="Tarde">Tarde</SelectItem>
                          <SelectItem value="Noite">Noite</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Document Upload */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documentos (Opcional)
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="documentos">Anexar Documentos</Label>
                      <div className="mt-2">
                        <Input
                          id="documentos"
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setFormData(prev => ({ ...prev, documentos: files }));
                          }}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Formatos aceites: PDF, JPG, PNG, DOC, DOCX (máx. 5MB por arquivo)
                        </p>
                      </div>
                    </div>
                    {formData.documentos.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Documentos selecionados:</p>
                        <div className="space-y-2">
                          {formData.documentos.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{file.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newDocs = formData.documentos.filter((_, i) => i !== index);
                                  setFormData(prev => ({ ...prev, documentos: newDocs }));
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit */}
                <div className="border-t pt-6">
                  <Button 
                    type="submit" 
                    className="w-full gradient-primary" 
                    size="lg"
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? "Enviando..." : "Submeter Candidatura"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Ao submeter, você concorda com os termos de uso e política de privacidade da instituição.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
