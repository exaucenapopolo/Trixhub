// Pied de page commun à toutes les pages de TRIXHUB.
// Affiche les deux partenaires : Social Succès Group (porteur) et Social Boost Horizon (partenaire).
// Les liens s'ouvrent dans un nouvel onglet avec rel="noopener noreferrer" pour la sécurité (anti tabnabbing).

const SSG_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/1776970914770.png";
const SBH_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/Social-Boost-Horizon-/refs/heads/main/assets/logos/FB_IMG_1761822881081.jpg";

const SSG_URL = "https://socialsuccesgroup.socialboosthorizon.com/index.html";
const SBH_URL = "https://socialboosthorizon.com";

interface PartnersFooterProps {
  /** Variante visuelle. "muted" = fond clair des pages publiques. "dark" = sur fond sombre (sidebar). */
  variant?: "muted" | "dark";
  className?: string;
}

export default function PartnersFooter({ variant = "muted", className = "" }: PartnersFooterProps) {
  const isDark = variant === "dark";
  const labelColor   = isDark ? "text-white/40"  : "text-muted-foreground";
  const nameColor    = isDark ? "text-white/90"  : "text-foreground";
  const dividerColor = isDark ? "text-white/30"  : "text-muted-foreground/40";
  const cardBg       = isDark
    ? "bg-white/5 hover:bg-white/10 border-white/10"
    : "bg-card hover:bg-muted/40 border-border";
  const containerBg  = isDark
    ? "border-white/10"
    : "border-border bg-card/30";

  return (
    <footer className={`w-full border-t ${containerBg} py-5 px-4 ${className}`}>
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-2.5">
        <p className={`text-[11px] ${labelColor} uppercase tracking-wider font-medium`}>
          Un projet de Social Succès Group, en partenariat avec Social Boost Horizon
        </p>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <a
            href={SSG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center gap-2 ${cardBg} border rounded-xl px-3 py-2 transition-colors`}
            aria-label="Visiter le site de Social Succès Group (nouvel onglet)"
          >
            <img
              src={SSG_LOGO}
              alt="Social Succès Group"
              className="h-7 w-7 rounded-full object-cover flex-shrink-0"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <span className={`text-xs font-semibold ${nameColor} group-hover:underline`}>Social Succès Group</span>
          </a>

          <span className={`${dividerColor} text-sm select-none`}>×</span>

          <a
            href={SBH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center gap-2 ${cardBg} border rounded-xl px-3 py-2 transition-colors`}
            aria-label="Visiter le site de Social Boost Horizon (nouvel onglet)"
          >
            <img
              src={SBH_LOGO}
              alt="Social Boost Horizon"
              className="h-7 w-7 rounded-full object-cover flex-shrink-0"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <span className={`text-xs font-semibold ${nameColor} group-hover:underline`}>Social Boost Horizon</span>
          </a>
        </div>
        <p className={`text-[10px] ${labelColor} mt-1`}>
          © {new Date().getFullYear()} TRIXHUB · Tous droits réservés
        </p>
      </div>
    </footer>
  );
}
