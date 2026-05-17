import { useState } from "react";
import { useGetTeam } from "@workspace/api-client-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import FeatureGate from "@/components/FeatureGate";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Search, CheckCircle, Clock, Globe, Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { usePageTitle } from '@/hooks/usePageTitle';

type FilterType = "all" | "active" | "inactive" | "free";

export default function TeamPage() {
  usePageTitle('Mon équipe');
  const { user } = useAuth();
  const { data: team, isLoading } = useGetTeam();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [showFreeInfo, setShowFreeInfo] = useState(false);

  const filtered = team?.members?.filter(m => {
    const matchSearch = !search || `${m.displayName} ${m.country}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "active" && m.isActivated) ||
      (filter === "free" && !m.isActivated && !!m.isFreeAccount) ||
      (filter === "inactive" && !m.isActivated && !m.isFreeAccount);
    return matchSearch && matchFilter;
  }) ?? [];

  const freeCount = team?.freeAccount ?? 0;

  if (user?.blockedReferral) return (
    <Layout>
      <FeatureGate blocked feature="Parrainage (équipe)">{null}</FeatureGate>
    </Layout>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mon Équipe</h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez et suivez votre réseau de filleuls</p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", count: team?.total ?? 0, color: "text-foreground" },
            { label: "Actifs", count: team?.active ?? 0, color: "text-primary" },
            { label: "Gratuits", count: freeCount, color: "text-amber-500" },
            { label: "Inactifs", count: team?.inactive ?? 0, color: "text-muted-foreground" },
          ].map(({ label, count, color }) => (
            <Card key={label} className="border-card-border">
              <CardContent className="p-3 text-center">
                <p className={cn("text-2xl font-bold amount-display", color)}>{count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Liens vers niveaux */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(l => (
            <Link key={l} href={`/team/level/${l}`}>
              <Card className="border-card-border hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="p-3 text-center">
                  <p className="font-semibold text-sm">Niveau {l}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Voir la liste</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Explication compte gratuit (si il y en a) */}
        {freeCount > 0 && (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFreeInfo(v => !v)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-amber-500/10 transition-colors"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {freeCount} filleul{freeCount > 1 ? "s" : ""} en compte gratuit
                </p>
                <p className="text-xs text-muted-foreground">Clique pour comprendre comment ça fonctionne</p>
              </div>
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
            </button>
            {showFreeInfo && (
              <div className="px-4 pb-4 space-y-3 border-t border-amber-500/15 pt-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ces membres ont choisi de rejoindre TRIXHUB <strong className="text-foreground">sans payer les 3 600 FCFA</strong> d'activation. Voici comment ça marche pour toi :
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold flex-shrink-0">✦</span>
                    <span className="text-muted-foreground">Leurs commissions s'accumulent dans un <strong className="text-foreground">crédit d'activation</strong>. Dès qu'ils atteignent 3 400 FCFA de crédit, leur compte s'active automatiquement.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold flex-shrink-0">✦</span>
                    <span className="text-muted-foreground">Quand leur compte s'active, <strong className="text-foreground">tu reçois automatiquement ta commission</strong> (1 700 FCFA si N1, 700 FCFA si N2, 300 FCFA si N3) — exactement comme pour un paiement direct.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold flex-shrink-0">✓</span>
                    <span className="text-muted-foreground">Tu n'as rien à faire. Le système gère tout automatiquement. <strong className="text-foreground">Ton argent est garanti dès leur activation.</strong></span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}

        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un membre..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-team"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {([
                  ["all", "Tous"],
                  ["active", "Actifs"],
                  ["free", "Gratuits"],
                  ["inactive", "Inactifs"],
                ] as [FilterType, string][]).map(([f, label]) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users size={40} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">Aucun membre trouvé</p>
                {team?.total === 0 && <p className="text-xs mt-1">Partagez votre lien de parrainage pour recruter vos premiers filleuls.</p>}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(m => (
                  <div key={m.id} className="flex items-center gap-3 py-3" data-testid={`row-member-${m.id}`}>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary text-sm font-bold">{(m.displayName || "?").charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{m.displayName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Globe size={11} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{m.country}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">Niv. {m.level}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {new Date(m.joinedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {m.isActivated ? (
                        <Badge variant="outline" className="text-primary border-primary/30 gap-1 text-xs">
                          <CheckCircle size={10} />Actif
                        </Badge>
                      ) : m.isFreeAccount ? (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/30 gap-1 text-xs">
                          <Sparkles size={10} />Gratuit
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 gap-1 text-xs">
                          <Clock size={10} />Inactif
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
