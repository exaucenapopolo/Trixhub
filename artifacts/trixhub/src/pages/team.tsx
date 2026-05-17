import { useState } from "react";
import { useGetTeam } from "@workspace/api-client-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import FeatureGate from "@/components/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Search, CheckCircle, Clock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { usePageTitle } from '@/hooks/usePageTitle';

export default function TeamPage() {
  usePageTitle('Mon équipe');
  const { user } = useAuth();
  const { data: team, isLoading } = useGetTeam();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const filtered = team?.members?.filter(m => {
    const matchSearch = !search || `${m.displayName} ${m.country}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "active" && m.isActivated) || (filter === "inactive" && !m.isActivated);
    return matchSearch && matchFilter;
  }) ?? [];

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

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", count: team?.total ?? 0, color: "text-foreground" },
            { label: "Actifs", count: team?.active ?? 0, color: "text-primary" },
            { label: "Inactifs", count: team?.inactive ?? 0, color: "text-amber-500" },
          ].map(({ label, count, color }) => (
            <Card key={label} className="border-card-border">
              <CardContent className="p-4 text-center">
                <p className={cn("text-2xl font-bold amount-display", color)}>{count}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Level links */}
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
              <div className="flex gap-2">
                {(["all", "active", "inactive"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {f === "all" ? "Tous" : f === "active" ? "Actifs" : "Inactifs"}
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
                      ) : (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/30 gap-1 text-xs">
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
