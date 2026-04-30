import { ReactNode, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLogout } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Users, CheckSquare, Wallet, User, LogOut,
  Menu, Sun, Moon, ChevronDown, PlayCircle, HelpCircle, Compass,
  Gift, GraduationCap, Palette, Shield, Sparkles, ExternalLink, ShieldCheck
} from "lucide-react";
import { cn, resolveAvatarUrl } from "@/lib/utils";
import PartnersFooter from "@/components/PartnersFooter";
import { formatLocal, type CurrencyTarget } from "@/lib/currency";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const ADMIN_EMAILS = ["exaucenapopolo2@gmail.com", "mcexauofficiel@gmail.com"];

const TRIXHUB_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/Logo%20Initiales%20Typographique%20Vintage%20Noir%20Beige%20Rouge_20260423_215340_0000.png";

const mainNavItems = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Mon Équipe", href: "/team", icon: Users },
  { label: "Retraits", href: "/withdrawals", icon: Wallet },
  { label: "Profil", href: "/profile", icon: User },
];

const missionItems = [
  { label: "Mission Vidéo", href: "/tasks/video", icon: PlayCircle, color: "text-red-500" },
  { label: "Mission Quizz", href: "/tasks/quizz", icon: HelpCircle, color: "text-blue-500" },
  { label: "Mission Découverte", href: "/tasks/decouverte", icon: Compass, color: "text-purple-500" },
  { label: "Mission Surprise", href: "/tasks/surprise", icon: Sparkles, color: "text-amber-500" },
];

function buildLevelItems(target: CurrencyTarget) {
  return [
    { label: "Toute l'équipe", href: "/team" },
    { label: `Niveau 1 — ${formatLocal(1700, target)}`, href: "/team/level/1" },
    { label: `Niveau 2 — ${formatLocal(700, target)}`, href: "/team/level/2" },
    { label: `Niveau 3 — ${formatLocal(300, target)}`, href: "/team/level/3" },
  ];
}

const bonusItems = [
  { label: "Compte Canva Pro", href: "/bonus/canva", icon: Palette, color: "text-purple-500", external: false },
  { label: "VPN gratuit (groupe)", href: "/bonus/vpn", icon: Shield, color: "text-blue-500", external: false },
  { label: "Outils visibilité", href: "https://socialboosthorizon.com", icon: Sparkles, color: "text-amber-500", external: true },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const logoutMutation = useLogout();

  const isAdmin = !!(user && (user.isAdmin || ADMIN_EMAILS.includes(user.email)));
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Membre";
  const initials = displayName.charAt(0).toUpperCase();
  const avatarSrc = resolveAvatarUrl(user?.avatarUrl);
  const levelItems = buildLevelItems(user);

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

        {/* Activités section — refonte hebdomadaire (cap 100/jour, 700/sem) */}
        <div className="mt-2 pt-2 border-t border-sidebar-border/50">
          <Link href="/activities"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              location.startsWith("/activities") ? "bg-primary/90 text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}>
            <CheckSquare size={17} />
            <span className="flex-1 text-left">Activités</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">NEW</span>
          </Link>
        </div>

        {/* Bonus section */}
        <div className="mt-2 pt-2 border-t border-sidebar-border/50">
          <button
            onClick={() => setBonusOpen(!bonusOpen)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              location.startsWith("/bonus") ? "bg-primary/90 text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
            data-testid="button-bonus-menu"
          >
            <Gift size={17} />
            <span className="flex-1 text-left">Bonus</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">NEW</span>
            <ChevronDown size={14} className={cn("transition-transform", bonusOpen ? "rotate-180" : "")} />
          </button>
          {bonusOpen && (
            <div className="ml-4 mt-1 mb-1 border-l border-sidebar-border pl-3 space-y-0.5">
              {bonusItems.map(bi => (
                bi.external ? (
                  <a key={bi.label} href={bi.href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-sidebar-foreground transition-all"
                    data-testid={`link-bonus-${bi.label.toLowerCase().replace(/\s/g, '-')}`}>
                    <bi.icon size={12} className={bi.color} />
                    <span className="flex-1">{bi.label}</span>
                    <ExternalLink size={10} className="opacity-60" />
                  </a>
                ) : (
                  <Link key={bi.label} href={bi.href}
                    className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      location === bi.href ? "text-primary" : "text-muted-foreground hover:text-sidebar-foreground"
                    )}
                    data-testid={`link-bonus-${bi.label.toLowerCase().replace(/\s/g, '-')}`}>
                    <bi.icon size={12} className={bi.color} />
                    {bi.label}
                  </Link>
                )
              ))}
            </div>
          )}
        </div>

        {/* Formations link */}
        <div className="mt-2 pt-2 border-t border-sidebar-border/50">
          <Link href="/formations"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              location === "/formations" ? "bg-primary/90 text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
            data-testid="link-formations">
            <GraduationCap size={17} />
            <span className="flex-1">Formations</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">NEW</span>
          </Link>
        </div>

        {/* Lien Admin — visible uniquement pour les admins */}
        {isAdmin && (
          <div className="mt-2 pt-2 border-t border-sidebar-border/50">
            <Link href="/admin"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                location === "/admin" ? "bg-primary/90 text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
              data-testid="link-admin">
              <ShieldCheck size={17} />
              <span className="flex-1">Admin</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-500">ADMIN</span>
            </Link>
          </div>
        )}
      </div>

      {/* User area */}
      <div className="p-4 border-t border-sidebar-border space-y-1">
        <Link
          href="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors"
          data-testid="link-profile-shortcut"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center flex-shrink-0">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span className="text-primary text-sm font-bold">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </Link>
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

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6">
            {children}
          </div>
          {/* Pied de page partenaires (visible sur toutes les pages connectées) */}
          <PartnersFooter />
        </main>
      </div>
    </div>
  );
}
