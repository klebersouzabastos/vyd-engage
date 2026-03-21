import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Upload, X } from "lucide-react";
import { useCompany } from "../../contexts/CompanyContext";
import { resizeImage, isValidImageFile, isValidFileSize } from "../../utils/imageUtils";

export function CompanyTab() {
  const { logo, companyName, setLogo, setCompanyName } = useCompany();
  const [logoPreview, setLogoPreview] = useState<string | null>(logo);
  const [companyData, setCompanyData] = useState({
    name: companyName,
    website: "https://minhaempresa.com",
    primaryColor: "#2563EB",
  });

  useEffect(() => {
    setLogoPreview(logo);
  }, [logo]);

  useEffect(() => {
    setCompanyData(prev => ({ ...prev, name: companyName }));
  }, [companyName]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-gray-900 mb-4">Dados da Empresa</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="company-name">Nome da empresa</Label>
            <Input
              id="company-name"
              value={companyData.name}
              onChange={(e) => {
                setCompanyData({ ...companyData, name: e.target.value });
                setCompanyName(e.target.value);
              }}
              className="mt-1.5"
              placeholder="Nome da sua empresa"
            />
          </div>
          <div>
            <Label htmlFor="company-website">Website</Label>
            <Input
              id="company-website"
              defaultValue="https://minhaempresa.com"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="logo">Logo da empresa</Label>
            <div className="mt-1.5 space-y-3">
              {logoPreview && (
                <div className="relative inline-block">
                  <div className="w-32 h-32 border-2 border-gray-300 rounded-lg p-2 bg-white flex items-center justify-center">
                    <img
                      src={logoPreview}
                      alt="Logo da empresa"
                      className="max-w-full max-h-full object-contain"
                      width={128}
                      height={128}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setLogoPreview(null);
                      setLogo(null);
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (!isValidImageFile(file)) {
                      toast.error('Por favor, selecione uma imagem valida (PNG, JPG ou SVG)');
                      e.target.value = '';
                      return;
                    }

                    if (!isValidFileSize(file, 5)) {
                      toast.error('A imagem deve ter no maximo 5MB');
                      e.target.value = '';
                      return;
                    }

                    try {
                      const resizedImage = await resizeImage(file, 200, 200, 0.9);

                      if (resizedImage && resizedImage.length > 0) {
                        setLogoPreview(resizedImage);
                        setLogo(resizedImage);
                      } else {
                        toast.error('Erro ao processar a imagem. Tente novamente.');
                      }
                    } catch (error) {
                      console.error('Erro ao processar logo:', error);
                      toast.error('Erro ao processar a imagem. Tente novamente.');
                    }

                    e.target.value = '';
                  }}
                />
                <label
                  htmlFor="logo-upload"
                  className="cursor-pointer inline-block"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('logo-upload')?.click();
                  }}
                >
                  <Button variant="outline" type="button" className="gap-2">
                    <Upload size={16} />
                    {logoPreview ? "Alterar Logo" : "Upload de Logo"}
                  </Button>
                </label>
              </div>
              <p className="text-xs text-gray-600">
                Formatos aceitos: PNG, JPG, SVG. Tamanho maximo: 2MB
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-300">
        <h3 className="text-gray-900 mb-4">Cores da Marca</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="primary-color">Cor primaria</Label>
            <div className="flex items-center gap-3 mt-1.5">
              <Input
                id="primary-color"
                type="color"
                defaultValue="#2563EB"
                className="w-20 h-10 p-1"
              />
              <Input
                defaultValue="#2563EB"
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-300">
        <Button
          className="bg-primary hover:bg-primary-dark"
          onClick={() => {
            if (logoPreview && logoPreview !== logo) {
              setLogo(logoPreview);
            }
            if (companyData.name !== companyName) {
              setCompanyName(companyData.name);
            }
            toast.success("Configuracoes salvas com sucesso!");
          }}
        >
          Salvar Alteracoes
        </Button>
      </div>
    </div>
  );
}
