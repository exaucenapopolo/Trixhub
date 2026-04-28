import { useState } from "react";
import { useRoute } from "wouter";
import { useGetReferralsByLevel } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Search, CheckCircle, Clock, Globe, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocal } from "@/lib/currency";

export default function TeamLevelPage() {
  const { user } = useAuth();
  const [, params] = useRoute("/team/level/:level");
  const level = parseInt(params?.level ?? "1", 10);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const { data, isLoading } = useGetReferralsByLevel(level);

  const filtered = data?.members?.filter(m => {
    const matchSearch = !search || `${m.displayName} ${m.country}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "active" && m.isActivated) || (filter === "inactive" && !m.isActivated);
    return matchSearch && matchFilter;
  }) ?? [];

  const levelColors: Record<number, string> = { 1: "text-primary", 2: "text-blue-500", 3: "text-purple-500" };
  const color = levelColors[level] ?? "text-primary";

  // Gain potentiel = commission * filleuls inactifs (ceux qui pourraient encore activer)
  const potentialGain = (data?.inactive ?? 0) * (data?.commission ?? 0);
  const earnedGain = (data?.active ?? 0) * (data?.commission ?? 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Niveau {level}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Commission : <span className={cn("font-semibold", color)}>{formatLocal(data?.commission ?? 0, user)}</span> par activation
          </p>
        </div>

        {/* Gain réalisé / potentiel */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-card-border bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={14} className="text-primary" />
                <p className="text-xs text-muted-foreground font-medium">Déjà gagné à ce niveau</p>
              </div>
              <p className="text-xl font-bold text-primary amount-display">{formatLocal(earnedGain, user)}</p>
            </CardContent>
          </Card>
          <Card className="border-card-border bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-amber-500" />
                <p className="text-xs text-muted-foreground font-medium">Potentiel à débloquer</p>
              </div>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 amount-display">{formatLocal(potentialGain, user)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", count: data?.total ?? 0, color: "text-foreground" },
            { label: "Actifs", count: data?.active ?? 0, color: "text-primary" },
            { label: "Inactifs", count: data?.inactive ?? 0, color: "text-amber-500" },
          ].map(({ label, count, color: c }) => (
            <Card key={label} className="border-card-border">
              <CardContent className="p-4 text-center">
                <p className={cn("text-2xl font-bold amount-display", c)}>{count}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid={`input-search-level-${level}`}
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
                <p className="text-sm">Aucun membre à ce niveau</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(m => (
                  <div key={m.id} className="flex items-center gap-3 py-3" data-testid={`row-level-member-${m.id}`}>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary text-sm font-bold">{(m.displayName || "?").charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{m.displayName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Globe size={11} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{m.country}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
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
