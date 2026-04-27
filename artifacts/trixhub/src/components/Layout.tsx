import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLogout } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Users, CheckSquare, Wallet, User, LogOut,
  Menu, X, Sun, Moon, ChevronDown, Shield, TrendingUp, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Mon Équipe", href: "/team", icon: Users },
  { label: "Tâches", href: "/tasks", icon: CheckSquare },
  { label: "Retraits", href: "/withdrawals", icon: Wallet },
  { label: "Profil", href: "/profile", icon: User },
];

const levelItems = [
  { label: "Niveau 1", href: "/team/level/1" },
  { label: "Niveau 2", href: "/team/level/2" },
  { label: "Niveau 3", href: "/team/level/3" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
    }
    logout();
    toast({ title: "Déconnecté", description: "À bientôt !" });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gradient-green flex items-center justify-center">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-wide">TRIX<span className="text-primary">HUB</span></span>
            <p className="text-xs text-muted-foreground">Plateforme d'affiliation</p>
          </div>
        </div>
      </div>

      <div className="flex-1 py-4 px-3 overflow-y-auto">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = location === href || (href !== "/dashboard" && location.startsWith(href));
          if (href === "/team") {
            return (
              <div key={href}>
                <button
                  onClick={() => setLevelOpen(!levelOpen)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5",
                    isActive || location.startsWith("/team")
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon size={18} />
                  <span className="flex-1 text-left">{label}</span>
                  <ChevronDown size={14} className={cn("transition-transform", levelOpen ? "rotate-180" : "")} />
                </button>
                {levelOpen && (
                  <div className="ml-4 mt-1 mb-2 border-l border-sidebar-border pl-3 space-y-0.5">
                    <Link href={href} className={cn(
                      "block px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      location === href ? "text-primary" : "text-muted-foreground hover:text-sidebar-foreground"
                    )}>Toute l'équipe</Link>
                    {levelItems.map(lv => (
                      <Link key={lv.href} href={lv.href} className={cn(
                        "block px-3 py-2 rounded-lg text-xs font-medium transition-all",
                        location === lv.href ? "text-primary" : "text-muted-foreground hover:text-sidebar-foreground"
                      )}>{lv.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-sm font-bold">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
          data-testid="button-logout"
        >
          <LogOut size={18} />
          Se déconnecter
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-border bg-card shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            data-testid="button-menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {user?.isActivated && (
              <Badge variant="outline" className="text-primary border-primary/30 text-xs gap-1 hidden sm:flex">
                <Shield size={11} />
                Compte Actif
              </Badge>
            )}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
