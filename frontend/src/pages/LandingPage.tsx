import { useNavigate } from "react-router-dom";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  GraduationCap, 
  Mail, 
  Phone, 
  MapPin, 
  ArrowRight,
  BookOpen,
  Users,
  Award,
  Clock,
  User
} from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const { config, loading } = useInstituicao();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center">
            <GraduationCap className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Image or Gradient */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: config?.imagem_capa_login_url 
              ? `url(${config.imagem_capa_login_url})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className={`absolute inset-0 ${config?.imagem_capa_login_url ? 'bg-gradient-to-b from-black/70 via-black/50 to-background' : 'gradient-hero'}`} />
        </div>

        {/* Header */}
        <header className="relative z-10 container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {config?.logo_url ? (
                <img 
                  src={config.logo_url} 
                  alt={config.nome_instituicao}
                  className="h-12 w-auto object-contain"
                />
              ) : (
                <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-primary-foreground" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-white">
                  {config?.nome_instituicao || 'Universidade'}
                </h1>
                <p className="text-xs text-white/70">Powered by DSICOLA</p>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/auth')}
              className="gradient-primary hover:opacity-90 transition-opacity"
            >
              Entrar no Sistema
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            {config?.logo_url && (
              <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm p-4 animate-fade-in">
                <img 
                  src={config.logo_url} 
                  alt={config.nome_instituicao}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
              {config?.nome_instituicao || 'Universidade'}
            </h2>
            
            <p className="text-xl md:text-2xl text-white/90 mb-4 animate-slide-up">
              Sistema de Gestão Acadêmica
            </p>
            
            {config?.descricao && (
              <p className="text-lg text-white/80 mb-6 max-w-2xl mx-auto animate-slide-up">
                {config.descricao}
              </p>
            )}
            
            <p className="text-base text-white/70 mb-10 max-w-2xl mx-auto animate-slide-up">
              Gerencie sua vida acadêmica de forma simples e eficiente. 
              Acesse notas, frequência, mensalidades e muito mais.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-scale-in">
              <Button 
                size="lg"
                onClick={() => navigate('/auth')}
                className="gradient-primary hover:opacity-90 transition-opacity text-lg px-8 py-6"
              >
                <GraduationCap className="mr-2 h-5 w-5" />
                Entrar no Sistema
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate('/inscricao')}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-lg px-8 py-6"
              >
                <User className="mr-2 h-5 w-5" />
                Candidatar-se
              </Button>
            </div>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="relative z-10 -mb-1">
          <svg 
            viewBox="0 0 1440 120" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="w-full"
          >
            <path 
              d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" 
              className="fill-background"
            />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-4">
            Recursos do Sistema
          </h3>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Uma plataforma completa para gestão acadêmica e administrativa
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl gradient-primary">
                  <BookOpen className="h-7 w-7 text-primary-foreground" />
                </div>
                <h4 className="font-semibold mb-2">Gestão Acadêmica</h4>
                <p className="text-sm text-muted-foreground">
                  Notas, frequência, histórico escolar e boletins em um só lugar.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl gradient-accent">
                  <Users className="h-7 w-7 text-accent-foreground" />
                </div>
                <h4 className="font-semibold mb-2">Gestão de Turmas</h4>
                <p className="text-sm text-muted-foreground">
                  Matrículas, alocações e controle completo de alunos e professores.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-warning/90">
                  <Award className="h-7 w-7 text-warning-foreground" />
                </div>
                <h4 className="font-semibold mb-2">Gestão Financeira</h4>
                <p className="text-sm text-muted-foreground">
                  Mensalidades, recibos, relatórios e controle de inadimplência.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-info">
                  <Clock className="h-7 w-7 text-info-foreground" />
                </div>
                <h4 className="font-semibold mb-2">Acesso 24/7</h4>
                <p className="text-sm text-muted-foreground">
                  Acesse o sistema a qualquer hora, de qualquer dispositivo.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      {(config?.email || config?.telefone || config?.endereco) && (
        <section className="py-20 px-4 bg-muted/50">
          <div className="container mx-auto">
            <h3 className="text-3xl font-bold text-center mb-4">
              Entre em Contato
            </h3>
            <p className="text-muted-foreground text-center mb-12">
              Estamos aqui para ajudá-lo
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {config?.email && (
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold mb-1">Email</h4>
                  <a 
                    href={`mailto:${config.email}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {config.email}
                  </a>
                </div>
              )}
              
              {config?.telefone && (
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold mb-1">Telefone</h4>
                  <a 
                    href={`tel:${config.telefone}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {config.telefone}
                  </a>
                </div>
              )}
              
              {config?.endereco && (
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold mb-1">Endereço</h4>
                  <p className="text-muted-foreground">
                    {config.endereco}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Card className="gradient-hero border-0 overflow-hidden">
            <CardContent className="py-16 px-8 text-center">
              <h3 className="text-3xl font-bold text-white mb-4">
                Pronto para começar?
              </h3>
              <p className="text-white/80 mb-8 max-w-xl mx-auto">
                Acesse o sistema agora e gerencie sua vida acadêmica de forma simples e eficiente.
              </p>
              <Button 
                size="lg"
                variant="secondary"
                onClick={() => navigate('/auth')}
                className="text-lg px-8"
              >
                Entrar no Sistema
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {config?.logo_url ? (
                <img 
                  src={config.logo_url} 
                  alt={config.nome_instituicao}
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <span className="font-semibold">{config?.nome_instituicao || 'Universidade'}</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {config?.nome_instituicao || 'Universidade'}. 
              Powered by <span className="font-semibold">DSICOLA</span>.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
