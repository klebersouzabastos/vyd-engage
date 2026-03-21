import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { AutomationBuilder } from "../components/automations/AutomationBuilder";
import {
  automationToFlow,
  createDefaultFlow,
} from "../utils/automationFlowConverter";
import type { FlowData } from "../utils/automationFlowConverter";
import { apiClient } from "../services/api/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function AutomationBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Automation data
  const [automationName, setAutomationName] = useState("Nova Automação");
  const [automationDescription, setAutomationDescription] = useState("");
  const [automationActive, setAutomationActive] = useState(false);
  const [flowData, setFlowData] = useState<FlowData | null>(
    isNew ? createDefaultFlow() : null
  );

  useEffect(() => {
    if (!isNew && id) {
      loadAutomation(id);
    }
  }, [id, isNew]);

  const loadAutomation = async (automationId: string) => {
    setLoading(true);
    try {
      const result = await apiClient.getAutomation(automationId);
      const automation: any = result?.data || result;

      setAutomationName(automation.name || "");
      setAutomationDescription(automation.description || "");
      setAutomationActive(automation.status === "ACTIVE");

      // Convert existing automation to flow format
      const flow = automationToFlow({
        trigger: automation.trigger,
        steps: automation.steps || [],
        flowData: automation.flowData,
      });
      setFlowData(flow);
    } catch (error) {
      console.error("Erro ao carregar automação:", error);
      toast.error("Erro ao carregar automação");
      navigate("/app/automations");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: {
    name: string;
    description: string;
    isActive: boolean;
    flowData: FlowData;
    trigger: any;
    steps: any[];
    conditions: any;
  }) => {
    setSaving(true);
    try {
      const payload = {
        name: data.name,
        description: data.description,
        status: data.isActive ? "ACTIVE" : "PAUSED",
        trigger: data.trigger,
        steps: data.steps,
        conditions: data.conditions,
        flowData: data.flowData,
      };

      if (isNew) {
        const result = await apiClient.createAutomation(payload);
        toast.success("Automação criada com sucesso");
        // Navigate to the builder of the newly created automation
        const newId = (result as any)?.id || (result as any)?.data?.id;
        if (newId) {
          navigate(`/app/automations/${newId}/builder`, { replace: true });
        } else {
          navigate("/app/automations");
        }
      } else {
        await apiClient.updateAutomation(id!, payload);
        toast.success("Automação salva com sucesso");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar automação");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !flowData) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <AutomationBuilder
      initialName={automationName}
      initialDescription={automationDescription}
      initialActive={automationActive}
      initialFlowData={flowData}
      saving={saving}
      onSave={handleSave}
      onBack={() => navigate("/app/automations")}
    />
  );
}
