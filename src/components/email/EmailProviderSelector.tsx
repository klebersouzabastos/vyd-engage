import { EmailProvider } from "../../types/email";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";

interface EmailProviderSelectorProps {
  value: EmailProvider;
  onChange: (provider: EmailProvider) => void;
  disabled?: boolean;
}

const PROVIDER_OPTIONS = [
  { value: "smtp" as EmailProvider, label: "SMTP (Gmail, Outlook, etc.)" },
  { value: "sendgrid" as EmailProvider, label: "SendGrid" },
  { value: "mailgun" as EmailProvider, label: "Mailgun" },
  { value: "resend" as EmailProvider, label: "Resend" },
];

export function EmailProviderSelector({
  value,
  onChange,
  disabled = false,
}: EmailProviderSelectorProps) {
  return (
    <div>
      <Label htmlFor="provider">Provedor de Email *</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="provider" className="mt-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROVIDER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}








