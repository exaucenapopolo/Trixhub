import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon, Eye, EyeOff, CheckCircle2, Phone, Mail, Globe, Lock, Users, ChevronDown, Info, X, Users2, Briefcase, Star, TrendingUp } from "lucide-react";
import PartnersFooter from "@/components/PartnersFooter";
import JoinCommunityButton from "@/components/JoinCommunityButton";
import { formatLocal } from "@/lib/currency";
import { usePageTitle } from '@/hooks/usePageTitle';

const SSG_URL = "https://socialsuccesgroup.socialboosthorizon.com/index.html";
const SBH_URL = "https://socialboosthorizon.com";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const AFRICAN_COUNTRIES = [
  { code: "BJ", name: "Bénin", flag: "🇧🇯", dial: "+229" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫", dial: "+226" },
  { code: "CM", name: "Cameroun", flag: "🇨🇲", dial: "+237" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", dial: "+225" },
  { code: "CG", name: "Congo-Brazzaville", flag: "🇨🇬", dial: "+242" },
  { code: "CD", name: "RD Congo", flag: "🇨🇩", dial: "+243" },
  { code: "GA", name: "Gabon", flag: "🇬🇦", dial: "+241" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", dial: "+233" },
  { code: "GN", name: "Guinée", flag: "🇬🇳", dial: "+224" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", dial: "+254" },
  { code: "ML", name: "Mali", flag: "🇲🇱", dial: "+223" },
  { code: "NE", name: "Niger", flag: "🇳🇪", dial: "+227" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", dial: "+234" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", dial: "+250" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳", dial: "+221" },
  { code: "TG", name: "Togo", flag: "🇹🇬", dial: "+228" },
  { code: "TZ", name: "Tanzanie", flag: "🇹🇿", dial: "+255" },
  { code: "UG", name: "Ouganda", flag: "🇺🇬", dial: "+256" },
];

const TRIXHUB_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/Logo%20Initiales%20Typographique%20Vintage%20Noir%20Beige%20Rouge_20260423_215340_0000.png";
const SSG_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/1776970914770.png";
const SBH_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/Social-Boost-Horizon-/refs/heads/main/assets/logos/FB_IMG_1761822881081.jpg";

interface ReferrerInfo {
  displayName: string;
  referralCode: string;
  country: string;
}

function PhoneVisibleInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted text-muted-foreground"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Users2 size={20} className="text-emerald-500" />
          </div>
          <h3 className="font-bold text-foreground text-base">Rendre mon numéro visible</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          En cochant cette case, votre numéro WhatsApp sera disponible dans l'annuaire communautaire TRIXHUB, accessible uniquement aux membres ayant un compte activé.
        </p>
        <div className="space-y-3 mb-4">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Pourquoi partager ?</p>
          {[
            { icon: Briefcase, text: "Des entrepreneurs et chefs d'entreprise pourront vous contacter pour des opportunités de partenariat ou de collaboration." },
            { icon: TrendingUp, text: "Des professionnels dans votre domaine pourront vous solliciter pour des projets communs." },
            { icon: Star, text: "Chaque contact est une porte ouverte : clients, partenaires, opportunités d'affaires inattendues." },
            { icon: Users, text: "Vous bénéficiez aussi de l'annuaire pour contacter d'autres membres selon vos besoins." },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={12} className="text-emerald-500" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Totalement libre :</strong> Cocher ou ne pas cocher cette case n'a aucune incidence sur votre compte, vos soldes, vos commissions ou quoi que ce soit d'autre. Vous pouvez changer ce choix à tout moment dans votre profil.
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  usePageTitle('Inscription');
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [showPhoneVisibleInfo, setShowPhoneVisibleInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [referrerInfo, setReferrerInfo] = useState<ReferrerInfo | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRef = params.get("ref");
    if (urlRef) {
      localStorage.setItem("trixhub_referral", urlRef);
    }
    const ref = urlRef || localStorage.getItem("trixhub_referral");
    if (ref) {
      setRefCode(ref);
      fetch(`${BASE}/api/auth/referrer/${ref}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setReferrerInfo(data); })
        .catch(() => {});
    }
  }, []);

  const selectedCountry = AFRICAN_COUNTRIES.find(c => c.name === country);

  const applyDialCode = (currentPhone: string, newDial: string): string => {
    const trimmed = currentPhone.trim();
    for (const c of AFRICAN_COUNTRIES) {
      if (trimmed.startsWith(c.dial)) {
        return newDial + trimmed.slice(c.dial.length);
      }
    }
    if (!trimmed) return newDial + " ";
    return newDial + " " + trimmed;
  };

  const handleCountrySelect = (c: typeof AFRICAN_COUNTRIES[number]) => {
    setCountry(c.name);
    setPhone(applyDialCode(phone, c.dial));
    setCountryOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast({ title: "Conditions requises", description: "Veuillez accepter les conditions d'utilisation.", variant: "destructive" });
      return;
    }
    if (!country) {
      toast({ title: "Pays requis", description: "Veuillez sélectionner votre pays.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, country, password, referralCode: refCode ?? null, phoneVisible }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erreur", description: data.error || "Inscription échouée", variant: "destructive" });
        return;
      }
      login(data.token, data.user);
      localStorage.removeItem("trixhub_referral");
      toast({ title: "Bienvenue !", description: "Compte créé avec succès." });
      navigate("/activate");
    } catch {
      toast({ title: "Erreur réseau", description: "Vérifiez votre connexion internet.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background transition-colors duration-300">
      {showPhoneVisibleInfo && <PhoneVisibleInfoModal onClose={() => setShowPhoneVisibleInfo(false)} />}

      {/* Left panel — visible on lg+ */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex-col justify-between p-10">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 right-0 w-72 h-72 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{animationDelay:"1s"}} />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{animationDelay:"2s"}} />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <img src={TRIXHUB_LOGO} alt="TRIXHUB" className="h-12 w-12 rounded-xl object-contain bg-white/10 p-1" />
          <div>
            <h1 className="text-white font-bold text-2xl tracking-tight">TRIXHUB</h1>
            <p className="text-white/50 text-xs">Plateforme d'Affiliation</p>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-white text-3xl xl:text-4xl font-bold leading-tight">
              Ton téléphone peut te rendre{" "}
              <span className="text-yellow-400">riche ou pauvre</span>
              , ça dépend de comment tu l'utilise
            </h2>
          </div>

          <div className="space-y-3">
            {[
              { icon: "💰", title: `Gagne jusqu'à ${formatLocal(1700, country)}`, desc: "Par filleul qui active son compte" },
              { icon: "🌍", title: "18 pays africains couverts", desc: "Rejoins notre réseau continental" },
              { icon: "📱", title: "100% sur mobile", desc: "Orange Money, Wave, MTN et plus" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-3.5 bg-white/5 rounded-xl border border-white/10">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{item.title}</p>
                  <p className="text-white/55 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 pt-6">
          <p className="text-white/40 text-xs mb-3 uppercase tracking-wider">Un projet de Social Succès Group, en partenariat avec</p>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={SSG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded-lg px-3 py-2 transition-colors"
              aria-label="Visiter le site de Social Succès Group (nouvel onglet)"
            >
              <img src={SSG_LOGO} alt="Social Succès Group" className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" />
              <p className="text-white text-xs font-semibold group-hover:underline">Social Succès Group</p>
            </a>
            <span className="text-white/30 text-sm">×</span>
            <a
              href={SBH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded-lg px-3 py-2 transition-colors"
              aria-label="Visiter le site de Social Boost Horizon (nouvel onglet)"
            >
              <img src={SBH_LOGO} alt="Social Boost Horizon" className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" />
              <p className="text-white text-xs font-semibold group-hover:underline">Social Boost Horizon</p>
            </a>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex items-center justify-between p-4 lg:p-6">
          <div className="flex lg:hidden items-center gap-2">
            <img src={TRIXHUB_LOGO} alt="TRIXHUB" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-foreground text-sm">TRIXHUB</span>
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors" aria-label="Thème">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-primary font-medium transition-colors">
              Se connecter
            </Link>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 pb-10">
          <div className="w-full max-w-md">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-foreground">Créer votre compte</h2>
              <p className="text-muted-foreground text-sm mt-1.5">Rejoignez des milliers d'africains qui réussissent avec TRIXHUB</p>

              {referrerInfo && (
                <div className="mt-4 flex items-center gap-3 p-3.5 bg-primary/5 border border-primary/20 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vous avez été invité par</p>
                    <p className="font-semibold text-foreground text-sm">{referrerInfo.displayName}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto flex-shrink-0" />
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Adresse e-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="exemple@email.com"
                    className="w-full pl-10 pr-4 py-3 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Numéro WhatsApp
                  <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-normal">obligatoire</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel" required value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full pl-10 pr-4 py-3 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Phone Visible checkbox */}
              <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div
                    onClick={() => setPhoneVisible(v => !v)}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${phoneVisible ? "bg-emerald-500 border-emerald-500" : "border-border bg-background group-hover:border-emerald-500/50"}`}
                  >
                    {phoneVisible && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-foreground">Rendre mon numéro visible dans la communauté</span>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setShowPhoneVisibleInfo(true); }}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
                      >
                        <Info size={12} /> En savoir plus
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Votre numéro pourra être consulté et acheté par d'autres membres activés. Chaque contact = une opportunité.
                    </p>
                    <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-1 font-medium">
                      Totalement optionnel — aucun impact sur votre compte si vous ne cochez pas.
                    </p>
                  </div>
                </label>
              </div>

              {/* Country dropdown */}
              <div className="relative">
                <label className="block text-sm font-medium text-foreground mb-1.5">Pays</label>
                <button
                  type="button"
                  onClick={() => setCountryOpen(o => !o)}
                  className="w-full flex items-center gap-3 pl-10 pr-4 py-3 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-left relative"
                >
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  {selectedCountry ? (
                    <span className="flex items-center gap-2 text-foreground">
                      <span>{selectedCountry.flag}</span>
                      <span>{selectedCountry.name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Sélectionnez votre pays</span>
                  )}
                  <ChevronDown className={`ml-auto w-4 h-4 text-muted-foreground transition-transform duration-200 ${countryOpen ? "rotate-180" : ""}`} />
                </button>

                {countryOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
                    {AFRICAN_COUNTRIES.map(c => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleCountrySelect(c)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left ${country === c.name ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}
                      >
                        <span>{c.flag}</span>
                        <span className="flex-1">{c.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{c.dial}</span>
                        {country === c.name && <CheckCircle2 className="ml-1 w-3.5 h-3.5 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"} required minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className="w-full pl-10 pr-11 py-3 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* T&C */}
              <div className="pt-1">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div
                    onClick={() => setAcceptedTerms(v => !v)}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${acceptedTerms ? "bg-primary border-primary" : "border-border bg-muted/40 group-hover:border-primary/50"}`}
                  >
                    {acceptedTerms && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="text-sm text-muted-foreground leading-snug">
                    J'accepte les{" "}
                    <Link href="/terms" className="text-primary font-medium hover:underline" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      Conditions d'utilisation
                    </Link>{" "}
                    et la{" "}
                    <Link href="/privacy" className="text-primary font-medium hover:underline" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      Politique de confidentialité
                    </Link>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading || !acceptedTerms}
                className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98] text-sm mt-2 shadow-sm"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                    Création du compte...
                  </span>
                ) : "Créer mon compte gratuitement"}
              </button>

              <p className="text-center text-sm text-muted-foreground">
                Déjà membre ?{" "}
                <Link href="/login" className="text-primary font-semibold hover:underline">
                  Se connecter
                </Link>
              </p>
            </form>

            <div className="mt-6">
              <JoinCommunityButton />
            </div>

            <div className="lg:hidden mt-8">
              <PartnersFooter />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
