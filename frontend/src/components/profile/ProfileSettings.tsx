import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { profilesApi, storageApi, authApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { User, Camera, Mail, Phone, Lock, Save, Loader2 } from "lucide-react";
import { PasswordStrengthIndicator, isPasswordStrong, requiresStrongPassword } from "@/components/auth/PasswordStrengthIndicator";
import { SidebarSettings } from "@/components/layout/SidebarSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettings({ open, onOpenChange }: ProfileSettingsProps) {
  const { user, role, user: userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const justOpenedRef = React.useRef(false);
  
  // Obter todas as roles do usuário (se disponível) ou usar a role principal
  const userRoles = userProfile?.roles || (role ? [role] : []);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [email, setEmail] = useState(user?.email || "");
  const [telefone, setTelefone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Evitar fechamento imediato ao abrir (evento interact/pointer outside propagado)
  // CRÍTICO: setar ref SINCRONAMENTE no render para estar pronto antes de qualquer handler
  if (open) justOpenedRef.current = true;
  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => { justOpenedRef.current = false; }, 400);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Fetch current profile data
  React.useEffect(() => {
    const fetchProfile = async () => {
      if (user?.id && open) {
        try {
          const data = await profilesApi.getById(user.id);
          if (data) {
            setTelefone(data.telefone || "");
            setEmail(data.email || user.email || "");
            if (data.avatarUrl) {
              setAvatarPreview(data.avatarUrl);
            }
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      }
    };
    fetchProfile();
  }, [user?.id, open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error("A imagem deve ter no máximo 3MB");
        return;
      }
      if (!file.type.includes("jpeg") && !file.type.includes("jpg") && !file.type.includes("png")) {
        toast.error("Apenas imagens JPEG e PNG são permitidas");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      let avatarUrl = avatarPreview;

      // Upload new avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const filePath = `${user.id}/avatar.${fileExt}`;

        const uploadResult = await storageApi.upload("avatars", filePath, avatarFile);
        if (uploadResult?.publicUrl) {
          avatarUrl = uploadResult.publicUrl;
        }
      }

      // Update profile
      await profilesApi.update(user.id, {
        telefone,
        avatarUrl: avatarUrl || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado com sucesso!");
      setAvatarFile(null);
    } catch (error: any) {
      toast.error("Erro ao atualizar perfil: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos de senha");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    // Validar senha forte se necessário baseado nas roles do usuário
    const needsStrongPassword = requiresStrongPassword(userRoles.length > 0 ? userRoles : undefined);
    if (!isPasswordStrong(newPassword, false, userRoles.length > 0 ? userRoles : undefined)) {
      if (needsStrongPassword) {
        toast.error("A senha deve conter pelo menos uma letra maiúscula e um caractere especial.");
      } else {
        toast.error("A senha deve ter no mínimo 6 caracteres");
      }
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setIsLoading(true);
    try {
      await authApi.updatePassword(currentPassword, newPassword);

      toast.success("Senha alterada com sucesso! Redirecionando para login...");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
      await signOut();
      navigate('/auth');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao alterar senha";
      toast.error("Erro ao alterar senha: " + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          if (justOpenedRef.current) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (justOpenedRef.current) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          if (justOpenedRef.current) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Configurações do Perfil</DialogTitle>
          <DialogDescription>
            Atualize suas informações pessoais e credenciais
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="perfil" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="sidebar">Sidebar</TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="space-y-6 py-4">
            {/* Avatar Section */}
            <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-muted">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback className="bg-muted">
                  <User className="h-12 w-12 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="profile-avatar-upload"
                className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors shadow-lg"
              >
                <Camera className="h-4 w-4" />
              </label>
              <input
                id="profile-avatar-upload"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <div>
              <p className="font-medium">{user?.nome_completo}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    placeholder="seu@email.com"
                    disabled
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-telefone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="pl-10"
                    placeholder="(+244) XXX-XXX-XXX"
                  />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alterar Senha</CardTitle>
              <CardDescription>
                Defina uma nova senha para sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Senha Atual</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pl-10"
                    placeholder="Digite sua senha atual"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                {newPassword && (
                  <PasswordStrengthIndicator 
                    password={newPassword} 
                    userRole={userRoles.length > 0 ? userRoles : undefined}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    placeholder="Confirme a nova senha"
                  />
                </div>
              </div>
              <Button 
                onClick={handleChangePassword} 
                disabled={
                  isLoading || 
                  !currentPassword ||
                  !newPassword || 
                  !confirmPassword ||
                  (!isPasswordStrong(newPassword, false, userRoles.length > 0 ? userRoles : undefined))
                } 
                variant="outline"
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Alterar Senha
              </Button>
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="sidebar" className="py-4">
            <SidebarSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
