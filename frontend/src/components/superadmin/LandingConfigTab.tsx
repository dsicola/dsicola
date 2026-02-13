import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Save, RefreshCw, ExternalLink, Loader2, Palette, Eye, Image, Upload, Trash2, ImagePlus } from 'lucide-react';
import { configuracoesLandingApi, utilsApi } from '@/services/api';

interface ConfigItem {
  id: string;
  chave: string;
  valor: string | null;
  tipo: string;
  descricao: string | null;
}

const presetThemes = [
  {
    name: 'Violeta Moderno',
    primary: '#8B5CF6',
    primaryHover: '#7C3AED',
    secondary: '#1E293B',
    accent: '#06B6D4',
    heroText: '#1E293B',
    heroBg: '#F8FAFC'
  },
  {
    name: 'Azul Profissional',
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    secondary: '#0F172A',
    accent: '#10B981',
    heroText: '#0F172A',
    heroBg: '#F0F9FF'
  },
  {
    name: 'Verde Natureza',
    primary: '#059669',
    primaryHover: '#047857',
    secondary: '#1C1917',
    accent: '#F59E0B',
    heroText: '#1C1917',
    heroBg: '#F0FDF4'
  },
  {
    name: 'Laranja Energia',
    primary: '#EA580C',
    primaryHover: '#C2410C',
    secondary: '#1C1917',
    accent: '#0EA5E9',
    heroText: '#1C1917',
    heroBg: '#FFF7ED'
  },
  {
    name: 'Rosa Elegante',
    primary: '#DB2777',
    primaryHover: '#BE185D',
    secondary: '#18181B',
    accent: '#8B5CF6',
    heroText: '#18181B',
    heroBg: '#FDF2F8'
  },
  {
    name: 'Escuro Premium',
    primary: '#F59E0B',
    primaryHover: '#D97706',
    secondary: '#09090B',
    accent: '#22D3EE',
    heroText: '#FAFAFA',
    heroBg: '#18181B'
  }
];

