import { useState } from "react";
import { MessageCircleQuestion, X, Send, CheckCircle2, ChevronRight, AlertTriangle, Info, Megaphone, UserX, Wrench, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// ─── Types de problèmes ──────────────────────────────────────────
const PROBLEM_TYPES = [
  {
    id: "info",
    subject: "Besoin d'informations sur le site",
    label: "Je ne comprends pas le site",
    desc: "J'ai besoin d'explications sur le fonctionnement de TRIXHUB",
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-500/20",
    activeBg: "bg-blue-500/20 border-blue-500/40",
  },
  {
    id: "reclamation",
    subject: "Réclamation",
    label: "Je veux réclamer quelque chose",
    desc: "Un solde incorrect, un paiement manquant, ou autre chose",
    icon: Megaphone,
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
    activeBg: "bg-amber-500/20 border-amber-500/40",
  },
  {
    id: "signalement",
    subject: "Signalement",
    label: "Je veux signaler quelque chose",
    desc: "Signaler un comportement suspect ou une anomalie",
    icon: AlertTriangle,
    color: "text-orange-500",
    bg: "bg-orange-500/10 border-orange-500/20",
    activeBg: "bg-orange-500/20 border-orange-500/40",
  },
  {
    id: "parrain",
    subject: "Dénonciation — parrain malhonnête",
    label: "Mon parrain m'a menti",
    desc: "Mon parrain m'a trompé ou a fait de fausses promesses",
    icon: UserX,
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
    activeBg: "bg-red-500/20 border-red-500/40",
  },
  {
    id: "technique",
    subject: "Problème technique",
    label: "Problème technique / Bug",
    desc: "Le site ne fonctionne pas correctement, j'ai une erreur",
    icon: Wrench,
    color: "text-purple-500",
    bg: "bg-purple-500/10 border-purple-500/20",
    activeBg: "bg-purple-500/20 border-purple-500/40",
  },
  {
    id: "autre",
    subject: "Autre problème",
    label: "Autre problème",
    desc: "Mon problème ne correspond à aucune catégorie ci-dessus",
    icon: HelpCircle,
    color: "text-muted-foreground",
    bg: "bg-muted/40 border-border",
    activeBg: "bg-muted border-border",
  },
] as const;

type ProblemId = (typeof PROBLEM_TYPES)[number]["id"];

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "pick" | "detail" | "done";

function validateWhatsApp(v: string): boolean {
  const digits = v.replace(/[\s\-().+]/g, "");
  return digits.length >= 8 && digits.length <= 15 && /^\d+$/.test(digits);
}

export default function SupportModal({ open, onClose }: SupportModalProps) {
  const [step, setStep] = useState<Step>("pick");
  const [selectedId, setSelectedId] = useState<ProblemId | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const selected = PROBLEM_TYPES.find((t) => t.id === selectedId);
  const whatsappOk = validateWhatsApp(whatsapp);
  const canSend = whatsappOk && message.trim().length >= 5;

  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep("pick");
      setSelectedId(null);
      setWhatsapp("");
      setMessage("");
    }, 300);
  }

  function handleSelectType(id: ProblemId) {
    setSelectedId(id);
    setStep("detail");
  }

  async function handleSend() {
    if (!selected || !canSend) return;
    const finalMessage =
      `📱 WhatsApp de contact : ${whatsapp.trim()}\n\n` +
      `📝 Message :\n${message.trim()}`;

    setSending(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${BASE}/api/contact/assistance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          subject: selected.subject,
          message: finalMessage,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Erreur d'envoi");
      }
      setStep("done");
    } catch (err: unknown) {
      const e = err as Error;
      toast({ title: "Envoi échoué", description: e.message ?? "Réessaie dans quelques secondes.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modale */}
      <div className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center">
              <MessageCircleQuestion className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Contacter le support</h2>
              <p className="text-xs text-muted-foreground">
                {step === "pick" && "Choisis ton type de problème"}
                {step === "detail" && selected?.label}
                {step === "done" && "Message envoyé"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenu */}
        <div className="overflow-y-auto flex-1 p-5">
          {/* Étape 1 : choix du type */}
          {step === "pick" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Quel type de problème rencontres-tu ?
              </p>
              {PROBLEM_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99]",
                      type.bg
                    )}
                    data-testid={`support-type-${type.id}`}
                  >
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", type.bg)}>
                      <Icon className={cn("w-4.5 h-4.5", type.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-bold", type.color)}>{type.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{type.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Étape 2 : saisie du message */}
          {step === "detail" && selected && (
            <div className="space-y-4">
              {/* Rappel du type */}
              <div className={cn("flex items-center gap-3 p-3 rounded-2xl border", selected.activeBg)}>
                <selected.icon className={cn("w-4 h-4 flex-shrink-0", selected.color)} />
                <span className={cn("text-sm font-bold", selected.color)}>{selected.label}</span>
              </div>

              {/* Champ WhatsApp — obligatoire */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Ton numéro WhatsApp <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    className={cn(
                      "w-full rounded-2xl border bg-muted/30 px-4 py-3 text-sm text-foreground transition-all",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                      "placeholder:text-muted-foreground",
                      whatsapp && !whatsappOk
                        ? "border-red-400 focus:ring-red-400/40"
                        : whatsappOk
                        ? "border-green-400 focus:ring-green-400/40"
                        : "border-border"
                    )}
                    placeholder="Ex : +237 6XX XX XX XX"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    autoFocus
                    data-testid="support-whatsapp-input"
                  />
                  {whatsappOk && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
                </div>
                {whatsapp && !whatsappOk && (
                  <p className="text-[11px] text-red-500 mt-1 ml-1">
                    Numéro invalide — inclus l'indicatif pays (ex : +237…)
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1 ml-1">
                  C'est ce numéro que l'admin utilisera pour te recontacter sur WhatsApp.
                </p>
              </div>

              {/* Zone de texte */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Décris ton problème <span className="text-red-500">*</span>
                </label>
                <textarea
                  className={cn(
                    "w-full rounded-2xl border border-border bg-muted/30 p-4 text-sm text-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                    "resize-none transition-all placeholder:text-muted-foreground"
                  )}
                  rows={4}
                  placeholder={
                    selected.id === "parrain"
                      ? "Ex : Mon parrain m'a promis que je gagnerais 10 000 FCFA en 2 jours. Ce n'est pas vrai..."
                      : selected.id === "technique"
                      ? "Ex : Quand je clique sur 'Retirer', j'ai une erreur qui dit..."
                      : selected.id === "reclamation"
                      ? "Ex : J'ai activé mon compte mais je n'ai pas reçu les 800 FCFA de bonus..."
                      : "Explique ton problème en détail. Plus tu es précis, mieux on peut t'aider."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1000}
                  data-testid="support-message-input"
                />
                <p className="text-[10px] text-muted-foreground text-right mt-1">{message.length}/1000</p>
              </div>

              <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-xl px-3 py-2.5">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" />
                <span>
                  Ton message sera transmis à l'admin avec ton nom, email et pays.
                  Il te répondra directement sur ton numéro WhatsApp.
                </span>
              </div>

              <button
                onClick={handleSend}
                disabled={sending || !canSend}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm",
                  sending || !canSend
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:scale-[1.01] active:scale-[0.98]"
                )}
                data-testid="support-send-button"
              >
                {sending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Envoi en cours…
                  </span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Envoyer au support
                  </>
                )}
              </button>

              <button
                onClick={() => { setStep("pick"); setMessage(""); setWhatsapp(""); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1.5 transition-colors"
              >
                ← Changer de catégorie
              </button>
            </div>
          )}

          {/* Étape 3 : confirmation */}
          {step === "done" && (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">Message envoyé !</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ton problème a été transmis à l'admin via WhatsApp.
                  Tu recevras une réponse directement sur le numéro WhatsApp de TRIXHUB.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="mt-2 px-6 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold hover:scale-[1.02] transition-all"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
