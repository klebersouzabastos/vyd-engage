import { Header } from "../components/Header";
import { BillingTab } from "../components/settings/BillingTab";

export function Billing() {
  return (
    <div className="min-h-screen">
      <Header title="Billing" subtitle="Gerencie seu plano, uso e pagamentos" />
      <div className="p-8 max-w-5xl">
        <BillingTab />
      </div>
    </div>
  );
}
