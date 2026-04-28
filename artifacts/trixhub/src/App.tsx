import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, type UserData } from "@/context/AuthContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { useEffect } from "react";
import RegisterPage from "@/pages/register";
import LoginPage from "@/pages/login";
import ActivatePage from "@/pages/activate";
import DashboardPage from "@/pages/dashboard";
import TeamPage from "@/pages/team";
import TeamLevelPage from "@/pages/teamLevel";
import TasksHub from "@/pages/tasks/index";
import MissionVideoPage from "@/pages/tasks/video";
import MissionQuizzPage from "@/pages/tasks/quizz";
import MissionDecouvertePage from "@/pages/tasks/decouverte";
import MissionSurprisePage from "@/pages/tasks/surprise";
import WithdrawalsPage from "@/pages/withdrawals";
import ProfilePage from "@/pages/profile";
import BonusCanvaPage from "@/pages/bonus/canva";
import BonusVpnPage from "@/pages/bonus/vpn";
import FormationsPage from "@/pages/formations";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import NotFound from "@/pages/not-found";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ThemeSyncer({ user }: { user: UserData | null }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    if (user?.themePreference === "dark" || user?.themePreference === "light") {
      setTheme(user.themePreference);
    }
  }, [user?.id, user?.themePreference]);
  return null;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm font-medium">Chargement...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading, token } = useAuth();
  if (isLoading || (token && !user)) return <LoadingScreen />;
  if (!token || !user) return <Redirect to="/login" />;
  if (!user.isActivated) return <Redirect to="/activate" />;
  return <Component />;
}

function ActivateRoute() {
  const { token, user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!token) return <Redirect to="/" />;
  if (user?.isActivated) return <Redirect to="/dashboard" />;
  return <ActivatePage />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, token, isLoading } = useAuth();
  if (isLoading || (token && !user)) return <LoadingScreen />;
  if (token && user) {
    if (!user.isActivated) return <Redirect to="/activate" />;
    return <Redirect to="/dashboard" />;
  }
  return <Component />;
}

function InnerApp() {
  const { user } = useAuth();
  return (
    <>
      <ThemeSyncer user={user} />
      <Switch>
        <Route path="/" component={() => <PublicRoute component={RegisterPage} />} />
        <Route path="/login" component={() => <PublicRoute component={LoginPage} />} />
        <Route path="/activate" component={ActivateRoute} />
        <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
        <Route path="/team" component={() => <ProtectedRoute component={TeamPage} />} />
        <Route path="/team/level/:level" component={() => <ProtectedRoute component={TeamLevelPage} />} />
        <Route path="/tasks" component={() => <ProtectedRoute component={TasksHub} />} />
        <Route path="/tasks/video" component={() => <ProtectedRoute component={MissionVideoPage} />} />
        <Route path="/tasks/quizz" component={() => <ProtectedRoute component={MissionQuizzPage} />} />
        <Route path="/tasks/decouverte" component={() => <ProtectedRoute component={MissionDecouvertePage} />} />
        <Route path="/tasks/surprise" component={() => <ProtectedRoute component={MissionSurprisePage} />} />
        <Route path="/withdrawals" component={() => <ProtectedRoute component={WithdrawalsPage} />} />
        <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
        <Route path="/bonus/canva" component={() => <ProtectedRoute component={BonusCanvaPage} />} />
        <Route path="/bonus/vpn" component={() => <ProtectedRoute component={BonusVpnPage} />} />
        <Route path="/formations" component={() => <ProtectedRoute component={FormationsPage} />} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
              <InnerApp />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
