import { createBrowserRouter } from "react-router";
import { Dashboard } from "../pages/Dashboard";
import { Leads } from "../pages/Leads";
import { LeadForm } from "../pages/LeadForm";
import { Pipeline } from "../pages/Pipeline";
import { TaskForm } from "../pages/TaskForm";
import { Automations } from "../pages/Automations";
import { AutomationDetail } from "../pages/AutomationDetail";
import { AutomationLogs } from "../pages/AutomationLogs";
import { Settings } from "../pages/Settings";
import { Profile } from "../pages/Profile";
import { Login } from "../pages/Login";
import { Register } from "../pages/Register";
import { ForgotPassword } from "../pages/ForgotPassword";
import { ResetPassword } from "../pages/ResetPassword";
import { Onboarding } from "../pages/Onboarding";
import { PublicForm } from "../pages/PublicForm";
import { LandingPage } from "../pages/LandingPage";
import { AppLayout } from "../components/AppLayout";
import { CustomFields } from "../pages/CustomFields";
import { Tasks } from "../pages/Tasks";
import { Reports } from "../pages/Reports";
import { ReportBuilder } from "../pages/ReportBuilder";
import { ReportView } from "../pages/ReportView";
import { RequireAuth } from "../components/RequireAuth";
import { ErrorBoundary } from "../components/ErrorBoundary";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/onboarding",
    element: <Onboarding />,
  },
  {
    path: "/capture/:formId",
    element: <PublicForm />,
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
        element: <Dashboard />,
      },
      {
        path: "leads",
        element: <Leads />,
      },
      {
        path: "leads/new",
        element: <LeadForm />,
      },
      {
        path: "leads/:id/edit",
        element: <LeadForm />,
      },
      {
        path: "pipeline",
        element: <Pipeline />,
      },
      {
        path: "automations",
        element: <Automations />,
      },
      {
        path: "automations/:id",
        element: <AutomationDetail />,
      },
      {
        path: "automations/logs",
        element: <AutomationLogs />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
      {
        path: "custom-fields",
        element: <CustomFields />,
      },
      {
        path: "tasks",
        element: <Tasks />,
      },
      {
        path: "tasks/new",
        element: <TaskForm />,
      },
      {
        path: "tasks/:id/edit",
        element: <TaskForm />,
      },
      {
        path: "profile",
        element: <Profile />,
      },
      {
        path: "reports",
        element: <Reports />,
      },
      {
        path: "reports/new",
        element: <ReportBuilder />,
      },
      {
        path: "reports/view/:id",
        element: <ReportView />,
      },
      {
        path: "reports/:id",
        element: <ReportBuilder />,
      },
    ],
  },
]);
