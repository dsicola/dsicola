import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Phone, Mail, Building } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AssinaturaExpirada() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl text-destructive">Assinatura Expirada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            A assinatura da sua instituição expirou. O acesso ao sistema está temporariamente suspenso.
          </p>
          
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="font-medium">Para reativar o acesso:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Efetue o pagamento da assinatura</li>
              <li>Envie o comprovativo para o suporte</li>
              <li>Aguarde a confirmação</li>
            </ol>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Contate a administração:</p>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>suporte@dsicola.ao</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>+244 923 456 789</span>
            </div>
          </div>

          <Button variant="outline" onClick={signOut} className="w-full">
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
