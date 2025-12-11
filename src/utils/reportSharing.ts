import { Report, ReportShareSettings } from "../types";

const SHARED_REPORTS_KEY = "sharedReports";

interface SharedReport {
  reportId: string;
  publicLink: string;
  password?: string;
  expiresAt?: string;
  createdAt: string;
}

function generatePublicLink(reportId: string): string {
  // Gerar um link único baseado no ID do relatório e timestamp
  const hash = btoa(`${reportId}-${Date.now()}`)
    .replace(/[+/=]/g, "")
    .substring(0, 16);
  return `${window.location.origin}/app/reports/shared/${hash}`;
}

function getSharedReports(): Map<string, SharedReport> {
  try {
    const stored = localStorage.getItem(SHARED_REPORTS_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return new Map(Object.entries(data));
    }
  } catch (error) {
    console.error("Erro ao carregar relatórios compartilhados:", error);
  }
  return new Map();
}

function saveSharedReports(sharedReports: Map<string, SharedReport>): void {
  try {
    const data = Object.fromEntries(sharedReports);
    localStorage.setItem(SHARED_REPORTS_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Erro ao salvar relatórios compartilhados:", error);
  }
}

export function enablePublicSharing(
  reportId: string,
  options?: { password?: string; expiresInDays?: number }
): ReportShareSettings {
  const sharedReports = getSharedReports();
  const publicLink = generatePublicLink(reportId);
  
  let expiresAt: string | undefined;
  if (options?.expiresInDays) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + options.expiresInDays);
    expiresAt = expiryDate.toISOString();
  }

  const sharedReport: SharedReport = {
    reportId,
    publicLink,
    password: options?.password,
    expiresAt,
    createdAt: new Date().toISOString(),
  };

  sharedReports.set(reportId, sharedReport);
  saveSharedReports(sharedReports);

  return {
    publicLink,
    publicAccess: true,
    permissions: {
      view: [],
      edit: [],
    },
    password: options?.password,
    expiresAt,
  };
}

export function disablePublicSharing(reportId: string): void {
  const sharedReports = getSharedReports();
  sharedReports.delete(reportId);
  saveSharedReports(sharedReports);
}

export function getPublicLink(reportId: string): string | undefined {
  const sharedReports = getSharedReports();
  const shared = sharedReports.get(reportId);
  
  if (!shared) return undefined;
  
  // Verificar se expirou
  if (shared.expiresAt && new Date(shared.expiresAt) < new Date()) {
    sharedReports.delete(reportId);
    saveSharedReports(sharedReports);
    return undefined;
  }
  
  return shared.publicLink;
}

export function verifySharedReportAccess(
  linkHash: string,
  password?: string
): { reportId: string | null; valid: boolean } {
  const sharedReports = getSharedReports();
  
  for (const [reportId, shared] of sharedReports.entries()) {
    const linkHashFromReport = shared.publicLink.split("/").pop();
    
    if (linkHashFromReport === linkHash) {
      // Verificar se expirou
      if (shared.expiresAt && new Date(shared.expiresAt) < new Date()) {
        sharedReports.delete(reportId);
        saveSharedReports(sharedReports);
        return { reportId: null, valid: false };
      }
      
      // Verificar senha se necessário
      if (shared.password && shared.password !== password) {
        return { reportId: null, valid: false };
      }
      
      return { reportId, valid: true };
    }
  }
  
  return { reportId: null, valid: false };
}

export function updateSharePermissions(
  reportId: string,
  permissions: { view?: string[]; edit?: string[] }
): ReportShareSettings {
  const reports = getReports();
  const report = reports.find(r => r.id === reportId);
  
  if (!report) {
    throw new Error("Relatório não encontrado");
  }
  
  const currentShareSettings = report.shareSettings || {
    publicAccess: false,
    permissions: { view: [], edit: [] },
  };
  
  const updatedShareSettings: ReportShareSettings = {
    ...currentShareSettings,
    permissions: {
      view: permissions.view ?? currentShareSettings.permissions.view,
      edit: permissions.edit ?? currentShareSettings.permissions.edit,
    },
  };
  
  report.shareSettings = updatedShareSettings;
  saveReports(reports);
  
  return updatedShareSettings;
}

function getReports(): Report[] {
  try {
    const stored = localStorage.getItem("reports");
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Erro ao carregar relatórios:", error);
    return [];
  }
}

function saveReports(reports: Report[]): void {
  localStorage.setItem("reports", JSON.stringify(reports));
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function shareViaEmail(
  reportId: string,
  recipients: string[],
  subject?: string
): void {
  const report = getReports().find(r => r.id === reportId);
  if (!report) return;
  
  const publicLink = getPublicLink(reportId);
  const link = publicLink || `${window.location.origin}/app/reports/view/${reportId}`;
  
  const emailSubject = subject || `Relatório: ${report.name}`;
  const emailBody = `Olá,\n\nCompartilho com você o relatório "${report.name}".\n\nAcesse: ${link}\n\nAtenciosamente`;
  
  const mailtoLink = `mailto:${recipients.join(",")}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  
  window.location.href = mailtoLink;
}







