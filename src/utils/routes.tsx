import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { AppLayout } from "../components/AppLayout";
import { RequireAuth } from "../components/RequireAuth";
import { ErrorBoundary } from "../components/ErrorBoundary";

// Loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2563EB]" />
    </div>
  );
}

// Lazy wrapper for named exports
function lazyNamed<T extends Record<string, any>>(
  factory: () => Promise<T>,
  name: keyof T
) {
  const Component = lazy(() =>
    factory().then((mod) => ({ default: mod[name] as any }))
  );
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
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
const AutomationLogs = lazyNamed(() => import("../pages/AutomationLogs"), "AutomationLogs");
const Settings = lazyNamed(() => import("../pages/Settings"), "Settings");
const CustomFields = lazyNamed(() => import("../pages/CustomFields"), "CustomFields");
const Tasks = lazyNamed(() => import("../pages/Tasks"), "Tasks");
const TaskForm = lazyNamed(() => import("../pages/TaskForm"), "TaskForm");
const Profile = lazyNamed(() => import("../pages/Profile"), "Profile");
const Reports = lazyNamed(() => import("../pages/Reports"), "Reports");
const ReportBuilder = lazyNamed(() => import("../pages/ReportBuilder"), "ReportBuilder");
const ReportView = lazyNamed(() => import("../pages/ReportView"), "ReportView");

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
        path: "leads/:id/edit",
        element: LeadForm,
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
        path: "automations/:id",
        element: AutomationDetail,
      },
      {
        path: "automations/logs",
        element: AutomationLogs,
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
    ],
  },
]);
