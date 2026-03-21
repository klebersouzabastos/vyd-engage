import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { AppLayout } from "../components/AppLayout";
import { RequireAuth } from "../components/RequireAuth";
import { ErrorBoundary } from "../components/ErrorBoundary";

// Loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

// Lazy wrapper for named exports — each route gets its own ErrorBoundary
function lazyNamed<T extends Record<string, any>>(
  factory: () => Promise<T>,
  name: keyof T
) {
  const Component = lazy(() =>
    factory().then((mod) => ({ default: mod[name] as any }))
  );
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}

// Public pages
const LandingPage = lazyNamed(() => import("../pages/LandingPage"), "LandingPage");
const Login = lazyNamed(() => import("../pages/Login"), "Login");
const Register = lazyNamed(() => import("../pages/Register"), "Register");
const ForgotPassword = lazyNamed(() => import("../pages/ForgotPassword"), "ForgotPassword");
const ResetPassword = lazyNamed(() => import("../pages/ResetPassword"), "ResetPassword");
const Onboarding = lazyNamed(() => import("../pages/Onboarding"), "Onboarding");
const PublicForm = lazyNamed(() => import("../pages/PublicForm"), "PublicForm");

// App pages (behind auth)
const Dashboard = lazyNamed(() => import("../pages/Dashboard"), "Dashboard");
const Leads = lazyNamed(() => import("../pages/Leads"), "Leads");
const LeadForm = lazyNamed(() => import("../pages/LeadForm"), "LeadForm");
const Pipeline = lazyNamed(() => import("../pages/Pipeline"), "Pipeline");
const Automations = lazyNamed(() => import("../pages/Automations"), "Automations");
const AutomationDetail = lazyNamed(() => import("../pages/AutomationDetail"), "AutomationDetail");
const AutomationBuilderPage = lazyNamed(() => import("../pages/AutomationBuilderPage"), "AutomationBuilderPage");
const AutomationLogs = lazyNamed(() => import("../pages/AutomationLogs"), "AutomationLogs");
const Settings = lazyNamed(() => import("../pages/Settings"), "Settings");
const CustomFields = lazyNamed(() => import("../pages/CustomFields"), "CustomFields");
const Tasks = lazyNamed(() => import("../pages/Tasks"), "Tasks");
const TaskForm = lazyNamed(() => import("../pages/TaskForm"), "TaskForm");
const Profile = lazyNamed(() => import("../pages/Profile"), "Profile");
const Inbox = lazyNamed(() => import("../pages/Inbox"), "Inbox");
const Billing = lazyNamed(() => import("../pages/Billing"), "Billing");
const Reports = lazyNamed(() => import("../pages/Reports"), "Reports");
const ReportBuilder = lazyNamed(() => import("../pages/ReportBuilder"), "ReportBuilder");
const ReportView = lazyNamed(() => import("../pages/ReportView"), "ReportView");
const WhatsAppTemplates = lazyNamed(() => import("../pages/WhatsAppTemplates"), "WhatsAppTemplates");
const EmailCampaigns = lazyNamed(() => import("../pages/EmailCampaigns"), "EmailCampaigns");
const TeamManagement = lazyNamed(() => import("../pages/TeamManagement"), "TeamManagement");
const LeadDetail = lazyNamed(() => import("../pages/LeadDetail"), "LeadDetail");
const LeadDuplicates = lazyNamed(() => import("../pages/LeadDuplicates"), "LeadDuplicates");
const Companies = lazyNamed(() => import("../pages/Companies"), "Companies");
const CompanyDetail = lazyNamed(() => import("../pages/CompanyDetail"), "CompanyDetail");
const Deals = lazyNamed(() => import("../pages/Deals"), "Deals");
const DealDetail = lazyNamed(() => import("../pages/DealDetail"), "DealDetail");
const Forecast = lazyNamed(() => import("../pages/Forecast"), "Forecast");
const FunnelConversion = lazyNamed(() => import("../pages/FunnelConversion"), "FunnelConversion");
const Webhooks = lazyNamed(() => import("../pages/Webhooks"), "Webhooks");
const ApiKeys = lazyNamed(() => import("../pages/ApiKeys"), "ApiKeys");

export const router = createBrowserRouter([
  {
    path: "/",
    element: LandingPage,
  },
  {
    path: "/login",
    element: Login,
  },
  {
    path: "/register",
    element: Register,
  },
  {
    path: "/forgot-password",
    element: ForgotPassword,
  },
  {
    path: "/reset-password",
    element: ResetPassword,
  },
  {
    path: "/onboarding",
    element: Onboarding,
  },
  {
    path: "/capture/:formId",
    element: PublicForm,
  },
  {
    path: "/app",
    element: (
      <RequireAuth>
        <ErrorBoundary>
          <AppLayout />
        </ErrorBoundary>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: Dashboard,
      },
      {
        path: "leads",
        element: Leads,
      },
      {
        path: "leads/new",
        element: LeadForm,
      },
      {
        path: "leads/duplicates",
        element: LeadDuplicates,
      },
      {
        path: "leads/:id/edit",
        element: LeadForm,
      },
      {
        path: "leads/:id",
        element: LeadDetail,
      },
      {
        path: "companies",
        element: Companies,
      },
      {
        path: "companies/:id",
        element: CompanyDetail,
      },
      {
        path: "deals",
        element: Deals,
      },
      {
        path: "deals/:id",
        element: DealDetail,
      },
      {
        path: "forecast",
        element: Forecast,
      },
      {
        path: "funnel",
        element: FunnelConversion,
      },
      {
        path: "team",
        element: TeamManagement,
      },
      {
        path: "pipeline",
        element: Pipeline,
      },
      {
        path: "automations",
        element: Automations,
      },
      {
        path: "automations/new",
        element: AutomationDetail,
      },
      {
        path: "automations/new/builder",
        element: AutomationBuilderPage,
      },
      {
        path: "automations/logs",
        element: AutomationLogs,
      },
      {
        path: "automations/:id",
        element: AutomationDetail,
      },
      {
        path: "automations/:id/builder",
        element: AutomationBuilderPage,
      },
      {
        path: "settings",
        element: Settings,
      },
      {
        path: "custom-fields",
        element: CustomFields,
      },
      {
        path: "tasks",
        element: Tasks,
      },
      {
        path: "tasks/new",
        element: TaskForm,
      },
      {
        path: "tasks/:id/edit",
        element: TaskForm,
      },
      {
        path: "profile",
        element: Profile,
      },
      {
        path: "inbox",
        element: Inbox,
      },
      {
        path: "billing",
        element: Billing,
      },
      {
        path: "whatsapp/templates",
        element: WhatsAppTemplates,
      },
      {
        path: "email/campaigns",
        element: EmailCampaigns,
      },
      {
        path: "reports",
        element: Reports,
      },
      {
        path: "reports/new",
        element: ReportBuilder,
      },
      {
        path: "reports/view/:id",
        element: ReportView,
      },
      {
        path: "reports/:id",
        element: ReportBuilder,
      },
      {
        path: "webhooks",
        element: Webhooks,
      },
      {
        path: "api-keys",
        element: ApiKeys,
      },
    ],
  },
]);
