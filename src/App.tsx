import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

// Pages
import CabaretOrganizer from "./pages/CabaretOrganizer";
import Login from "./pages/Login";
import Activate from "./pages/Activate";
import ForgotPassword from "./pages/ForgotPassword";
import Members from "./pages/Members";
import Agenda from "./pages/Agenda";
import Stats from "./pages/Stats";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";
import MonPlanning from "./pages/MonPlanning";
import MonProfil from "./pages/MonProfil";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// ---- ProtectedRoute ----
function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user?.app_role !== "admin") {
    return <Navigate to="/cabaret" replace />;
  }

  return <>{children}</>;
}

// ---- Routes ----
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/cabaret" replace />} />
        <Route path="/cabaret" element={<CabaretOrganizer />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/mon-profil" element={<MonProfil />} />
        <Route path="/mon-planning" element={<MonPlanning />} />
        <Route path="/membres" element={<Members />} />
        <Route
          path="/stats"
          element={
            <ProtectedRoute adminOnly>
              <Stats />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute adminOnly>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <PwaInstallPrompt />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
