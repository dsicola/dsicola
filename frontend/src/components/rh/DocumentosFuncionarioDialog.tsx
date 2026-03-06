import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartSearch } from '@/components/common/SmartSearch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Upload, Trash2, Download, FileText, File, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiErrors';
import { format } from 'date-fns';
import { safeToFixed } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { documentosFuncionarioApi, storageApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface DocumentosFuncionarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario: any | null;
}

interface Documento {
  id: string;
  tipo_documento?: string;
  tipoDocumento?: string;
  nome_arquivo?: string;
  nomeArquivo?: string;
  arquivo_url?: string;
  arquivoUrl?: string;
  descricao: string | null;
  data_vencimento?: string | null;
  dataVencimento?: string | null;
  tamanho_bytes?: number | null;
  tamanhoBytes?: number | null;
  created_at?: string;
  createdAt?: string;
}

const TIPOS_DOCUMENTO = [
  'Bilhete de Identidade',
  'Contrato de Trabalho',
  'Certificado Académico',
  'Declaração',
  'Atestado Médico',
  'Currículo',
  'Outro',
];

export const DocumentosFuncionarioDialog: React.FC<DocumentosFuncionarioDialogProps> = ({
  open,
  onOpenChange,
  funcionario,
}) => {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  
  const [uploadData, setUploadData] = useState({
    tipo_documento: '',
    descricao: '',
    data_vencimento: '',
    file: null as File | null,
  });

  useEffect(() => {
    if (open && funcionario) {
      fetchDocumentos();
    }
  }, [open, funcionario]);

  const fetchDocumentos = async () => {
    if (!funcionario) return;
    
    setIsLoading(true);
    try {
      const data = await documentosFuncionarioApi.getAll({ funcionarioId: funcionario.id });
      setDocumentos(data);
    } catch (error) {
      console.error('Error fetching documentos:', error);
      toast.error(getApiErrorMessage(error, 'Não foi possível carregar os documentos. Tente novamente.'));
    }
    setIsLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadData(prev => ({ ...prev, file }));
    }
  };

  const handleUpload = async () => {
    if (!uploadData.file || !uploadData.tipo_documento || !funcionario) {
      toast.error('Selecione um ficheiro e o tipo de documento.');
      return;
    }

    if (uploadData.file.size > 10 * 1024 * 1024) {
      toast.error('O ficheiro deve ter no máximo 10MB.');
      return;
    }

    setIsUploading(true);

    try {
      // 1. Upload do ficheiro para o storage
      const storageResult = await storageApi.upload(
        'documentos_funcionarios',
        `${funcionario.id}/${Date.now()}_${uploadData.file.name}`,
        uploadData.file
      );
      const base = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');
      const arquivoUrl = storageResult.url
        ? `${base}${storageResult.url.startsWith('/') ? storageResult.url : `/${storageResult.url}`}`
        : `${base}/uploads/documentos_funcionarios/${storageResult.path}`;

      // 2. Criar registo do documento na base de dados
      await documentosFuncionarioApi.create({
        funcionarioId: funcionario.id,
        tipoDocumento: uploadData.tipo_documento,
        nomeArquivo: uploadData.file.name,
        arquivoUrl,
        tamanhoBytes: uploadData.file.size,
        descricao: uploadData.descricao || undefined,
        dataVencimento: uploadData.data_vencimento || undefined,
        uploadedBy: user?.id,
      });

      toast.success('Documento enviado!');
      setUploadData({ tipo_documento: '', descricao: '', data_vencimento: '', file: null });
      setShowUploadForm(false);
      fetchDocumentos();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(getApiErrorMessage(error, 'Não foi possível enviar o documento. Tente novamente.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (doc: Documento) => {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;

    try {
      await documentosFuncionarioApi.delete(doc.id);
      toast.success('Documento excluído');
      fetchDocumentos();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível excluir o documento. Tente novamente.'));
    }
  };

  const handleViewDocument = async (doc: Documento) => {
    try {
      const url = await documentosFuncionarioApi.getArquivoUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível abrir o documento.'));
    }
  };

  const handleDownloadDocument = async (doc: Documento) => {
    try {
      const url = await documentosFuncionarioApi.getArquivoDownloadUrl(doc.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.nome_arquivo ?? doc.nomeArquivo ?? 'documento';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível descarregar o documento.'));
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${safeToFixed(bytes / 1024, 1)} KB`;
    return `${safeToFixed(bytes / (1024 * 1024), 1)} MB`;
  };

  const formatDateSafe = (value: string | null | undefined): string => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  };

  if (!funcionario) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos de {funcionario.profiles?.nome_completo}
          </DialogTitle>
          <DialogDescription>
            Gerencie os documentos pessoais e contratuais
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Form */}
          {showUploadForm ? (
            <div className="p-4 border rounded-lg space-y-4">
              <h3 className="font-medium">Enviar Novo Documento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Documento *</Label>
                  <SmartSearch
                    placeholder="Digite para buscar tipo (BI, contrato, atestado...)"
                    value={uploadData.tipo_documento}
                    selectedId={uploadData.tipo_documento || undefined}
                    onSelect={(item) => setUploadData((prev) => ({ ...prev, tipo_documento: item ? item.id : '' }))}
                    onClear={() => setUploadData((prev) => ({ ...prev, tipo_documento: '' }))}
                    searchFn={async (term) => {
                      const search = String(term ?? "").toLowerCase().trim();
                      return TIPOS_DOCUMENTO.filter((t) => String(t ?? "").toLowerCase().includes(search)).map((t) => ({
                        id: t,
                        nome: t,
                        nomeCompleto: t,
                      }));
                    }}
                    minSearchLength={0}
                    maxResults={8}
                    emptyMessage="Nenhum tipo encontrado"
                    silent
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Vencimento</Label>
                  <Input
                    type="date"
                    value={uploadData.data_vencimento}
                    onChange={(e) => setUploadData(prev => ({ ...prev, data_vencimento: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={uploadData.descricao}
                    onChange={(e) => setUploadData(prev => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Arquivo *</Label>
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: PDF, DOC, DOCX, JPG, PNG
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowUploadForm(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpload} disabled={isUploading}>
                  {isUploading ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowUploadForm(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Enviar Documento
            </Button>
          )}

          {/* Documents List */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando documentos...
            </div>
          ) : documentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum documento cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Data Upload</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentos.map((doc) => {
                  const tipoDoc = doc.tipo_documento ?? doc.tipoDocumento ?? '-';
                  const nomeArq = doc.nome_arquivo ?? doc.nomeArquivo ?? '-';
                  const tamanho = doc.tamanho_bytes ?? doc.tamanhoBytes ?? null;
                  const dataVenc = doc.data_vencimento ?? doc.dataVencimento ?? null;
                  const created = doc.created_at ?? doc.createdAt ?? null;
                  const arquivoUrl = doc.arquivo_url ?? doc.arquivoUrl ?? '';
                  return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Badge variant="outline">{tipoDoc}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium truncate max-w-[200px]">{nomeArq}</p>
                      {doc.descricao && (
                        <p className="text-xs text-muted-foreground">{doc.descricao}</p>
                      )}
                    </TableCell>
                    <TableCell>{formatFileSize(tamanho)}</TableCell>
                    <TableCell>
                      {dataVenc ? (
                        <span className={(() => {
                          const d = new Date(dataVenc);
                          return !Number.isNaN(d.getTime()) && d < new Date() ? 'text-destructive' : '';
                        })()}>
                          {formatDateSafe(dataVenc)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {formatDateSafe(created)}
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <div className="flex justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleViewDocument(doc)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Visualizar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleDownloadDocument(doc)}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Descarregar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );})}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
