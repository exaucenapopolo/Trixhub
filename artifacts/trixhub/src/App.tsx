import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import RegisterPage from "@/pages/register";
import LoginPage from "@/pages/login";
import ActivatePage from "@/pages/activate";
import DashboardPage from "@/pages/dashboard";
import TeamPage from "@/pages/team";
import TeamLevelPage from "@/pages/teamLevel";
import TasksPage from "@/pages/tasks";
import WithdrawalsPage from "@/pages/withdrawals";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-primary-foreground font-bold text-sm">TX</span>
        </div>
        <p className="text-muted-foreground text-sm">Chargement...</p>
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <PublicRoute component={RegisterPage} />} />
      <Route path="/login" component={() => <PublicRoute component={LoginPage} />} />
      <Route path="/activate" component={ActivateRoute} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/team" component={() => <ProtectedRoute component={TeamPage} />} />
      <Route path="/team/level/:level" component={() => <ProtectedRoute component={TeamLevelPage} />} />
      <Route path="/tasks" component={() => <ProtectedRoute component={TasksPage} />} />
      <Route path="/withdrawals" component={() => <ProtectedRoute component={WithdrawalsPage} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
