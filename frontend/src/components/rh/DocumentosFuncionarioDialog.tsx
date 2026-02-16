import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartSearch } from '@/components/common/SmartSearch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, Download, FileText, File } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { safeToFixed } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { documentosFuncionarioApi } from '@/services/api';

interface DocumentosFuncionarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario: any | null;
}

interface Documento {
  id: string;
  tipo_documento: string;
  nome_arquivo: string;
  arquivo_url: string;
  descricao: string | null;
  data_vencimento: string | null;
  tamanho_bytes: number | null;
  created_at: string;
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
      toast.error('Erro ao carregar documentos');
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
      toast.error('Selecione um arquivo e tipo de documento');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadData.file);
      formData.append('funcionarioId', funcionario.id);
      formData.append('tipoDocumento', uploadData.tipo_documento);
      if (uploadData.descricao) formData.append('descricao', uploadData.descricao);
      if (uploadData.data_vencimento) formData.append('dataVencimento', uploadData.data_vencimento);

      await documentosFuncionarioApi.upload(formData);

      toast.success('Documento enviado!');
      setUploadData({ tipo_documento: '', descricao: '', data_vencimento: '', file: null });
      setShowUploadForm(false);
      fetchDocumentos();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar documento');
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
      toast.error('Erro ao excluir documento');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${safeToFixed(bytes / 1024, 1)} KB`;
    return `${safeToFixed(bytes / (1024 * 1024), 1)} MB`;
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
                      const search = term.toLowerCase().trim();
                      return TIPOS_DOCUMENTO.filter((t) => t.toLowerCase().includes(search)).map((t) => ({
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
                {documentos.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Badge variant="outline">{doc.tipo_documento}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium truncate max-w-[200px]">{doc.nome_arquivo}</p>
                      {doc.descricao && (
                        <p className="text-xs text-muted-foreground">{doc.descricao}</p>
                      )}
                    </TableCell>
                    <TableCell>{formatFileSize(doc.tamanho_bytes)}</TableCell>
                    <TableCell>
                      {doc.data_vencimento ? (
                        <span className={new Date(doc.data_vencimento) < new Date() ? 'text-destructive' : ''}>
                          {format(new Date(doc.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(doc.arquivo_url, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(doc)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
