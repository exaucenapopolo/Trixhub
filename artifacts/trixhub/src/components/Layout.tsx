import { ReactNode, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLogout } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Users, CheckSquare, Wallet, User, LogOut,
  Menu, X, Sun, Moon, ChevronDown, TrendingUp, PlayCircle, BookOpen, Share2, Compass
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const TRIXHUB_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/Logo%20Initiales%20Typographique%20Vintage%20Noir%20Beige%20Rouge_20260423_215340_0000.png";

const mainNavItems = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Mon Équipe", href: "/team", icon: Users },
  { label: "Retraits", href: "/withdrawals", icon: Wallet },
  { label: "Profil", href: "/profile", icon: User },
];

const missionItems = [
  { label: "Mission Vidéo", href: "/tasks", icon: PlayCircle, color: "text-red-500" },
  { label: "Mission Lecture", href: "/tasks", icon: BookOpen, color: "text-blue-500" },
  { label: "Mission Partage", href: "/tasks", icon: Share2, color: "text-green-500" },
  { label: "Mission Découverte", href: "/tasks", icon: Compass, color: "text-purple-500" },
];

const levelItems = [
  { label: "Toute l'équipe", href: "/team" },
  { label: "Niveau 1 — 1 700 FCFA", href: "/team/level/1" },
  { label: "Niveau 2 — 700 FCFA", href: "/team/level/2" },
  { label: "Niveau 3 — 300 FCFA", href: "/team/level/3" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const logoutMutation = useLogout();

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Membre";
  const initials = displayName.charAt(0).toUpperCase();

  const handleThemeToggle = useCallback(async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    toggleTheme();
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && user) {
        await fetch(`${BASE}/api/users/me/theme`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ theme: newTheme }),
        });
      }
    } catch {}
  }, [theme, toggleTheme, user]);

  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync(); } catch {}
    logout();
    toast({ title: "Déconnecté", description: "À bientôt !" });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={TRIXHUB_LOGO} alt="TRIXHUB" className="h-9 w-9 rounded-xl object-contain bg-white/10 p-0.5 flex-shrink-0" />
          <div>
            <span className="text-base font-bold text-white tracking-wide">TRIXHUB</span>
            <p className="text-xs text-muted-foreground">Plateforme d'affiliation</p>
          </div>
        </div>
      </div>

      <div className="flex-1 py-4 px-3 overflow-y-auto space-y-0.5">
        {/* Main nav */}
        {mainNavItems.map(({ label, href, icon: Icon }) => {
          const isActive = location === href || (href !== "/dashboard" && location.startsWith(href));

          if (href === "/team") {
            return (
              <div key={href}>
                <button
                  onClick={() => setLevelOpen(!levelOpen)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                    isActive || location.startsWith("/team")
                      ? "bg-primary/90 text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon size={17} />
                  <span className="flex-1 text-left">{label}</span>
                  <ChevronDown size={14} className={cn("transition-transform", levelOpen ? "rotate-180" : "")} />
                </button>
                {levelOpen && (
                  <div className="ml-4 mt-1 mb-1 border-l border-sidebar-border pl-3 space-y-0.5">
                    {levelItems.map(lv => (
                      <Link key={lv.href + lv.label} href={lv.href}
                        className={cn("block px-3 py-2 rounded-lg text-xs font-medium transition-all",
                          location === lv.href ? "text-primary" : "text-muted-foreground hover:text-sidebar-foreground"
                        )}>
                        {lv.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive ? "bg-primary/90 text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}>
              <Icon size={17} />
              {label}
            </Link>
          );
        })}

        {/* Missions section */}
        <div className="mt-2 pt-2 border-t border-sidebar-border/50">
          <button
            onClick={() => setMissionsOpen(!missionsOpen)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              location.startsWith("/tasks") ? "bg-primary/90 text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <CheckSquare size={17} />
            <span className="flex-1 text-left">Missions</span>
            <ChevronDown size={14} className={cn("transition-transform", missionsOpen ? "rotate-180" : "")} />
          </button>
          {missionsOpen && (
            <div className="ml-4 mt-1 mb-1 border-l border-sidebar-border pl-3 space-y-0.5">
              {missionItems.map(mi => (
                <Link key={mi.label} href={mi.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-sidebar-foreground transition-all">
                  <mi.icon size={12} className={mi.color} />
                  {mi.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User area */}
      <div className="p-4 border-t border-sidebar-border space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-sidebar-accent/50">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-sm font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors font-medium"
          data-testid="button-logout"
        >
          <LogOut size={17} />
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
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border overflow-y-auto">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl hover:bg-muted transition-colors"
            data-testid="button-menu"
          >
            <Menu size={20} />
          </button>

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2">
            <img src={TRIXHUB_LOGO} alt="TRIXHUB" className="h-7 w-7 rounded-lg object-contain" />
            <span className="font-bold text-sm">TRIXHUB</span>
          </div>

          <div className="flex-1 hidden lg:block" />

          <div className="flex items-center gap-2">
            <button
              onClick={handleThemeToggle}
              className="p-2 rounded-xl hover:bg-muted transition-colors"
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
