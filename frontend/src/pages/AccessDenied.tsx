import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldX, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const AccessDenied: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleGoToLogin = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <div className="h-20 w-20 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
          <p className="text-muted-foreground max-w-md">
            Seu papel de usuário não foi reconhecido ou você não tem permissão para acessar esta área.
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={handleGoToLogin}>
            Voltar ao Login
          </Button>
          <Button onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
