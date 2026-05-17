import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import FeatureGate from "@/components/FeatureGate";
import { useToast } from "@/hooks/use-toast";
import { Palette, Send, CheckCircle2, Sparkles, ShieldCheck, Loader2 } from "lucide-react";
import { usePageTitle } from '@/hooks/usePageTitle';

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const schema = z.object({
  fullName: z.string().min(2, "Votre nom complet est requis"),
  canvaEmail: z.string().email("Email Canva invalide"),
});

export default function BonusCanvaPage() {
  usePageTitle("Bonus Canva");
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  // Source de vérité : le serveur. Anti-fraude : 1 seule demande par membre, à vie.
  const alreadyRequested = Boolean(user?.canvaRequestedAt);
  const formLocked = alreadyRequested || submitted;

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: user?.displayName ?? "", canvaEmail: "" },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setSending(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      let res: Response;
      try {
        res = await fetch(`${BASE}/api/contact/canva`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fullName: values.fullName, canvaEmail: values.canvaEmail }),
        });
      } catch {
        toast({
          title: "Connexion impossible",
          description: "Vérifiez votre connexion internet et réessayez.",
          variant: "destructive",
        });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Échec de l'envoi",
          description: data.error || "Impossible d'envoyer la demande. Réessayez plus tard.",
          variant: "destructive",
        });
        if (res.status === 409) {
          // Déjà demandé : rafraîchir le user pour verrouiller le formulaire
          refreshUser();
        }
        return;
      }
      setSubmitted(true);
      refreshUser();
      toast({
        title: "Demande envoyée !",
        description: "L'assistance a bien reçu votre demande Canva Pro et vous répondra rapidement.",
      });
    } finally {
      setSending(false);
    }
  };

  const requestedDate = user?.canvaRequestedAt
    ? new Date(user.canvaRequestedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  if (user?.blockedCanva) return (
    <Layout>
      <FeatureGate blocked feature="Canva Pro">{null}</FeatureGate>
    </Layout>
  );

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/15 flex items-center justify-center shrink-0">
            <Palette size={24} className="text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compte Canva Pro offert</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Bonus exclusif TRIXHUB : recevez gratuitement un compte Canva Pro pour créer vos visuels professionnels.
            </p>
          </div>
        </div>

        {(alreadyRequested || submitted) && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-primary">Demande déjà envoyée{requestedDate ? ` le ${requestedDate}` : ""}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Une seule demande Canva Pro est autorisée par membre. Notre équipe vous répondra par WhatsApp.
                  Si vous n'avez pas reçu votre compte, contactez l'assistance.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              Ce que vous recevez
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Accès complet à Canva Pro (modèles premium, photos, vidéos illimitées)</p>
            <p>• Suppression d'arrière-plan automatique et redimensionnement magique</p>
            <p>• Stockage de marque (logos, couleurs, polices) pour des visuels cohérents</p>
            <p>• Idéal pour créer vos publications de parrainage qui convertissent</p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Demander mon compte
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <ShieldCheck size={10} /> 1 seule demande
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {formLocked
                ? "Votre demande a déjà été envoyée à l'assistance."
                : "Remplissez ce formulaire. Votre demande est envoyée directement à l'assistance."}
            </p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <fieldset disabled={formLocked} className="space-y-4 disabled:opacity-60">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Votre nom complet</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Jean Kouassi" data-testid="input-canva-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="canvaEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email associé à votre compte Canva</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="vous@example.com" data-testid="input-canva-email" />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground mt-1">
                        Si vous n'avez pas encore de compte Canva, créez-le d'abord sur canva.com puis revenez ici.
                      </p>
                    </FormItem>
                  )} />
                </fieldset>
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={sending || formLocked}
                  data-testid="button-canva-submit"
                >
                  {formLocked ? <CheckCircle2 size={16} /> : sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {formLocked ? "Demande déjà envoyée" : sending ? "Envoi en cours..." : "Envoyer ma demande"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
