import React from 'react';
import { Building2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TenantNotFound = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Instituição não encontrada
          </h1>
          <p className="text-muted-foreground">
            O subdomínio que você está tentando acessar não corresponde a nenhuma instituição ativa na plataforma DSICOLA.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
          <p>Se você é administrador de uma instituição, entre em contato com o suporte para verificar o status da sua conta.</p>
        </div>

        <Button 
          onClick={() => window.location.href = 'https://dsicola.com'}
          className="gap-2"
        >
          <Building2 className="h-4 w-4" />
          Ir para DSICOLA
        </Button>
      </div>
    </div>
  );
};

export default TenantNotFound;
