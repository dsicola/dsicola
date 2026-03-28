import { useState, useEffect } from "react";
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
import { BookOpen, Plus, Search, Download, Calendar, User, AlertCircle, CheckCircle, XCircle, Pencil, Eye, FileText, Settings, BookMarked, DollarSign, BarChart3 } from "lucide-react";
import { bibliotecaApi, usersApi, alunosApi, professoresApi, funcionariosApi, storageApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { safeToFixed } from "@/lib/utils";
import { ConfirmacaoResponsabilidadeDialog } from "@/components/common/ConfirmacaoResponsabilidadeDialog";

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

/** Thumbnail com URL assinada para evitar TOKEN_MISSING em imagens cross-origin */
function BibliotecaThumbnail({
  thumbnailUrl,
  titulo,
  onPreview,
}: {
  thumbnailUrl: string;
  titulo: string;
  onPreview: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    storageApi
      .getSignedUrlForUploadsUrl(thumbnailUrl)
      .then((url) => {
        if (!cancelled) setSignedUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [thumbnailUrl]);
  return (
    <div className="w-16 h-20 border rounded overflow-hidden bg-muted flex items-center justify-center">
      {signedUrl ? (
        <img
          src={signedUrl}
          alt={`Thumbnail ${titulo}`}
          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
          onClick={onPreview}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <FileText className="h-8 w-8 text-muted-foreground" />
      )}
    </div>
  );
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
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showReservaDialog, setShowReservaDialog] = useSafeDialog(false);
  const [itemParaReservar, setItemParaReservar] = useState<BibliotecaItem | null>(null);
  const [criticoBiblioteca, setCriticoBiblioteca] = useState<
    | { tipo: "devolver"; id: string }
    | { tipo: "cancelar-reserva"; id: string }
    | { tipo: "pagar-multa"; id: string }
    | null
  >(null);

  // Formulário de configuração
  const [configForm, setConfigForm] = useState({
    limiteEmprestimosPorUsuario: 5,
    multaPorDiaAtraso: 0,
    diasParaNotificarVencimento: 3,
    diasValidadeReserva: 7,
  });

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

  // Configuração (ADMIN/SECRETARIA)
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["biblioteca-config"],
    queryFn: () => bibliotecaApi.getConfig(),
    enabled: isAdmin || isSecretaria,
  });

  // Reservas
  const { data: reservas, isLoading: loadingReservas } = useQuery({
    queryKey: ["biblioteca-reservas"],
    queryFn: () => bibliotecaApi.getReservas(),
  });

  // Multas
  const { data: multas, isLoading: loadingMultas } = useQuery({
    queryKey: ["biblioteca-multas"],
    queryFn: () => bibliotecaApi.getMultas(),
  });

  // Relatórios (ADMIN/SECRETARIA)
  const { data: relatorios, isLoading: loadingRelatorios } = useQuery({
    queryKey: ["biblioteca-relatorios"],
    queryFn: () => bibliotecaApi.getRelatorios(),
    enabled: isAdmin || isSecretaria,
  });

  // Buscar meus empréstimos (PROFESSOR/ALUNO)
  const { data: meusEmprestimos, isLoading: loadingMeusEmprestimos } = useQuery({
    queryKey: ["biblioteca-meus-emprestimos"],
    queryFn: () => bibliotecaApi.getMeusEmprestimos(),
    enabled: isProfessor || isAluno,
  });

  // Sincronizar formulário de config quando dados carregam
  useEffect(() => {
    if (config) {
      setConfigForm({
        limiteEmprestimosPorUsuario: config.limiteEmprestimosPorUsuario ?? 5,
        multaPorDiaAtraso: Number(config.multaPorDiaAtraso ?? 0),
        diasParaNotificarVencimento: config.diasParaNotificarVencimento ?? 3,
        diasValidadeReserva: config.diasValidadeReserva ?? 7,
      });
    }
  }, [config]);

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
          const resAlunos = await alunosApi.getAll({ status: 'Ativa' });
          const alunos = resAlunos?.data ?? [];
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
          const resProf = await professoresApi.getAll();
          const professores = resProf?.data ?? [];
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
      toast.error(error?.response?.data?.message || "Não foi possível cadastrar o item. Tente novamente.");
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
      toast.error(error?.response?.data?.message || "Não foi possível atualizar o item. Tente novamente.");
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
      toast.error(error?.response?.data?.message || "Não foi possível realizar o empréstimo. Tente novamente.");
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
      toast.error(error?.response?.data?.message || "Não foi possível renovar o empréstimo. Tente novamente.");
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
      setCriticoBiblioteca(null);
    },
    onError: (error: any) => {
      setCriticoBiblioteca(null);
      toast.error(error?.response?.data?.message || "Não foi possível registrar a devolução. Tente novamente.");
    },
  });

  // Atualizar configuração
  const updateConfigMutation = useMutation({
    mutationFn: bibliotecaApi.updateConfig,
    onSuccess: () => {
      toast.success("Configuração salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["biblioteca-config"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Não foi possível salvar a configuração. Tente novamente.");
    },
  });

  // Criar reserva
  const criarReservaMutation = useMutation({
    mutationFn: bibliotecaApi.criarReserva,
    onSuccess: () => {
      toast.success("Reserva realizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["biblioteca-reservas"] });
      queryClient.invalidateQueries({ queryKey: ["biblioteca-itens"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Não foi possível criar a reserva. Tente novamente.");
    },
  });

  // Cancelar reserva
  const cancelarReservaMutation = useMutation({
    mutationFn: bibliotecaApi.cancelarReserva,
    onSuccess: () => {
      toast.success("Reserva cancelada!");
      queryClient.invalidateQueries({ queryKey: ["biblioteca-reservas"] });
      setCriticoBiblioteca(null);
    },
    onError: (error: any) => {
      setCriticoBiblioteca(null);
      toast.error(error?.response?.data?.message || "Não foi possível cancelar a reserva. Tente novamente.");
    },
  });

  // Pagar multa
  const pagarMultaMutation = useMutation({
    mutationFn: bibliotecaApi.pagarMulta,
    onSuccess: () => {
      toast.success("Multa registrada como paga!");
      queryClient.invalidateQueries({ queryKey: ["biblioteca-multas"] });
      setCriticoBiblioteca(null);
    },
    onError: (error: any) => {
      setCriticoBiblioteca(null);
      toast.error(error?.response?.data?.message || "Não foi possível registrar o pagamento. Tente novamente.");
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

  const handlePreview = async (item: BibliotecaItem) => {
    if (item.tipo !== 'DIGITAL' || !item.arquivoUrl) return;
    setItemParaPreview(item);
    setPreviewBlobUrl(null);
    setShowPreviewDialog(true);
    setPreviewLoading(true);
    try {
      const blob = await bibliotecaApi.getPreviewBlob(item.id);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch (e) {
      toast.error('Erro ao carregar preview do documento');
      setShowPreviewDialog(false);
      setItemParaPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = (open: boolean) => {
    if (!open && previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
      setItemParaPreview(null);
    }
    setShowPreviewDialog(open);
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
    setCriticoBiblioteca({ tipo: "devolver", id: emprestimoId });
  };

  const handleReservar = (item: BibliotecaItem) => {
    if (item.tipo !== "FISICO" || item.disponivel <= 0) return;
    setItemParaReservar(item);
    setShowReservaDialog(true);
  };

  const handleConfirmarReserva = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemParaReservar) return;
    criarReservaMutation.mutate({ itemId: itemParaReservar.id }, {
      onSuccess: () => {
        setShowReservaDialog(false);
        setItemParaReservar(null);
      },
    });
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfigMutation.mutate(configForm);
  };

  const handleCancelarReserva = (id: string) => {
    setCriticoBiblioteca({ tipo: "cancelar-reserva", id });
  };

  const handlePagarMulta = (id: string) => {
    setCriticoBiblioteca({ tipo: "pagar-multa", id });
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
          <Dialog open={showPreviewDialog} onOpenChange={handleClosePreview}>
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
                    {previewLoading ? (
                      <div className="w-full h-[600px] flex items-center justify-center text-muted-foreground">
                        A carregar documento...
                      </div>
                    ) : previewBlobUrl ? (
                      <iframe
                        src={previewBlobUrl}
                        className="w-full h-[600px]"
                        title={`Preview ${itemParaPreview.titulo}`}
                      />
                    ) : null}
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
          <TabsList className="flex-wrap">
            <TabsTrigger value="acervo">Acervo</TabsTrigger>
            {(isAdmin || isSecretaria) && <TabsTrigger value="emprestimos">Empréstimos</TabsTrigger>}
            {(isProfessor || isAluno) && <TabsTrigger value="meus-emprestimos">Meus Empréstimos</TabsTrigger>}
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="multas">Multas</TabsTrigger>
            {(isAdmin || isSecretaria) && <TabsTrigger value="config">Configuração</TabsTrigger>}
            {(isAdmin || isSecretaria) && <TabsTrigger value="relatorios">Relatórios</TabsTrigger>}
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
                              <BibliotecaThumbnail
                                thumbnailUrl={item.thumbnailUrl}
                                titulo={item.titulo}
                                onPreview={() => handlePreview(item)}
                              />
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
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleEmprestimo(item)}
                                    disabled={item.tipo === 'FISICO' && item.disponivel <= 0}
                                  >
                                    Solicitar Empréstimo
                                  </Button>
                                  {item.tipo === 'FISICO' && item.disponivel > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleReservar(item)}
                                    >
                                      Reservar
                                    </Button>
                                  )}
                                </>
                              )}
                              {(isAdmin || isSecretaria) && item.tipo === 'FISICO' && item.disponivel > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReservar(item)}
                                >
                                  Reservar
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

          <TabsContent value="reservas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookMarked className="h-5 w-5" /> Reservas</CardTitle>
                <CardDescription>Suas reservas de itens da biblioteca</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingReservas ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : !reservas || reservas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma reserva encontrada
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Data Reserva</TableHead>
                        <TableHead>Expira em</TableHead>
                        <TableHead>Status</TableHead>
                        {(isAdmin || isSecretaria) && <TableHead>Usuário</TableHead>}
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservas.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.item?.titulo}</TableCell>
                          <TableCell>{new Date(r.dataReserva).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>{new Date(r.dataExpiracao).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === 'PENDENTE' ? 'default' : r.status === 'ATENDIDA' ? 'secondary' : 'outline'}>
                              {r.status === 'PENDENTE' ? 'Pendente' : r.status === 'ATENDIDA' ? 'Atendida' : r.status === 'EXPIRADA' ? 'Expirada' : 'Cancelada'}
                            </Badge>
                          </TableCell>
                          {(isAdmin || isSecretaria) && <TableCell>{r.usuario?.nomeCompleto || '-'}</TableCell>}
                          <TableCell>
                            {r.status === 'PENDENTE' && (
                              <Button size="sm" variant="outline" onClick={() => handleCancelarReserva(r.id)} disabled={cancelarReservaMutation.isPending}>
                                Cancelar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="multas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Multas</CardTitle>
                <CardDescription>Multas por atraso na devolução</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMultas ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : !multas || multas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma multa encontrada
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Dias Atraso</TableHead>
                        <TableHead>Status</TableHead>
                        {(isAdmin || isSecretaria) && <TableHead>Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {multas.map((m: any) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.emprestimo?.item?.titulo}</TableCell>
                          <TableCell>{m.emprestimo?.usuario?.nomeCompleto || '-'}</TableCell>
                          <TableCell>
                            {typeof m.valor === 'number' ? m.valor.toFixed(2) : Number(m.valor || 0).toFixed(2)} kz
                          </TableCell>
                          <TableCell>{m.diasAtraso}</TableCell>
                          <TableCell>
                            <Badge variant={m.status === 'PENDENTE' ? 'destructive' : 'secondary'}>
                              {m.status === 'PENDENTE' ? 'Pendente' : m.status === 'PAGA' ? 'Paga' : 'Isenta'}
                            </Badge>
                          </TableCell>
                          {(isAdmin || isSecretaria) && (
                            <TableCell>
                              {m.status === 'PENDENTE' && (
                                <Button size="sm" onClick={() => handlePagarMulta(m.id)} disabled={pagarMultaMutation.isPending}>
                                  Registrar Pagamento
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {(isAdmin || isSecretaria) && (
            <TabsContent value="config" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Configuração da Biblioteca</CardTitle>
                  <CardDescription>Defina limites, multas e notificações</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingConfig ? (
                    <div className="text-center py-8">Carregando...</div>
                  ) : (
                    <form onSubmit={handleSaveConfig} className="space-y-4 max-w-md">
                      <div className="space-y-2">
                        <Label>Limite de empréstimos por usuário</Label>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={configForm.limiteEmprestimosPorUsuario}
                          onChange={(e) => setConfigForm({ ...configForm, limiteEmprestimosPorUsuario: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Multa por dia de atraso (kz)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={configForm.multaPorDiaAtraso}
                          onChange={(e) => setConfigForm({ ...configForm, multaPorDiaAtraso: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Dias para notificar vencimento</Label>
                        <Input
                          type="number"
                          min={0}
                          value={configForm.diasParaNotificarVencimento}
                          onChange={(e) => setConfigForm({ ...configForm, diasParaNotificarVencimento: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Dias de validade da reserva</Label>
                        <Input
                          type="number"
                          min={1}
                          value={configForm.diasValidadeReserva}
                          onChange={(e) => setConfigForm({ ...configForm, diasValidadeReserva: parseInt(e.target.value) || 7 })}
                        />
                      </div>
                      <Button type="submit" disabled={updateConfigMutation.isPending}>
                        {updateConfigMutation.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {(isAdmin || isSecretaria) && (
            <TabsContent value="relatorios" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Relatórios</CardTitle>
                  <CardDescription>Estatísticas da biblioteca</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingRelatorios ? (
                    <div className="text-center py-8">Carregando...</div>
                  ) : !relatorios ? (
                    <div className="text-center py-8 text-muted-foreground">Nenhum dado disponível</div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Empréstimos ativos</CardDescription>
                            <CardTitle className="text-2xl">{relatorios.totalEmprestimosAtivos ?? 0}</CardTitle>
                          </CardHeader>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Empréstimos este mês</CardDescription>
                            <CardTitle className="text-2xl">{relatorios.totalEmprestimosMes ?? 0}</CardTitle>
                          </CardHeader>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Em atraso</CardDescription>
                            <CardTitle className="text-2xl text-red-600">{relatorios.emprestimosAtrasados ?? relatorios.empréstimosAtrasados ?? 0}</CardTitle>
                          </CardHeader>
                        </Card>
                      </div>
                      <div>
                        <h3 className="font-medium mb-2">Itens mais emprestados</h3>
                        {!relatorios.itensMaisEmprestados || relatorios.itensMaisEmprestados.length === 0 ? (
                          <p className="text-muted-foreground">Nenhum dado</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Título</TableHead>
                                <TableHead>Autor</TableHead>
                                <TableHead>Total empréstimos</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {relatorios.itensMaisEmprestados.map((i: any) => (
                                <TableRow key={i.id}>
                                  <TableCell className="font-medium">{i.titulo}</TableCell>
                                  <TableCell>{i.autor || '-'}</TableCell>
                                  <TableCell>{i.totalEmprestimos ?? 0}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </div>
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

        {/* Dialog de Reserva */}
        <Dialog open={showReservaDialog} onOpenChange={(open) => {
          if (!open) {
            setShowReservaDialog(false);
            setItemParaReservar(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Reserva</DialogTitle>
              <DialogDescription>
                Reservar o item: {itemParaReservar?.titulo}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleConfirmarReserva} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A reserva terá validade conforme a configuração da biblioteca. Quando o item estiver disponível, você será notificado.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowReservaDialog(false); setItemParaReservar(null); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={criarReservaMutation.isPending}>
                  {criarReservaMutation.isPending ? "Reservando..." : "Confirmar Reserva"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmacaoResponsabilidadeDialog
          open={criticoBiblioteca !== null}
          onOpenChange={(open) => {
            if (!open) setCriticoBiblioteca(null);
          }}
          title={
            criticoBiblioteca?.tipo === "devolver"
              ? "Confirmar devolução"
              : criticoBiblioteca?.tipo === "cancelar-reserva"
                ? "Cancelar reserva"
                : criticoBiblioteca?.tipo === "pagar-multa"
                  ? "Registar pagamento de multa"
                  : ""
          }
          description={
            criticoBiblioteca?.tipo === "devolver"
              ? "O exemplar voltará ao acervo disponível para novos empréstimos, segundo as regras configuradas."
              : criticoBiblioteca?.tipo === "cancelar-reserva"
                ? "A reserva deixa de estar activa e o item poderá ser atribuído a outro leitor."
                : criticoBiblioteca?.tipo === "pagar-multa"
                  ? "O valor será dado como liquidado no módulo de biblioteca e pode reflectir-se em relatórios financeiros ou de inadimplência."
                  : undefined
          }
          avisoInstitucional="Operações de circulação e cobrança de multas devem seguir o regulamento interno da biblioteca e normas de protecção de dados do leitor; excepções (isenções, renegociações) exigem autorização registada pela administração ou responsável delegado."
          pontosAtencao={
            criticoBiblioteca?.tipo === "pagar-multa"
              ? [
                  "Verifique o montante e o comprovativo ou fluxo interno antes de confirmar.",
                  "Alterações posteriores podem exigir lançamento contabilístico ou estorno formal.",
                ]
              : [
                  "A operação é imediata após confirmação bem-sucedida no servidor.",
                  "Em caso de divergência com o leitor, registe a fundamentação interna aplicável.",
                ]
          }
          confirmLabel={
            criticoBiblioteca?.tipo === "devolver"
              ? "Confirmar devolução"
              : criticoBiblioteca?.tipo === "cancelar-reserva"
                ? "Cancelar reserva"
                : criticoBiblioteca?.tipo === "pagar-multa"
                  ? "Registar pagamento"
                  : "Confirmar"
          }
          confirmVariant={criticoBiblioteca?.tipo === "cancelar-reserva" ? "destructive" : "default"}
          checkboxLabel="Confirmo que os dados estão correctos e que autorizo a operação nos termos do serviço de biblioteca."
          isLoading={
            devolverMutation.isPending ||
            cancelarReservaMutation.isPending ||
            pagarMultaMutation.isPending
          }
          onConfirm={() => {
            if (!criticoBiblioteca) return;
            if (criticoBiblioteca.tipo === "devolver") devolverMutation.mutate(criticoBiblioteca.id);
            else if (criticoBiblioteca.tipo === "cancelar-reserva")
              cancelarReservaMutation.mutate(criticoBiblioteca.id);
            else pagarMultaMutation.mutate(criticoBiblioteca.id);
          }}
        />
      </div>
    </DashboardLayout>
  );
}

