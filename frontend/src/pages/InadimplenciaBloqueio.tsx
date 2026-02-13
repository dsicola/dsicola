import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, LogOut, Phone, Mail } from "lucide-react";

export default function InadimplenciaBloqueio() {
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl text-destructive">
            Acesso Suspenso
          </CardTitle>
          <CardDescription className="text-base">
            Seu acesso ao sistema foi temporariamente suspenso por falta de pagamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Olá, {user?.nome_completo || "Estudante"}!</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Identificamos que você possui uma ou mais mensalidades em atraso. 
              Para garantir a continuidade dos seus estudos e acesso aos recursos do sistema, 
              regularize sua situação financeira o mais breve possível.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Como regularizar:</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Entre em contato com a secretaria financeira</li>
              <li>Efetue o pagamento das mensalidades em atraso</li>
              <li>Aguarde a confirmação (até 24 horas úteis)</li>
              <li>Seu acesso será restaurado automaticamente</li>
            </ol>
          </div>

          <div className="bg-primary/5 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">Precisa de ajuda?</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <a 
                href="tel:+244923456789" 
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Phone className="h-4 w-4" />
                +244 923 456 789
              </a>
              <a 
                href="mailto:financeiro@universidade.ao" 
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4" />
                financeiro@universidade.ao
              </a>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair do Sistema
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
