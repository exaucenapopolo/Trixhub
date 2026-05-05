import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2, Search, Download, BookUser, Phone, CheckCircle2, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Contact = {
  id: number;
  displayName: string;
  phone: string;
  country: string;
  isActivated: boolean;
  createdAt: string;
};

function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    fetch(`${BASE}/api/contacts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((d: { contacts?: Contact[]; total?: number; error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setContacts(d.contacts ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setError("Impossible de charger les contacts."))
      .finally(() => setLoading(false));
  }, []);

  return { contacts, total, loading, error };
}

function exportVCF(contacts: Contact[]) {
  const lines: string[] = [];
  for (const c of contacts) {
    lines.push("BEGIN:VCARD");
    lines.push("VERSION:3.0");
    lines.push(`FN:${c.displayName} (TRIXHUB)`);
    lines.push(`N:${c.displayName};;;`);
    lines.push(`TEL;TYPE=CELL,VOICE:${c.phone}`);
    if (c.country) lines.push(`ADR;TYPE=HOME:;;;;;;${c.country}`);
    lines.push(`NOTE:Membre TRIXHUB${c.isActivated ? " · Actif" : " · Inactif"}`);
    lines.push("END:VCARD");
    lines.push("");
  }

  const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contacts-trixhub-${new Date().toISOString().slice(0, 10)}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ContactsPage() {
  usePageTitle("Mes Contacts");
  const { contacts, total, loading, error } = useContacts();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return contacts.filter(c => {
      const matchSearch = !q || c.displayName.toLowerCase().includes(q) || c.phone.includes(q) || c.country.toLowerCase().includes(q);
      const matchFilter = filter === "all" || (filter === "active" ? c.isActivated : !c.isActivated);
      return matchSearch && matchFilter;
    });
  }, [contacts, search, filter]);

  const activeCount = contacts.filter(c => c.isActivated).length;

  return (
    <Layout>
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <BookUser className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Mes Contacts</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Tous les membres inscrits sur TRIXHUB. Télécharge la liste pour les contacter sur WhatsApp.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6 text-center">
            <p className="text-sm text-destructive font-semibold">{error}</p>
          </div>
        ) : (
          <>
            {/* Stats + Export */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card border border-card-border rounded-2xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xl font-bold text-foreground">{total}</p>
                <p className="text-[11px] text-muted-foreground">Inscrits</p>
              </div>
              <div className="bg-card border border-card-border rounded-2xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</p>
                <p className="text-[11px] text-muted-foreground">Actifs</p>
              </div>
              <div className="bg-card border border-card-border rounded-2xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{total - activeCount}</p>
                <p className="text-[11px] text-muted-foreground">Inactifs</p>
              </div>
            </div>

            {/* Bouton export */}
            <button
              onClick={() => exportVCF(filtered)}
              disabled={filtered.length === 0}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all",
                filtered.length > 0
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Download className="w-4 h-4" />
              Télécharger {filtered.length} contact{filtered.length > 1 ? "s" : ""} (.vcf)
            </button>

            {/* Recherche + filtre */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher nom, numéro, pays…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-card border border-card-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
              <select
                value={filter}
                onChange={e => setFilter(e.target.value as "all" | "active" | "inactive")}
                className="bg-card border border-card-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              >
                <option value="all">Tous</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
              </select>
            </div>

            {/* Liste contacts */}
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Aucun contact trouvé.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((c, i) => (
                  <div
                    key={c.id}
                    className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    {/* Avatar initiale */}
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold",
                      c.isActivated ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                    )}>
                      {c.displayName.charAt(0).toUpperCase()}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.displayName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground">{c.phone}</span>
                        {c.country && (
                          <span className="text-xs text-muted-foreground">· {c.country}</span>
                        )}
                      </div>
                    </div>

                    {/* Badge statut */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        c.isActivated
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {c.isActivated ? "Actif" : "Inactif"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Note bas */}
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Le fichier .vcf peut être importé directement dans les contacts WhatsApp, Android ou iPhone.
              </p>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
