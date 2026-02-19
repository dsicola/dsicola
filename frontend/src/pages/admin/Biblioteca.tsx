import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Plus, Search, Download, Calendar, User, AlertCircle, CheckCircle, XCircle, Pencil, Eye, FileText } from "lucide-react";
import { bibliotecaApi, API_URL, usersApi, alunosApi, professoresApi, funcionariosApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { safeToFixed } from "@/lib/utils";

interface BibliotecaItem {
  id: string;
  titulo: string;
  autor?: string;
  isbn?: string;
  tipo: 'FISICO' | 'DIGITAL';
  categoria?: string;
  quantidade: number;
  disponivel: number;
  emprestados: number;
  localizacao?: string;
  arquivoUrl?: string;
  thumbnailUrl?: string; // URL da thumbnail (primeira página do PDF)
  descricao?: string;
  editora?: string;
  anoPublicacao?: number;
  edicao?: string;
}

interface Emprestimo {
  id: string;
  item: BibliotecaItem;
  usuario: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  dataEmprestimo: string;
  dataPrevista: string;
  dataDevolucao?: string;
  status: 'ATIVO' | 'DEVOLVIDO' | 'ATRASADO';
  observacoes?: string;
}

export default function Biblioteca() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { isAdmin, isSecretaria, isProfessor, isAluno } = useRolePermissions();

  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("all");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("all");
  const [showCadastroDialog, setShowCadastroDialog] = useSafeDialog(false);
  const [showEdicaoDialog, setShowEdicaoDialog] = useSafeDialog(false);
  const [showPreviewDialog, setShowPreviewDialog] = useSafeDialog(false);
  const [showEmprestimoDialog, setShowEmprestimoDialog] = useSafeDialog(false);
  const [itemSelecionado, setItemSelecionado] = useState<BibliotecaItem | null>(null);
  
  // Formulário de empréstimo
  const [emprestimoForm, setEmprestimoForm] = useState({
    tipoLeitor: 'ALUNO' as 'ALUNO' | 'PROFESSOR' | 'FUNCIONARIO',
    pessoaId: '',
    pessoaNome: '',
    dataEmprestimo: new Date().toISOString().split('T')[0],
    dataPrevista: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 dias
    observacoes: '',
  });
  const [buscaPessoa, setBuscaPessoa] = useState('');
  const [pessoasDisponiveis, setPessoasDisponiveis] = useState<any[]>([]);
  const [itemParaEditar, setItemParaEditar] = useState<BibliotecaItem | null>(null);
  const [itemParaPreview, setItemParaPreview] = useState<BibliotecaItem | null>(null);

  // Formulário de cadastro
  const [formData, setFormData] = useState({
    titulo: "",
    autor: "",
    isbn: "",
    tipo: "FISICO" as 'FISICO' | 'DIGITAL',
    categoria: "",
    quantidade: 1,
    localizacao: "",
    descricao: "",
    editora: "",
    anoPublicacao: "",
    edicao: "",
  });

  // Arquivo PDF para upload
  const [arquivoPDF, setArquivoPDF] = useState<File | null>(null);
  // Thumbnail (imagem) para upload
  const [arquivoThumbnail, setArquivoThumbnail] = useState<File | null>(null);

  // Buscar itens
  const { data: itens, isLoading: loadingItens } = useQuery({
    queryKey: ["biblioteca-itens", busca, tipoFiltro, categoriaFiltro],
    queryFn: () => bibliotecaApi.getItens({
      busca: busca || undefined,
      tipo: tipoFiltro !== "all" ? tipoFiltro : undefined,
      categoria: categoriaFiltro !== "all" ? categoriaFiltro : undefined,
    }),
  });

  // Buscar empréstimos (apenas ADMIN/SECRETARIA)
  const { data: emprestimos, isLoading: loadingEmprestimos } = useQuery({
    queryKey: ["biblioteca-emprestimos"],
    queryFn: () => bibliotecaApi.getEmprestimos(),
    enabled: isAdmin || isSecretaria,
  });

  // Buscar meus empréstimos (PROFESSOR/ALUNO)
  const { data: meusEmprestimos, isLoading: loadingMeusEmprestimos } = useQuery({
    queryKey: ["biblioteca-meus-emprestimos"],
    queryFn: () => bibliotecaApi.getMeusEmprestimos(),
    enabled: isProfessor || isAluno,
  });

  // Buscar pessoas para empréstimo (baseado no tipo de leitor e busca)
  const { data: pessoas, isLoading: loadingPessoas } = useQuery({
    queryKey: ["pessoas-emprestimo", emprestimoForm.tipoLeitor, buscaPessoa],
    queryFn: async () => {
      if (!emprestimoForm.tipoLeitor || !buscaPessoa || buscaPessoa.length < 2) {
        return [];
      }
      
      try {
        const buscaLower = String(buscaPessoa ?? '').toLowerCase();
        
        if (emprestimoForm.tipoLeitor === 'FUNCIONARIO') {
          // Para funcionários, buscar via funcionariosApi
          const funcionarios = await funcionariosApi.getAll({ status: 'Ativo' });
          // Filtrar por busca (nome ou email)
          const filtrados = funcionarios.filter((f: any) => {
            const nome = String(f.nome_completo ?? f.nomeCompleto ?? f.nome ?? '').toLowerCase();
            const email = String(f.email ?? '').toLowerCase();
            return nome.includes(buscaLower) || email.includes(buscaLower);
          });
          
          return filtrados.map((f: any) => ({
            id: f.userId || f.id,
            nomeCompleto: f.nome_completo || f.nomeCompleto || f.nome || '',
            nome_completo: f.nome_completo || f.nomeCompleto || f.nome || '',
            email: f.email || '',
            numeroIdentificacao: f.numero_identificacao || f.numeroIdentificacao || '',
            tipo: 'FUNCIONARIO',
          }));
        } else if (emprestimoForm.tipoLeitor === 'ALUNO') {
          // Para alunos, usar alunosApi
          const alunos = await alunosApi.getAll({ status: 'Ativa' });
          // Filtrar por busca (nome, email ou número de identificação)
          const filtrados = alunos.filter((a: any) => {
            const nome = String(a.nome_completo ?? a.nomeCompleto ?? '').toLowerCase();
            const email = String(a.email ?? '').toLowerCase();
            const numPublico = String(a.numero_identificacao_publica ?? a.numeroIdentificacaoPublica ?? '').toLowerCase();
            const bi = String(a.numero_identificacao ?? a.numeroIdentificacao ?? '').toLowerCase();
            return nome.includes(buscaLower) || email.includes(buscaLower) || numPublico.includes(buscaLower) || bi.includes(buscaLower);
          });
          
          return filtrados.map((a: any) => ({
            id: a.id,
            nomeCompleto: a.nome_completo || a.nomeCompleto || '',
            nome_completo: a.nome_completo || a.nomeCompleto || '',
            email: a.email || '',
            numeroIdentificacao: a.numero_identificacao || a.numeroIdentificacao || '',
            tipo: 'ALUNO',
          }));
        } else if (emprestimoForm.tipoLeitor === 'PROFESSOR') {
          // Para professores, usar professoresApi
          const professores = await professoresApi.getAll();
          // Filtrar por busca (nome ou email)
          const filtrados = professores.filter((p: any) => {
            const nome = String(p.nome_completo ?? p.nomeCompleto ?? '').toLowerCase();
            const email = String(p.email ?? '').toLowerCase();
            return nome.includes(buscaLower) || email.includes(buscaLower);
          });
          
          return filtrados.map((p: any) => ({
            id: p.id,
            nomeCompleto: p.nome_completo || p.nomeCompleto || '',
            nome_completo: p.nome_completo || p.nomeCompleto || '',
            email: p.email || '',
            numeroIdentificacao: p.numero_identificacao || p.numeroIdentificacao || '',
            tipo: 'PROFESSOR',
          }));
        }
        
        return [];
      } catch (error) {
        console.error('[Biblioteca] Erro ao buscar pessoas:', error);
        toast.error('Erro ao buscar pessoas');
        return [];
      }
    },
    enabled: !!emprestimoForm.tipoLeitor && buscaPessoa.length >= 2,
  });

  // Criar item
  const createItemMutation = useMutation({
    mutationFn: bibliotecaApi.createItem,
    onSuccess: () => {
      toast.success("Item cadastrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["biblioteca-itens"] });
      setShowCadastroDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Erro ao cadastrar item");
    },
  });

  // Atualizar item
  const updateItemMutation = useMutation({
    mutationFn: (data: FormData) => bibliotecaApi.updateItem(itemParaEditar!.id, data),
    onSuccess: () => {
      toast.success("Item atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["biblioteca-itens"] });
      setShowEdicaoDialog(false);
      setItemParaEditar(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Erro ao atualizar item");
    },
  });

  // Criar empréstimo
  const createEmprestimoMutation = useMutation({
    mutationFn: bibliotecaApi.createEmprestimo,
    onSuccess: () => {
      toast.success("Empréstimo realizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["biblioteca-emprestimos"] });
      queryClient.invalidateQueries({ queryKey: ["biblioteca-meus-emprestimos"] });
      queryClient.invalidateQueries({ queryKey: ["biblioteca-itens"] });
      setShowEmprestimoDialog(false);
      setItemSelecionado(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Erro ao realizar empréstimo");
    },
  });

  // Renovar empréstimo
  const renovarMutation = useMutation({
    mutationFn: ({ id, dataPrevista }: { id: string; dataPrevista: string }) => 
      bibliotecaApi.renovarEmprestimo(id, { dataPrevista }),
    onSuccess: () => {
      toast.success("Empréstimo renovado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["biblioteca-emprestimos"] });
      queryClient.invalidateQueries({ queryKey: ["biblioteca-meus-emprestimos"] });
      queryClient.invalidateQueries({ queryKey: ["biblioteca-itens"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Erro ao renovar empréstimo");
    },
  });

  // Devolver empréstimo
  const devolverMutation = useMutation({
    mutationFn: bibliotecaApi.devolverEmprestimo,
    onSuccess: () => {
      toast.success("Devolução registrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["biblioteca-emprestimos"] });
      queryClient.invalidateQueries({ queryKey: ["biblioteca-meus-emprestimos"] });
      queryClient.invalidateQueries({ queryKey: ["biblioteca-itens"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Erro ao registrar devolução");
    },
  });

  const resetForm = () => {
    setFormData({
      titulo: "",
      autor: "",
      isbn: "",
      tipo: "FISICO",
      categoria: "",
      quantidade: 1,
      localizacao: "",
      descricao: "",
      editora: "",
      anoPublicacao: "",
      edicao: "",
    });
    setArquivoPDF(null);
    setArquivoThumbnail(null);
  };

  const handleEdit = (item: BibliotecaItem) => {
    setItemParaEditar(item);
    setFormData({
      titulo: item.titulo,
      autor: item.autor || "",
      isbn: item.isbn || "",
      tipo: item.tipo,
      categoria: item.categoria || "",
      quantidade: item.quantidade,
      localizacao: item.localizacao || "",
      descricao: item.descricao || "",
      editora: item.editora || "",
      anoPublicacao: item.anoPublicacao ? String(item.anoPublicacao) : "",
      edicao: item.edicao || "",
    });
    setArquivoPDF(null);
    setShowEdicaoDialog(true);
  };

  const handlePreview = (item: BibliotecaItem) => {
    if (item.tipo === 'DIGITAL' && item.arquivoUrl) {
      setItemParaPreview(item);
      setShowPreviewDialog(true);
    }
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemParaEditar) return;

    // Criar FormData
    const formDataToSend = new FormData();
    formDataToSend.append('titulo', formData.titulo);
    if (formData.autor) formDataToSend.append('autor', formData.autor);
    if (formData.isbn) formDataToSend.append('isbn', formData.isbn);
    formDataToSend.append('tipo', formData.tipo);
    if (formData.categoria) formDataToSend.append('categoria', formData.categoria);
    if (formData.tipo === 'FISICO') {
      formDataToSend.append('quantidade', String(formData.quantidade));
    }
    if (formData.localizacao) formDataToSend.append('localizacao', formData.localizacao);
    if (formData.descricao) formDataToSend.append('descricao', formData.descricao);
    if (formData.editora) formDataToSend.append('editora', formData.editora);
    if (formData.anoPublicacao) formDataToSend.append('anoPublicacao', formData.anoPublicacao);
    if (formData.edicao) formDataToSend.append('edicao', formData.edicao);

    // Adicionar arquivo apenas se um novo foi selecionado
    if (formData.tipo === 'DIGITAL' && arquivoPDF) {
      formDataToSend.append('arquivo', arquivoPDF);
    }

    updateItemMutation.mutate(formDataToSend as any);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validação: se tipo = DIGITAL, arquivo é obrigatório
    if (formData.tipo === 'DIGITAL' && !arquivoPDF) {
      toast.error("Arquivo PDF é obrigatório para itens digitais");
      return;
    }

    // Criar FormData
    const formDataToSend = new FormData();
    formDataToSend.append('titulo', formData.titulo);
    if (formData.autor) formDataToSend.append('autor', formData.autor);
    if (formData.isbn) formDataToSend.append('isbn', formData.isbn);
    formDataToSend.append('tipo', formData.tipo);
    if (formData.categoria) formDataToSend.append('categoria', formData.categoria);
    if (formData.tipo === 'FISICO') {
      formDataToSend.append('quantidade', String(formData.quantidade));
    }
    if (formData.localizacao) formDataToSend.append('localizacao', formData.localizacao);
    if (formData.descricao) formDataToSend.append('descricao', formData.descricao);
    if (formData.editora) formDataToSend.append('editora', formData.editora);
    if (formData.anoPublicacao) formDataToSend.append('anoPublicacao', formData.anoPublicacao);
    if (formData.edicao) formDataToSend.append('edicao', formData.edicao);

    // Adicionar arquivo apenas se tipo = DIGITAL
    if (formData.tipo === 'DIGITAL' && arquivoPDF) {
      formDataToSend.append('arquivo', arquivoPDF);
      console.log('[handleSubmit] Arquivo PDF adicionado ao FormData:', arquivoPDF.name, arquivoPDF.size, arquivoPDF.type);
    } else if (formData.tipo === 'DIGITAL' && !arquivoPDF) {
      console.error('[handleSubmit] ERRO: Tipo DIGITAL mas arquivoPDF é null!');
      toast.error("Arquivo PDF é obrigatório para itens digitais");
      return;
    }

    // Adicionar thumbnail (opcional, apenas para DIGITAL)
    if (formData.tipo === 'DIGITAL' && arquivoThumbnail) {
      formDataToSend.append('thumbnail', arquivoThumbnail);
    }

    // Debug: verificar FormData antes de enviar
    console.log('[handleSubmit] FormData criado:', {
      tipo: formDataToSend.get('tipo'),
      titulo: formDataToSend.get('titulo'),
      temArquivo: formDataToSend.get('arquivo') ? 'SIM' : 'NÃO',
    });

    createItemMutation.mutate(formDataToSend as any);
  };

  const handleEmprestimo = (item: BibliotecaItem) => {
    // Validar disponibilidade apenas para itens físicos
    if (item.tipo === 'FISICO' && item.disponivel <= 0) {
      toast.error("Material indisponível no momento");
      return;
    }
    
    // Itens digitais não precisam de validação de disponibilidade
    setItemSelecionado(item);
    setEmprestimoForm({
      tipoLeitor: 'ALUNO',
      pessoaId: '',
      pessoaNome: '',
      dataEmprestimo: new Date().toISOString().split('T')[0],
      dataPrevista: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      observacoes: '',
    });
    setBuscaPessoa('');
    setShowEmprestimoDialog(true);
  };

  const handleConfirmarEmprestimo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSelecionado) return;

    if (!emprestimoForm.pessoaId) {
      toast.error("Selecione uma pessoa para o empréstimo");
      return;
    }

    createEmprestimoMutation.mutate({
      itemId: itemSelecionado.id,
      usuarioId: emprestimoForm.pessoaId,
      dataPrevista: new Date(emprestimoForm.dataPrevista).toISOString(),
      observacoes: emprestimoForm.observacoes || undefined,
    });
  };

  const handleRenovarEmprestimo = (emprestimoId: string) => {
    const novaData = new Date();
    novaData.setDate(novaData.getDate() + 15);
    renovarMutation.mutate({
      id: emprestimoId,
      dataPrevista: novaData.toISOString(),
    });
  };

  const handleDevolver = (emprestimoId: string) => {
    if (confirm("Confirmar devolução?")) {
      devolverMutation.mutate(emprestimoId);
    }
  };

  const categorias = Array.from(new Set(itens?.map((item: BibliotecaItem) => item.categoria).filter(Boolean)));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-8 w-8" />
              Biblioteca
            </h1>
            <p className="text-muted-foreground">Gestão de acervo e empréstimos</p>
          </div>
          {(isAdmin || isSecretaria) && (
            <Dialog open={showCadastroDialog} onOpenChange={setShowCadastroDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Material
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Material</DialogTitle>
                  <DialogDescription>
                    Adicione um novo item ao acervo da biblioteca
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título *</Label>
                      <Input
                        value={formData.titulo}
                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Autor</Label>
                      <Input
                        value={formData.autor}
                        onChange={(e) => setFormData({ ...formData, autor: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ISBN</Label>
                      <Input
                        value={formData.isbn}
                        onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo *</Label>
                      <Select
                        value={formData.tipo}
                        onValueChange={(value: 'FISICO' | 'DIGITAL') => setFormData({ ...formData, tipo: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FISICO">Físico</SelectItem>
                          <SelectItem value="DIGITAL">Digital</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Input
                        value={formData.categoria}
                        onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      />
                    </div>
                    {formData.tipo === 'FISICO' && (
                      <div className="space-y-2">
                        <Label>Quantidade *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={formData.quantidade}
                          onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })}
                          required
                        />
                      </div>
                    )}
                    {formData.tipo === 'DIGITAL' && (
                      <div className="space-y-2">
                        <Label>Arquivo PDF *</Label>
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Validar tipo
                              if (file.type !== 'application/pdf') {
                                toast.error("Apenas arquivos PDF são permitidos");
                                return;
                              }
                              // Validar tamanho (50MB)
                              if (file.size > 50 * 1024 * 1024) {
                                toast.error("Arquivo muito grande. Tamanho máximo: 50MB");
                                return;
                              }
                              setArquivoPDF(file);
                            }
                          }}
                          required
                        />
                        {arquivoPDF && (
                          <p className="text-sm text-muted-foreground">
                            Arquivo selecionado: {arquivoPDF.name} ({safeToFixed(arquivoPDF.size / 1024 / 1024, 2)} MB)
                          </p>
                        )}
                      </div>
                    )}
                    {formData.tipo === 'DIGITAL' && (
                      <div className="space-y-2">
                        <Label>Thumbnail (Imagem de Preview) - Opcional</Label>
                        <Input
                          type="file"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Validar tipo
                              if (!file.type.startsWith('image/')) {
                                toast.error("Apenas imagens são permitidas (JPG, PNG)");
                                return;
                              }
                              // Validar tamanho (2MB)
                              if (file.size > 2 * 1024 * 1024) {
                                toast.error("Imagem muito grande. Tamanho máximo: 2MB");
                                return;
                              }
                              setArquivoThumbnail(file);
                            }
                          }}
                        />
                        {arquivoThumbnail && (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              Thumbnail selecionada: {arquivoThumbnail.name}
                            </p>
                            <div className="w-32 h-40 border rounded overflow-hidden bg-muted">
                              <img
                                src={URL.createObjectURL(arquivoThumbnail)}
                                alt="Preview thumbnail"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Imagem que será exibida na tabela e no preview. Recomendado: 160x200px (JPG ou PNG)
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Localização</Label>
                      <Input
                        value={formData.localizacao}
                        onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Editora</Label>
                      <Input
                        value={formData.editora}
                        onChange={(e) => setFormData({ ...formData, editora: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ano de Publicação</Label>
                      <Input
                        type="number"
                        value={formData.anoPublicacao}
                        onChange={(e) => setFormData({ ...formData, anoPublicacao: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Edição</Label>
                      <Input
                        value={formData.edicao}
                        onChange={(e) => setFormData({ ...formData, edicao: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <textarea
                      className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowCadastroDialog(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createItemMutation.isPending}>
                      Cadastrar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {/* Dialog de Edição */}
          {(isAdmin || isSecretaria) && (
            <Dialog open={showEdicaoDialog} onOpenChange={(open) => {
              if (!open) {
                setShowEdicaoDialog(false);
                setItemParaEditar(null);
                resetForm();
              }
            }}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Editar Material</DialogTitle>
                  <DialogDescription>
                    Atualize os dados do item da biblioteca
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título *</Label>
                      <Input
                        value={formData.titulo}
                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Autor</Label>
                      <Input
                        value={formData.autor}
                        onChange={(e) => setFormData({ ...formData, autor: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ISBN</Label>
                      <Input
                        value={formData.isbn}
                        onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo *</Label>
                      <Select
                        value={formData.tipo}
                        onValueChange={(value: 'FISICO' | 'DIGITAL') => {
                          setFormData({ ...formData, tipo: value });
                          if (value === 'FISICO') {
                            setArquivoPDF(null);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FISICO">Físico</SelectItem>
                          <SelectItem value="DIGITAL">Digital</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Input
                        value={formData.categoria}
                        onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      />
                    </div>
                    {formData.tipo === 'FISICO' && (
                      <div className="space-y-2">
                        <Label>Quantidade *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={formData.quantidade}
                          onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })}
                          required
                        />
                      </div>
                    )}
                    {formData.tipo === 'DIGITAL' && (
                      <div className="space-y-2">
                        <Label>Trocar Arquivo PDF {itemParaEditar?.arquivoUrl ? "(opcional)" : "*"}</Label>
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.type !== 'application/pdf') {
                                toast.error("Apenas arquivos PDF são permitidos");
                                return;
                              }
                              if (file.size > 50 * 1024 * 1024) {
                                toast.error("Arquivo muito grande. Tamanho máximo: 50MB");
                                return;
                              }
                              setArquivoPDF(file);
                            }
                          }}
                          required={!itemParaEditar?.arquivoUrl}
                        />
                        {arquivoPDF && (
                          <p className="text-sm text-muted-foreground">
                            Novo arquivo: {arquivoPDF.name} ({safeToFixed(arquivoPDF.size / 1024 / 1024, 2)} MB)
                          </p>
                        )}
                        {!arquivoPDF && itemParaEditar?.arquivoUrl && (
                          <p className="text-sm text-muted-foreground">
                            Arquivo atual será mantido. Selecione um novo arquivo para substituir.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Localização</Label>
                      <Input
                        value={formData.localizacao}
                        onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Editora</Label>
                      <Input
                        value={formData.editora}
                        onChange={(e) => setFormData({ ...formData, editora: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ano de Publicação</Label>
                      <Input
                        type="number"
                        value={formData.anoPublicacao}
                        onChange={(e) => setFormData({ ...formData, anoPublicacao: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Edição</Label>
                      <Input
                        value={formData.edicao}
                        onChange={(e) => setFormData({ ...formData, edicao: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <textarea
                      className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => {
                      setShowEdicaoDialog(false);
                      setItemParaEditar(null);
                      resetForm();
                    }}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={updateItemMutation.isPending}>
                      {updateItemMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {/* Dialog de Preview de PDF */}
          <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Preview: {itemParaPreview?.titulo}
                </DialogTitle>
                <DialogDescription>
                  Visualização do documento PDF
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {itemParaPreview && (
                  <div className="border rounded-lg overflow-hidden bg-muted">
                    <iframe
                      src={`${API_URL}/biblioteca/itens/${itemParaPreview.id}/download?preview=true`}
                      className="w-full h-[600px]"
                      title={`Preview ${itemParaPreview.titulo}`}
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowPreviewDialog(false)}
                  >
                    Fechar
                  </Button>
                  {itemParaPreview && (
                    <Button
                      onClick={() => {
                        bibliotecaApi.downloadArquivo(itemParaPreview.id);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar PDF
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="acervo" className="space-y-4">
          <TabsList>
            <TabsTrigger value="acervo">Acervo</TabsTrigger>
            {(isAdmin || isSecretaria) && <TabsTrigger value="emprestimos">Empréstimos</TabsTrigger>}
            {(isProfessor || isAluno) && <TabsTrigger value="meus-emprestimos">Meus Empréstimos</TabsTrigger>}
          </TabsList>

          <TabsContent value="acervo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Acervo da Biblioteca</CardTitle>
                <CardDescription>Busque e consulte materiais disponíveis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por título, autor ou ISBN..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="FISICO">Físico</SelectItem>
                      <SelectItem value="DIGITAL">Digital</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categorias.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loadingItens ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : !itens || itens.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum item encontrado
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Thumbnail</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Autor</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Disponibilidade</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item: BibliotecaItem) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.tipo === 'DIGITAL' && item.thumbnailUrl ? (
                              <div className="w-16 h-20 border rounded overflow-hidden bg-muted flex items-center justify-center">
                                <img
                                  src={`${API_URL}${item.thumbnailUrl}`}
                                  alt={`Thumbnail ${item.titulo}`}
                                  className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => handlePreview(item)}
                                  onError={(e) => {
                                    // Se thumbnail falhar, esconder
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            ) : item.tipo === 'DIGITAL' ? (
                              <div className="w-16 h-20 border rounded bg-muted flex items-center justify-center">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                              </div>
                            ) : (
                              <div className="w-16 h-20 border rounded bg-muted flex items-center justify-center">
                                <BookOpen className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.titulo}</TableCell>
                          <TableCell>{item.autor || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={item.tipo === 'FISICO' ? 'default' : 'secondary'}>
                              {item.tipo === 'FISICO' ? 'Físico' : 'Digital'}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.categoria || "-"}</TableCell>
                          <TableCell>
                            {item.tipo === 'FISICO' ? (
                              <span className={item.disponivel > 0 ? "text-green-600" : "text-red-600"}>
                                {item.disponivel} de {item.quantidade} disponível(is)
                              </span>
                            ) : (
                              <span className="text-green-600">Disponível</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {(isAdmin || isSecretaria) && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEdit(item)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {/* Botão Emprestar - apenas para ADMIN/SECRETARIA */}
                                  <Button
                                    size="sm"
                                    onClick={() => handleEmprestimo(item)}
                                    disabled={item.tipo === 'FISICO' && item.disponivel <= 0}
                                    variant="default"
                                  >
                                    Emprestar
                                  </Button>
                                </>
                              )}
                              {item.tipo === 'DIGITAL' && item.arquivoUrl && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handlePreview(item)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => bibliotecaApi.downloadArquivo(item.id)}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {(isProfessor || isAluno) && (
                                <Button
                                  size="sm"
                                  onClick={() => handleEmprestimo(item)}
                                  disabled={item.tipo === 'FISICO' && item.disponivel <= 0}
                                >
                                  Solicitar Empréstimo
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {(isAdmin || isSecretaria) && (
            <TabsContent value="emprestimos" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Empréstimos</CardTitle>
                  <CardDescription>Gerencie todos os empréstimos</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingEmprestimos ? (
                    <div className="text-center py-8">Carregando...</div>
                  ) : !emprestimos || emprestimos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum empréstimo encontrado
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Data Empréstimo</TableHead>
                          <TableHead>Data Prevista</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emprestimos.map((emp: any) => {
                          const estaAtrasado = emp.status === 'ATIVO' && new Date(emp.dataPrevista) < new Date();
                          const statusFinal = estaAtrasado ? 'ATRASADO' : emp.status;
                          
                          return (
                            <TableRow key={emp.id}>
                              <TableCell className="font-medium">{emp.item.titulo}</TableCell>
                              <TableCell>{emp.usuario.nomeCompleto}</TableCell>
                              <TableCell>{new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span>{new Date(emp.dataPrevista).toLocaleDateString('pt-BR')}</span>
                                  {estaAtrasado && (
                                    <span className="text-xs text-red-600 font-medium">
                                      {Math.ceil((new Date().getTime() - new Date(emp.dataPrevista).getTime()) / (1000 * 60 * 60 * 24))} dia(s) atrasado
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    statusFinal === 'ATRASADO'
                                      ? 'destructive'
                                      : statusFinal === 'ATIVO'
                                      ? 'default'
                                      : 'secondary'
                                  }
                                >
                                  {statusFinal === 'ATRASADO'
                                    ? 'Atrasado'
                                    : statusFinal === 'ATIVO'
                                    ? 'Ativo'
                                    : 'Devolvido'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {emp.status === 'ATIVO' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRenovarEmprestimo(emp.id)}
                                        disabled={renovarMutation.isPending}
                                      >
                                        Renovar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDevolver(emp.id)}
                                        disabled={devolverMutation.isPending}
                                      >
                                        Devolver
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {(isProfessor || isAluno) && (
            <TabsContent value="meus-emprestimos" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Meus Empréstimos</CardTitle>
                  <CardDescription>Consulte seus empréstimos ativos</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingMeusEmprestimos ? (
                    <div className="text-center py-8">Carregando...</div>
                  ) : !meusEmprestimos || meusEmprestimos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Você não possui empréstimos
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Data Empréstimo</TableHead>
                          <TableHead>Data Prevista</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {meusEmprestimos.map((emp: Emprestimo) => (
                          <TableRow key={emp.id}>
                            <TableCell className="font-medium">{emp.item.titulo}</TableCell>
                            <TableCell>{new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell>{new Date(emp.dataPrevista).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  emp.status === 'ATIVO'
                                    ? emp.dataPrevista < new Date().toISOString()
                                      ? 'destructive'
                                      : 'default'
                                    : 'secondary'
                                }
                              >
                                {emp.status === 'ATIVO' && emp.dataPrevista < new Date().toISOString()
                                  ? 'Atrasado'
                                  : emp.status === 'ATIVO'
                                  ? 'Ativo'
                                  : 'Devolvido'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Dialog de Empréstimo */}
        {/* Dialog de Empréstimo */}
        {(isAdmin || isSecretaria) && (
          <Dialog open={showEmprestimoDialog} onOpenChange={(open) => {
            if (!open) {
              setShowEmprestimoDialog(false);
              setItemSelecionado(null);
              setBuscaPessoa('');
            }
          }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Registrar Empréstimo</DialogTitle>
                <DialogDescription>
                  Material: {itemSelecionado?.titulo}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleConfirmarEmprestimo} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Leitor *</Label>
                  <Select
                    value={emprestimoForm.tipoLeitor}
                    onValueChange={(value: 'ALUNO' | 'PROFESSOR' | 'FUNCIONARIO') => {
                      setEmprestimoForm({ ...emprestimoForm, tipoLeitor: value, pessoaId: '', pessoaNome: '' });
                      setBuscaPessoa('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALUNO">Aluno</SelectItem>
                      <SelectItem value="PROFESSOR">Professor</SelectItem>
                      <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Pessoa *</Label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={`Buscar ${String(emprestimoForm.tipoLeitor ?? '').toLowerCase()}...`}
                        value={buscaPessoa}
                        onChange={(e) => setBuscaPessoa(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {loadingPessoas ? (
                      <p className="text-sm text-muted-foreground p-2">Carregando...</p>
                    ) : pessoas && pessoas.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto border rounded-md">
                        {pessoas.slice(0, 10).map((pessoa: any) => (
                          <div
                            key={pessoa.id}
                            className={`p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${
                              emprestimoForm.pessoaId === pessoa.id ? "bg-primary/10" : ""
                            }`}
                            onClick={() => setEmprestimoForm({
                              ...emprestimoForm,
                              pessoaId: pessoa.id,
                              pessoaNome: pessoa.nomeCompleto || pessoa.nome_completo,
                            })}
                          >
                            <p className="font-medium text-sm">{pessoa.nomeCompleto || pessoa.nome_completo}</p>
                            <p className="text-xs text-muted-foreground">
                              {pessoa.email} {pessoa.numeroIdentificacao ? `• ${pessoa.numeroIdentificacao}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground p-2">Nenhuma pessoa encontrada</p>
                    )}
                  </div>
                  {emprestimoForm.pessoaId && (
                    <p className="text-sm text-green-600">
                      ✓ Selecionado: {emprestimoForm.pessoaNome}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Empréstimo *</Label>
                    <Input
                      type="date"
                      value={emprestimoForm.dataEmprestimo}
                      onChange={(e) => setEmprestimoForm({ ...emprestimoForm, dataEmprestimo: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Prevista de Devolução *</Label>
                    <Input
                      type="date"
                      value={emprestimoForm.dataPrevista}
                      onChange={(e) => setEmprestimoForm({ ...emprestimoForm, dataPrevista: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <textarea
                    className="w-full min-h-[80px] px-3 py-2 border rounded-md"
                    value={emprestimoForm.observacoes}
                    onChange={(e) => setEmprestimoForm({ ...emprestimoForm, observacoes: e.target.value })}
                    placeholder="Observações sobre o empréstimo (opcional)"
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEmprestimoDialog(false);
                      setItemSelecionado(null);
                      setBuscaPessoa('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createEmprestimoMutation.isPending || !emprestimoForm.pessoaId}>
                    {createEmprestimoMutation.isPending ? "Registrando..." : "Registrar Empréstimo"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}

