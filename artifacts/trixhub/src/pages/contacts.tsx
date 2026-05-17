import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/context/AuthContext";
import FeatureGate from "@/components/FeatureGate";
import {
  Loader2, BookUser, Users, Download, ShoppingCart,
  AlertCircle, ChevronDown, History, Lock, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocal, formatLocalWithFcfa, type CurrencyTarget } from "@/lib/currency";
import { Link } from "wouter";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const PRICE_PER_CONTACT = 2; // FCFA

function authHeader(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type ContactsInfo = {
  total: number;
  alreadyOwned: number;
  available: number;
  pricePerContact: number;
};

type Purchase = {
  id: number;
  quantity: number;
  priceFcfa: string;
  currency: string;
  priceInCurrency: string;
  orderType: string;
  createdAt: string;
};

type PurchaseResult = {
  purchaseId: number;
  quantity: number;
  priceFcfa: number;
  currency: string;
  priceInCurrency: number;
  contacts: { displayName: string; phone: string; country: string }[];
};

export default function ContactsPage() {
  usePageTitle("Mes Contacts");
  const { user } = useAuth();
  const currencyTarget: CurrencyTarget = user;

  const [info, setInfo] = useState<ContactsInfo | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [depositBalance, setDepositBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(10);
  const [orderType, setOrderType] = useState<"newest" | "oldest">("newest");
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [lastPurchase, setLastPurchase] = useState<PurchaseResult | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [infoRes, purchasesRes, balRes] = await Promise.all([
        fetch(`${BASE}/api/contacts`, { headers: authHeader() }),
        fetch(`${BASE}/api/contacts/my-purchases`, { headers: authHeader() }),
        fetch(`${BASE}/api/balances`, { headers: authHeader() }),
      ]);

      if (!infoRes.ok) {
        const d = await infoRes.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Erreur de chargement.");
        setLoading(false);
        return;
      }

      const [infoData, purchasesData, balData] = await Promise.all([
        infoRes.json(),
        purchasesRes.ok ? purchasesRes.json() : { purchases: [] },
        balRes.ok ? balRes.json() : {},
      ]);

      setInfo(infoData);
      setPurchases((purchasesData as { purchases: Purchase[] }).purchases ?? []);
      setDepositBalance(parseFloat((balData as { depositBalance?: string }).depositBalance ?? "0") || 0);
    } catch {
      setError("Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const priceFcfa = quantity * PRICE_PER_CONTACT;
  const canAfford = depositBalance >= priceFcfa;
  const maxBuyable = info ? Math.min(info.available, 10000) : 0;

  const handleBuy = async () => {
    if (!canAfford || buying || !info || info.available === 0) return;
    setBuying(true);
    setBuyError(null);
    setLastPurchase(null);
    try {
      const res = await fetch(`${BASE}/api/contacts/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ quantity, orderType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBuyError((data as { error?: string }).error ?? "Erreur lors de l'achat.");
        return;
      }
      setLastPurchase(data as PurchaseResult);
      // Déclencher le téléchargement immédiatement
      triggerVcfDownload(data.contacts, data.purchaseId);
      // Recharger les données
      loadData();
    } catch {
      setBuyError("Erreur réseau. Réessaie.");
    } finally {
      setBuying(false);
    }
  };

  function triggerVcfDownload(
    contacts: { displayName: string; phone: string; country: string }[],
    purchaseId: number
  ) {
    const lines: string[] = [];
    for (const c of contacts) {
      lines.push("BEGIN:VCARD");
      lines.push("VERSION:3.0");
      lines.push(`FN:${c.displayName} (TRIXHUB)`);
      lines.push(`N:${c.displayName};;;;`);
      lines.push(`TEL;TYPE=CELL,VOICE:${c.phone}`);
      if (c.country) lines.push(`ADR;TYPE=HOME:;;;;;;${c.country}`);
      lines.push("NOTE:Membre TRIXHUB");
      lines.push("END:VCARD");
      lines.push("");
    }
    const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-trixhub-${purchaseId}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const handleDownloadPurchase = async (purchaseId: number) => {
    setDownloadingId(purchaseId);
    try {
      const res = await fetch(`${BASE}/api/contacts/download/${purchaseId}`, {
        headers: authHeader(),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contacts-trixhub-${purchaseId}.vcf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  if (user?.blockedContacts) return (
    <Layout>
      <FeatureGate blocked feature="Achat de contacts">{null}</FeatureGate>
    </Layout>
  );

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
            Achète des contacts WhatsApp des membres TRIXHUB et télécharge-les sur ton téléphone.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive font-semibold">{error}</p>
            {!user?.isActivated && (
              <Link href="/activate" className="inline-flex items-center gap-1.5 text-sm text-primary font-medium">
                Activer mon compte <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card border border-card-border rounded-2xl p-4 text-center">
                <Users className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">{info!.total.toLocaleString("fr-FR")}</p>
                <p className="text-[11px] text-muted-foreground">Total inscrits</p>
              </div>
              <div className="bg-card border border-card-border rounded-2xl p-4 text-center">
                <Lock className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{info!.available.toLocaleString("fr-FR")}</p>
                <p className="text-[11px] text-muted-foreground">Disponibles</p>
              </div>
              <div className="bg-card border border-card-border rounded-2xl p-4 text-center">
                <Download className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{info!.alreadyOwned.toLocaleString("fr-FR")}</p>
                <p className="text-[11px] text-muted-foreground">Déjà achetés</p>
              </div>
            </div>

            {/* Prix info */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Tarif : 2 FCFA par contact</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chaque achat te donne de nouveaux contacts — jamais les mêmes que ceux déjà téléchargés.
                  Le fichier .vcf s'importe directement dans WhatsApp, Android ou iPhone.
                </p>
              </div>
            </div>

            {/* Formulaire d'achat */}
            {info!.available > 0 ? (
              <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-bold text-foreground">Acheter des contacts</h2>

                {/* Quantité */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nombre de contacts à acheter
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxBuyable}
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Math.min(maxBuyable, parseInt(e.target.value) || 1)))}
                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum disponible : {info!.available.toLocaleString("fr-FR")} contacts
                  </p>
                </div>

                {/* Ordre */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Ordre des contacts
                  </label>
                  <div className="relative">
                    <select
                      value={orderType}
                      onChange={e => setOrderType(e.target.value as "newest" | "oldest")}
                      className="w-full appearance-none px-4 py-3 bg-muted/40 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-10"
                    >
                      <option value="newest">Nouveaux inscrits en premier</option>
                      <option value="oldest">Premiers inscrits en premier</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* Prix + solde */}
                <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{quantity.toLocaleString("fr-FR")} contacts × 2 FCFA</span>
                    <span className="font-bold text-foreground">
                      {(() => {
                        const r = formatLocalWithFcfa(priceFcfa, currencyTarget);
                        return r.secondary ? `${r.primary} (${r.secondary})` : r.primary;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ton solde dépôt</span>
                    <span className={cn("font-bold", canAfford ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                      {formatLocal(depositBalance, currencyTarget)}
                    </span>
                  </div>
                  {!canAfford && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-destructive font-medium">
                        Solde insuffisant. Il te manque{" "}
                        <strong>{formatLocal(priceFcfa - depositBalance, currencyTarget)}</strong>.
                      </p>
                    </div>
                  )}
                </div>

                {buyError && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive">
                    {buyError}
                  </div>
                )}

                {lastPurchase && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                    ✓ {lastPurchase.quantity} contacts achetés — le téléchargement a démarré automatiquement.
                  </div>
                )}

                {canAfford ? (
                  <button
                    onClick={handleBuy}
                    disabled={buying || info!.available === 0}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                  >
                    {buying ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Achat en cours…</>
                    ) : (
                      <><ShoppingCart className="w-4 h-4" /> Payer et télécharger ({formatLocal(priceFcfa, currencyTarget)})</>
                    )}
                  </button>
                ) : (
                  <Link href="/depot">
                    <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm">
                      Déposer de l'argent pour continuer <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="bg-card border border-card-border rounded-2xl p-6 text-center space-y-2">
                <p className="text-sm font-semibold text-foreground">Tous les contacts ont été achetés</p>
                <p className="text-xs text-muted-foreground">De nouveaux membres s'inscrivent régulièrement. Reviens bientôt !</p>
              </div>
            )}

            {/* Historique des achats */}
            {purchases.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-base font-bold text-foreground">Historique des achats</h2>
                </div>
                <div className="space-y-2">
                  {purchases.map(p => {
                    const fcfa = parseFloat(p.priceFcfa);
                    const displayed = formatLocalWithFcfa(fcfa, currencyTarget);
                    return (
                      <div key={p.id} className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <BookUser className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {p.quantity.toLocaleString("fr-FR")} contacts
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              ({p.orderType === "newest" ? "nouveaux" : "anciens"})
                            </span>
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {displayed.secondary
                                ? `${displayed.primary} (${displayed.secondary})`
                                : displayed.primary}
                            </span>
                            <span className="text-[10px] text-muted-foreground">· {fmtDate(p.createdAt)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadPurchase(p.id)}
                          disabled={downloadingId === p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-medium disabled:opacity-60"
                        >
                          {downloadingId === p.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          .vcf
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Note technique bas */}
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Le fichier .vcf peut être importé directement dans les contacts de ton téléphone — compatible WhatsApp, Android et iPhone.
              </p>
            </div>

            {/* Section valeur — toujours visible */}
            <div className="bg-gradient-to-br from-primary/8 via-card to-amber-500/5 border border-primary/20 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <h3 className="text-base font-bold text-foreground">Tu n'achètes pas des contacts. Tu achètes des opportunités.</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Contrairement aux groupes WhatsApp aléatoires où tout le monde est mélangé sans lien commun, les membres TRIXHUB partagent le même centre d'intérêt : <strong className="text-foreground">l'entrepreneuriat, le développement personnel et la génération de revenus</strong>.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { icon: "🏢", title: "Chefs d'entreprise", desc: "Des entrepreneurs actifs qui cherchent à développer leur réseau et leurs partenariats." },
                  { icon: "👔", title: "Professionnels motivés", desc: "Des personnes déjà engagées dans une démarche active d'amélioration de leur situation financière." },
                  { icon: "🤝", title: "Potentiels clients & partenaires", desc: "Des profils ouverts à de nouvelles propositions commerciales, collaborations et opportunités." },
                  { icon: "🚀", title: "Prospection ciblée", desc: "Quand tu les contactes, tu n'envoies pas un message dans le vide — tu parles à quelqu'un qui est déjà dans la bonne dynamique." },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 bg-background/60 rounded-xl p-3">
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-primary/10 border border-primary/25 rounded-xl p-4">
                <p className="text-sm text-foreground font-medium leading-relaxed">
                  À 2 FCFA le contact, tu accèdes à une opportunité de business, de collaboration ou de vente. <br />
                  <span className="text-muted-foreground font-normal">Présente-toi, prospecte, crée des synergies — le reste dépend de toi.</span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