export function LandingConfigTab() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const data = await configuracoesLandingApi.getAll();
      setConfigs(data || []);
      const initialChanges: Record<string, string> = {};
      (data || []).forEach((c: ConfigItem) => {
        initialChanges[c.chave] = c.valor || '';
      });
      setChanges(initialChanges);
    } catch (error) {
      toast({ title: 'Erro ao carregar configurações', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleChange = (chave: string, valor: string) => {
    setChanges(prev => ({ ...prev, [chave]: valor }));
  };

  const handleImageUpload = async (chave: string, file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Apenas imagens são permitidas', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande. Máximo 5MB.', variant: 'destructive' });
      return;
    }

    setUploading(chave);

    try {
      // Convert file to base64 for API upload
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          // For now, use the base64 data directly as URL (can be updated to use actual file upload endpoint)
          handleChange(chave, base64Data);
          toast({ title: 'Imagem carregada com sucesso!' });
        } catch (error: any) {
          console.error('Upload error:', error);
          toast({ title: 'Erro ao carregar imagem', description: error.message, variant: 'destructive' });
        } finally {
          setUploading(null);
        }
      };
      reader.onerror = () => {
        toast({ title: 'Erro ao ler arquivo', variant: 'destructive' });
        setUploading(null);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: 'Erro ao carregar imagem', description: error.message, variant: 'destructive' });
      setUploading(null);
    }
  };

  const handleRemoveImage = async (chave: string) => {
    handleChange(chave, '');
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      for (const config of configs) {
        if (changes[config.chave] !== config.valor) {
          await configuracoesLandingApi.update(config.chave, { valor: changes[config.chave] });
        }
      }
      
      toast({ title: 'Configurações salvas com sucesso!' });
      fetchConfigs();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (preset: typeof presetThemes[0]) => {
    setChanges(prev => ({
      ...prev,
      cor_primaria: preset.primary,
      cor_primaria_hover: preset.primaryHover,
      cor_secundaria: preset.secondary,
      cor_accent: preset.accent,
      cor_texto_hero: preset.heroText,
      cor_fundo_hero: preset.heroBg
    }));
    toast({ title: `Tema "${preset.name}" aplicado!`, description: 'Clique em Salvar para confirmar.' });
  };

  const hasChanges = configs.some(c => changes[c.chave] !== c.valor);

  const getLabel = (chave: string) => {
    const labels: Record<string, string> = {
      hero_badge: 'Badge do Hero',
      hero_titulo: 'Título Principal',
      hero_subtitulo: 'Subtítulo',
      dias_teste: 'Dias de Teste Grátis',
      contato_email: 'Email de Contato',
      contato_telefone: 'Telefone',
      contato_whatsapp: 'WhatsApp',
      rodape_texto: 'Texto do Rodapé',
      mostrar_precos: 'Mostrar Preços',
      cor_primaria: 'Cor Primária',
      cor_primaria_hover: 'Cor Primária (Hover)',
      cor_secundaria: 'Cor Secundária',
      cor_accent: 'Cor de Destaque',
      cor_texto_hero: 'Cor do Texto Hero',
      cor_fundo_hero: 'Cor de Fundo Hero',
      gradiente_ativo: 'Usar Gradiente',
      logo_principal: 'Logo Principal',
      logo_icone: 'Ícone da Marca',
      hero_imagem_fundo: 'Imagem de Fundo Hero',
      imagem_demo: 'Imagem de Demonstração',
    };
    return labels[chave] || chave;
  };

  const colorConfigs = configs.filter(c => c.tipo === 'color');
  const imageConfigs = configs.filter(c => c.tipo === 'image');
  const otherConfigs = configs.filter(c => 
    c.tipo !== 'color' && 
    c.tipo !== 'image' && 
    !c.chave.startsWith('hero') && 
    !c.chave.startsWith('contato') && 
    c.chave !== 'gradiente_ativo'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Configurações da Landing Page</h2>
          <p className="text-muted-foreground">Personalize o conteúdo, cores e imagens da página de vendas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('/vendas', '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver Página
          </Button>
          <Button variant="outline" onClick={fetchConfigs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Recarregar
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </div>

      <Card className="border-2 border-blue-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Image className="h-5 w-5 text-blue-500" />
            <CardTitle>Imagens e Logos</CardTitle>
          </div>
          <CardDescription>Faça upload das imagens da sua landing page</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {imageConfigs.map(config => (
              <div key={config.chave} className="space-y-3">
                <Label className="text-sm font-medium">{getLabel(config.chave)}</Label>
                <p className="text-xs text-muted-foreground">{config.descricao}</p>
                
                <div className="relative">
                  {changes[config.chave] ? (
                    <div className="relative group">
                      <div className="aspect-video rounded-lg border-2 border-border overflow-hidden bg-muted">
                        <img 
                          src={changes[config.chave]} 
                          alt={getLabel(config.chave)}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => fileInputRefs.current[config.chave]?.click()}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoveImage(config.chave)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRefs.current[config.chave]?.click()}
                      disabled={uploading === config.chave}
                      className="w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
                    >
                      {uploading === config.chave ? (
                        <Loader2 className="h-8 w-8 animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="h-8 w-8" />
                          <span className="text-xs">Clique para carregar</span>
                        </>
                      )}
                    </button>
                  )}
                  
                  <input
                    ref={el => fileInputRefs.current[config.chave] = el}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(config.chave, file);
                      e.target.value = '';
                    }}
                  />
                </div>

                <Input
                  value={changes[config.chave] || ''}
                  onChange={e => handleChange(config.chave, e.target.value)}
                  placeholder="Ou cole uma URL de imagem..."
                  className="text-xs"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Tema de Cores</CardTitle>
          </div>
          <CardDescription>Personalize as cores da landing page ou escolha um tema predefinido</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm font-medium mb-3 block">Temas Predefinidos</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {presetThemes.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="group p-3 rounded-lg border-2 border-border hover:border-primary transition-all text-left"
                >
                  <div className="flex gap-1 mb-2">
                    <div 
                      className="w-6 h-6 rounded-full shadow-sm" 
                      style={{ backgroundColor: preset.primary }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full shadow-sm" 
                      style={{ backgroundColor: preset.secondary }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full shadow-sm" 
                      style={{ backgroundColor: preset.accent }}
                    />
                  </div>
                  <span className="text-xs font-medium group-hover:text-primary transition-colors">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-3 block">Cores Personalizadas</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {colorConfigs.map(config => (
                <div key={config.chave} className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{getLabel(config.chave)}</Label>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-10 h-10 rounded-lg border-2 border-border shadow-inner cursor-pointer overflow-hidden"
                      style={{ backgroundColor: changes[config.chave] || '#8B5CF6' }}
                    >
                      <input
                        type="color"
                        value={changes[config.chave] || '#8B5CF6'}
                        onChange={e => handleChange(config.chave, e.target.value)}
                        className="w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                    <Input
                      value={changes[config.chave] || ''}
                      onChange={e => handleChange(config.chave, e.target.value)}
                      className="font-mono text-xs h-10"
                      placeholder="#RRGGBB"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {configs.find(c => c.chave === 'gradiente_ativo') && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <Label className="text-sm font-medium">Usar Gradiente no Hero</Label>
                <p className="text-xs text-muted-foreground">Aplica um gradiente suave na seção principal</p>
              </div>
              <Switch
                checked={changes['gradiente_ativo'] === 'true'}
                onCheckedChange={checked => handleChange('gradiente_ativo', checked ? 'true' : 'false')}
              />
            </div>
          )}

          <div className="p-4 rounded-lg border-2 border-dashed border-border">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Pré-visualização</span>
            </div>
            <div 
              className="rounded-lg p-6 transition-all"
              style={{ 
                backgroundColor: changes['cor_fundo_hero'] || '#F8FAFC',
                background: changes['gradiente_ativo'] === 'true' 
                  ? `linear-gradient(135deg, ${changes['cor_primaria'] || '#8B5CF6'}15, ${changes['cor_fundo_hero'] || '#F8FAFC'})`
                  : changes['cor_fundo_hero'] || '#F8FAFC'
              }}
            >
              <div className="max-w-md mx-auto text-center">
                {changes['logo_principal'] && (
                  <img 
                    src={changes['logo_principal']} 
                    alt="Logo Preview" 
                    className="h-12 mx-auto mb-4 object-contain"
                  />
                )}
                <h3 
                  className="text-2xl font-bold mb-2"
                  style={{ color: changes['cor_texto_hero'] || '#1E293B' }}
                >
                  {changes['hero_titulo'] || 'Título do Hero'}
                </h3>
                <p 
                  className="text-sm mb-4 opacity-80"
                  style={{ color: changes['cor_texto_hero'] || '#1E293B' }}
                >
                  {changes['hero_subtitulo'] || 'Subtítulo descritivo da página'}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                    style={{ 
                      backgroundColor: changes['cor_primaria'] || '#8B5CF6',
                    }}
                  >
                    Botão Primário
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors"
                    style={{ 
                      borderColor: changes['cor_primaria'] || '#8B5CF6',
                      color: changes['cor_primaria'] || '#8B5CF6',
                    }}
                  >
                    Botão Secundário
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conteúdo do Hero</CardTitle>
          <CardDescription>Textos principais da landing page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {configs.filter(c => c.chave.startsWith('hero')).map(config => (
            <div key={config.chave} className="space-y-2">
              <Label>{getLabel(config.chave)}</Label>
              {config.tipo === 'textarea' ? (
                <Textarea
                  value={changes[config.chave] || ''}
                  onChange={e => handleChange(config.chave, e.target.value)}
                  placeholder={config.descricao || ''}
                />
              ) : (
                <Input
                  value={changes[config.chave] || ''}
                  onChange={e => handleChange(config.chave, e.target.value)}
                  placeholder={config.descricao || ''}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações de Contato</CardTitle>
          <CardDescription>Dados de contato exibidos na landing page</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {configs.filter(c => c.chave.startsWith('contato')).map(config => (
            <div key={config.chave} className="space-y-2">
              <Label>{getLabel(config.chave)}</Label>
              <Input
                value={changes[config.chave] || ''}
                onChange={e => handleChange(config.chave, e.target.value)}
                placeholder={config.descricao || ''}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {otherConfigs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Outras Configurações</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherConfigs.map(config => (
              <div key={config.chave} className="space-y-2">
                <Label>{getLabel(config.chave)}</Label>
                {config.tipo === 'boolean' ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={changes[config.chave] === 'true'}
                      onCheckedChange={checked => handleChange(config.chave, checked ? 'true' : 'false')}
                    />
                    <span className="text-sm text-muted-foreground">{config.descricao}</span>
                  </div>
                ) : (
                  <Input
                    value={changes[config.chave] || ''}
                    onChange={e => handleChange(config.chave, e.target.value)}
                    placeholder={config.descricao || ''}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
