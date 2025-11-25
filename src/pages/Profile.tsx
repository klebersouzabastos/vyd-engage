import { useState, useEffect } from "react";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { Card } from "../components/ui/card";
import { Camera, Save, X } from "lucide-react";

const defaultProfileData = {
  name: "João Silva",
  email: "joao@empresa.com",
  phone: "(11) 99999-9999",
  company: "Empresa Exemplo",
  role: "Gerente de Vendas",
  bio: "Especialista em gestão de leads e automações de marketing.",
  location: "São Paulo, SP",
  website: "https://www.exemplo.com",
  linkedin: "joao-silva",
  twitter: "@joaosilva",
  avatar: null as string | null,
};

export function Profile() {
  // Carregar dados salvos do localStorage ao montar o componente
  const [profileData, setProfileData] = useState(() => {
    const saved = localStorage.getItem("userProfile");
    const savedAvatar = localStorage.getItem("userAvatar");
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultProfileData, ...parsed, avatar: savedAvatar };
      } catch (error) {
        console.error("Erro ao carregar perfil do localStorage:", error);
        return { ...defaultProfileData, avatar: savedAvatar };
      }
    }
    return { ...defaultProfileData, avatar: savedAvatar };
  });

  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione uma imagem válida');
        return;
      }
      
      // Validar tamanho (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarPreview(result);
        setProfileData((prev) => ({ ...prev, avatar: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    try {
      // Salvar dados do perfil no localStorage
      const { avatar, ...profileWithoutAvatar } = profileData;
      localStorage.setItem("userProfile", JSON.stringify(profileWithoutAvatar));
      
      // Salvar avatar separadamente (pode ser grande)
      if (profileData.avatar || avatarPreview) {
        const avatarToSave = profileData.avatar || avatarPreview;
        if (avatarToSave) {
          localStorage.setItem("userAvatar", avatarToSave);
          setProfileData((prev) => ({ ...prev, avatar: avatarToSave }));
          setAvatarPreview(null); // Limpar preview após salvar
        }
      } else {
        localStorage.removeItem("userAvatar");
      }
      
      console.log("Perfil salvo com sucesso!");
      setIsEditing(false);
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      if (error instanceof DOMException && error.code === 22) {
        alert('A foto é muito grande. Tente uma imagem menor.');
      } else {
        alert('Erro ao salvar perfil. Tente novamente.');
      }
    }
  };

  const handleCancel = () => {
    // Recarregar dados salvos do localStorage
    const saved = localStorage.getItem("userProfile");
    const savedAvatar = localStorage.getItem("userAvatar");
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProfileData({ ...defaultProfileData, ...parsed, avatar: savedAvatar });
        setAvatarPreview(savedAvatar);
      } catch (error) {
        console.error("Erro ao recarregar perfil:", error);
        setProfileData(defaultProfileData);
        setAvatarPreview(null);
      }
    } else {
      setProfileData(defaultProfileData);
      setAvatarPreview(null);
    }
    
    setIsEditing(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen">
      <Header title="Perfil" subtitle="Gerencie suas informações pessoais" />
      
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header Card */}
          <Card className="bg-white border-[#E5E7EB] shadow-sm mb-6">
            <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative">
                <Avatar className="w-20 h-20 border-2 border-white shadow-md">
                  {profileData.avatar || avatarPreview ? (
                    <AvatarImage 
                      src={profileData.avatar || avatarPreview || undefined} 
                      alt={profileData.name}
                    />
                  ) : null}
                  <AvatarFallback className="bg-[#2563EB] text-white text-xl font-semibold">
                    {getInitials(profileData.name)}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 w-7 h-7 bg-[#2563EB] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#1E40AF] transition-colors shadow-md border-2 border-white"
                  >
                    <Camera size={14} className="text-white" />
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                )}
              </div>
              
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-[#1F2937] mb-1">
                  {profileData.name}
                </h2>
                <p className="text-[#6B7280] mb-2">{profileData.role}</p>
                <p className="text-sm text-[#6B7280]">{profileData.company}</p>
                {profileData.bio && (
                  <p className="text-sm text-[#6B7280] mt-3">{profileData.bio}</p>
                )}
              </div>

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      className="gap-2"
                    >
                      <X size={16} />
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSave}
                      className="bg-[#2563EB] hover:bg-[#1E40AF] gap-2"
                    >
                      <Save size={16} />
                      Salvar
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="bg-[#2563EB] hover:bg-[#1E40AF]"
                  >
                    Editar Perfil
                  </Button>
                )}
              </div>
            </div>
            </div>
          </Card>

          {/* Profile Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card className="bg-white border-[#E5E7EB] shadow-sm">
              <div className="p-6">
              <h3 className="text-lg font-semibold text-[#1F2937] mb-4">
                Informações Pessoais
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="location">Localização</Label>
                  <Input
                    id="location"
                    value={profileData.location}
                    onChange={(e) => handleInputChange("location", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Cidade, Estado"
                    className="mt-1.5"
                  />
                </div>
              </div>
              </div>
            </Card>

            {/* Professional Information */}
            <Card className="bg-white border-[#E5E7EB] shadow-sm">
              <div className="p-6">
              <h3 className="text-lg font-semibold text-[#1F2937] mb-4">
                Informações Profissionais
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="company">Empresa</Label>
                  <Input
                    id="company"
                    value={profileData.company}
                    onChange={(e) => handleInputChange("company", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="role">Cargo</Label>
                  <Input
                    id="role"
                    value={profileData.role}
                    onChange={(e) => handleInputChange("role", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={profileData.website}
                    onChange={(e) => handleInputChange("website", e.target.value)}
                    disabled={!isEditing}
                    placeholder="https://www.exemplo.com"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="bio">Biografia</Label>
                  <Textarea
                    id="bio"
                    value={profileData.bio}
                    onChange={(e) => handleInputChange("bio", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Conte um pouco sobre você..."
                    className="mt-1.5"
                    rows={4}
                  />
                </div>
              </div>
              </div>
            </Card>

            {/* Social Media */}
            <Card className="bg-white border-[#E5E7EB] shadow-sm">
              <div className="p-6">
              <h3 className="text-lg font-semibold text-[#1F2937] mb-4">
                Redes Sociais
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    value={profileData.linkedin}
                    onChange={(e) => handleInputChange("linkedin", e.target.value)}
                    disabled={!isEditing}
                    placeholder="seu-perfil-linkedin"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="twitter">Twitter</Label>
                  <Input
                    id="twitter"
                    value={profileData.twitter}
                    onChange={(e) => handleInputChange("twitter", e.target.value)}
                    disabled={!isEditing}
                    placeholder="@seu-usuario"
                    className="mt-1.5"
                  />
                </div>
              </div>
              </div>
            </Card>

            {/* Password Security */}
            <Card className="bg-white border-[#E5E7EB] shadow-sm">
              <div className="p-6">
              <h3 className="text-lg font-semibold text-[#1F2937] mb-4">
                Segurança e Senha
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="current-password">Senha atual</Label>
                  <Input
                    id="current-password"
                    type="password"
                    disabled={!isEditing}
                    placeholder="Digite sua senha atual"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    disabled={!isEditing}
                    placeholder="Digite sua nova senha"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-[#6B7280] mt-1.5">
                    A senha deve ter pelo menos 8 caracteres
                  </p>
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    disabled={!isEditing}
                    placeholder="Confirme sua nova senha"
                    className="mt-1.5"
                  />
                </div>
                {!isEditing && (
                  <p className="text-sm text-[#6B7280] pt-2">
                    Clique em "Editar Perfil" para alterar sua senha
                  </p>
                )}
              </div>
              </div>
            </Card>

            {/* Account Statistics */}
            <Card className="bg-white border-[#E5E7EB] shadow-sm">
              <div className="p-6">
              <h3 className="text-lg font-semibold text-[#1F2937] mb-4">
                Estatísticas da Conta
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                  <span className="text-sm text-[#6B7280]">Leads criados</span>
                  <span className="text-lg font-semibold text-[#1F2937]">142</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                  <span className="text-sm text-[#6B7280]">Automações ativas</span>
                  <span className="text-lg font-semibold text-[#1F2937]">8</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                  <span className="text-sm text-[#6B7280]">Membro desde</span>
                  <span className="text-lg font-semibold text-[#1F2937]">Jan 2024</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                  <span className="text-sm text-[#6B7280]">Plano</span>
                  <span className="text-lg font-semibold text-[#2563EB]">Premium</span>
                </div>
              </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

