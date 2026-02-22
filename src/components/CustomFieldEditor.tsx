import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CustomField } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { CustomFieldInput } from "./CustomFieldInput";

interface CustomFieldEditorProps {
  field?: CustomField;
  open?: boolean;
  onClose?: () => void;
  onSave: (field: Omit<CustomField, "id">) => void;
  inline?: boolean;
}

export function CustomFieldEditor({
  field,
  open = true,
  onClose,
  onSave,
  inline = false,
}: CustomFieldEditorProps) {
  const [formData, setFormData] = useState({
    name: field?.name || "",
    type: field?.type || "text" as CustomField["type"],
    required: field?.required || false,
    options: field?.options || [] as string[],
    defaultValue: field?.defaultValue || "",
  });
  const [newOption, setNewOption] = useState("");

  // Reset form when field changes
  useEffect(() => {
    setFormData({
      name: field?.name || "",
      type: field?.type || "text",
      required: field?.required || false,
      options: field?.options || [],
      defaultValue: field?.defaultValue || "",
    });
    setNewOption("");
  }, [field]);

  const handleAddOption = () => {
    if (newOption.trim() && !formData.options.includes(newOption.trim())) {
      setFormData({
        ...formData,
        options: [...formData.options, newOption.trim()],
      });
      setNewOption("");
    }
  };

  const handleRemoveOption = (option: string) => {
    setFormData({
      ...formData,
      options: formData.options.filter((o) => o !== option),
    });
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("O nome do campo é obrigatório");
      return;
    }

    const fieldData: Omit<CustomField, "id"> = {
      name: formData.name.trim(),
      type: formData.type,
      required: formData.required,
      options: formData.type === "select" ? formData.options : undefined,
      defaultValue: formData.defaultValue || undefined,
    };

    onSave(fieldData);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      name: field?.name || "",
      type: field?.type || "text",
      required: field?.required || false,
      options: field?.options || [],
      defaultValue: field?.defaultValue || "",
    });
    setNewOption("");
    onClose?.();
  };

  const formContent = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="field-name">Nome do Campo</Label>
        <Input
          id="field-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Ex: Valor do Contrato, Data de Vencimento, etc."
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="field-type">Tipo</Label>
        <Select
          value={formData.type}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              type: value as CustomField["type"],
              options: value === "select" ? formData.options : [],
            })
          }
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Texto</SelectItem>
            <SelectItem value="number">Número</SelectItem>
            <SelectItem value="date">Data</SelectItem>
            <SelectItem value="textarea">Texto Longo</SelectItem>
            <SelectItem value="select">Seleção</SelectItem>
            <SelectItem value="checkbox">Checkbox</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.type === "select" && (
        <div>
          <Label>Opções</Label>
          <div className="mt-1.5 space-y-2">
            <div className="flex gap-2">
              <Input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Adicionar opção..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddOption();
                  }
                }}
              />
              <Button type="button" onClick={handleAddOption} size="sm">
                Adicionar
              </Button>
            </div>
            {formData.options.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg bg-gray-100">
                {formData.options.map((option) => (
                  <span
                    key={option}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-sm"
                  >
                    {option}
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(option)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="field-required"
          checked={formData.required}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, required: !!checked })
          }
        />
        <Label htmlFor="field-required" className="font-normal cursor-pointer">
          Campo obrigatório
        </Label>
      </div>

      {/* Preview */}
      <div className="pt-4 border-t border-gray-300">
        <Label className="text-sm text-gray-600">Preview</Label>
        <div className="mt-2 p-4 bg-gray-100 rounded-lg border border-gray-300">
          <CustomFieldInput
            field={{
              id: "preview",
              name: formData.name || "Nome do Campo",
              type: formData.type,
              required: formData.required,
              options: formData.type === "select" ? formData.options : undefined,
            }}
            value={formData.defaultValue}
            onChange={() => {}}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-gray-300">
        {onClose && (
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button onClick={handleSave} className="flex-1 bg-primary hover:bg-primary-dark">
          {field ? "Salvar" : "Criar"}
        </Button>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">
            {field ? "Editar Campo Customizado" : "Novo Campo Customizado"}
          </h3>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {formContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {field ? "Editar Campo Customizado" : "Novo Campo Customizado"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
          {formContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}

