import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon, Eye, EyeOff, Mail, Lock, ArrowRight, Zap, AlertCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const TRIXHUB_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/Logo%20Initiales%20Typographique%20Vintage%20Noir%20Beige%20Rouge_20260423_215340_0000.png";

// 3 vraies images d'illustration affichées au-dessus du logo (carrousel automatique)
const LOGIN_IMAGES = [
  "https://raw.githubusercontent.com/exaucenapopolo/Social-Boost-Horizon-/refs/heads/main/assets/Photo/TRIXHUB/file_000000002ab47243b5d65bb309e5bb77.png",
  "https://raw.githubusercontent.com/exaucenapopolo/Social-Boost-Horizon-/refs/heads/main/assets/Photo/TRIXHUB/IMG-20260426-WA0001.jpg",
  "https://raw.githubusercontent.com/exaucenapopolo/Social-Boost-Horizon-/refs/heads/main/assets/Photo/TRIXHUB/Jaune%20Portraits%20Enseignant%20%C3%89ducation%20Comment%20Podcast%20Couverture_20260426_194410_0000.png",
];

function IllustrationCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setCurrent(s => (s + 1) % LOGIN_IMAGES.length), 4000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="mb-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30 aspect-[4/5]">
        {LOGIN_IMAGES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Illustration ${i + 1}`}
            loading={i === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      </div>
      <div className="flex justify-center gap-1.5 mt-3">
        {LOGIN_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Image ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === current ? "bg-primary w-6" : "bg-border w-1.5"}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notActivated, setNotActivated] = useState(false);
  const [loggedUser, setLoggedUser] = useState<{ displayName?: string } | null>(null);

  useEffect(() => {
    // Si l'URL contient ?activation=pending, on affiche directement la bannière d'activation
    const params = new URLSearchParams(window.location.search);
    if (params.get("activation") === "pending") setNotActivated(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Connexion échouée", description: data.error || "Vérifiez vos identifiants.", variant: "destructive" });
        return;
      }
      login(data.token, data.user);
      if (data.user?.isActivated) {
        toast({ title: "Connexion réussie", description: "Bon retour !" });
        navigate("/dashboard");
      } else {
        // Compte créé mais pas encore activé : on affiche la carte d'invitation à l'activation
        setLoggedUser(data.user);
        setNotActivated(true);
      }
    } catch {
      toast({ title: "Erreur réseau", description: "Impossible de se connecter. Réessayez.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 lg:p-6">
        <Link href="/" className="flex items-center gap-2">
          <img src={TRIXHUB_LOGO} alt="TRIXHUB" className="h-8 w-8 rounded-lg object-contain" />
          <span className="font-bold text-foreground">TRIXHUB</span>
        </Link>
        <button onClick={toggleTheme} className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors" aria-label="Thème">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          {/* ── Compte non activé ── */}
          {notActivated ? (
            <div className="space-y-4">
              {/* Alert card */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Compte non activé
                </h2>
                <p className="text-sm text-muted-foreground mb-1">
                  {loggedUser?.displayName ? `Bonjour ${loggedUser.displayName},` : "Bonjour,"} ton compte est créé mais n'est pas encore activé.
                </p>
                <p className="text-sm text-muted-foreground">
                  Tu dois payer les <strong className="text-foreground">3 600 FCFA</strong> d'activation pour accéder au tableau de bord et commencer à gagner de l'argent.
                </p>
              </div>

              {/* What you unlock */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Ce que tu débloqueras :</h3>
                <ul className="space-y-2">
                  {[
                    { icon: "💰", text: "1 700 FCFA de commission par filleul direct" },
                    { icon: "📊", text: "Tableau de bord avec suivi de tes gains" },
                    { icon: "🎯", text: "Missions quotidiennes rémunérées" },
                    { icon: "💳", text: "Retrait via Mobile Money" },
                    { icon: "🔗", text: "Lien de parrainage actif" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <span className="text-base">{item.icon}</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA button */}
              <button
                onClick={() => navigate("/activate")}
                className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-base shadow-lg shadow-primary/25"
              >
                <Zap className="w-5 h-5" />
                Activer mon compte — 3 600 FCFA
              </button>

              <button
                onClick={() => setNotActivated(false)}
                className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                ← Se connecter avec un autre compte
              </button>
            </div>

          ) : (

            /* ── Formulaire de connexion ── */
            <>
              {/* Carrousel d'illustrations au-dessus du logo */}
              <IllustrationCarousel />

              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                  <img src={TRIXHUB_LOGO} alt="TRIXHUB" className="h-10 w-10 rounded-xl object-contain" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Bon retour !</h1>
                <p className="text-muted-foreground text-sm mt-1">Connectez-vous à votre compte TRIXHUB</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Adresse e-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="email" required value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="exemple@email.com"
                        autoComplete="email"
                        className="w-full pl-10 pr-4 py-3 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-foreground">Mot de passe</label>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type={showPassword ? "text" : "password"} required value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Votre mot de passe"
                        autoComplete="current-password"
                        className="w-full pl-10 pr-11 py-3 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                      <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98] text-sm flex items-center justify-center gap-2 mt-2"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      <>
                        Se connecter
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Pas encore membre ?{" "}
                <Link href="/" className="text-primary font-semibold hover:underline">
                  Créer un compte
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
