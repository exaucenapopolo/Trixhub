import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useActivateAccount, useGetPlatformConfig, useGetCurrencyRates, useGetMe, getGetMeQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, TrendingUp, CheckCircle, Lock, Zap, Users, Wallet, Star } from "lucide-react";
import { queryClient } from "@/App";



const schema = z.object({
  paymentMethod: z.string().min(1, "Choisissez une méthode de paiement"),
  paymentReference: z.string().min(4, "Référence de paiement requise (minimum 4 caractères)"),
});

const PAYMENT_METHODS = [
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money", label: "MTN Mobile Money" },
  { value: "wave", label: "Wave" },
  { value: "moov", label: "Moov Money" },
  { value: "free_money", label: "Free Money" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "virement", label: "Virement Bancaire" },
];

const BENEFITS = [
  { icon: TrendingUp, title: "Revenus illimités", desc: "Gagnez 1 700 FCFA, 700 FCFA et 300 FCFA sur 3 niveaux de parrainage" },
  { icon: Users, title: "Réseau puissant", desc: "Construisez une équipe jusqu'à 3 niveaux de profondeur" },
  { icon: Zap, title: "Commissions immédiates", desc: "Vos gains sont crédités instantanément à chaque activation" },
  { icon: Wallet, title: "Retraits faciles", desc: "Retirez dès 3 000 FCFA via Orange Money, MTN, Wave et plus" },
  { icon: Shield, title: "Plateforme sécurisée", desc: "Système anti-fraude et protection de vos données garantis" },
  { icon: Star, title: "Tâches rémunérées", desc: "Accédez à des missions supplémentaires pour augmenter vos gains" },
];

export default function ActivatePage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const activateMutation = useActivateAccount();
  const { data: config } = useGetPlatformConfig();
  const { data: rates } = useGetCurrencyRates();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { paymentMethod: "", paymentReference: "" },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    try {
      const result = await activateMutation.mutateAsync({ data: values });
      login(result.token);
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      toast({ title: "Compte activé !", description: "Bienvenue dans TRIXHUB. Votre compte est maintenant pleinement opérationnel." });
      setLocation("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || "Erreur lors de l'activation";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  const fee = config?.activationFee ?? 3600;
  const currency = me?.preferredCurrency ?? "FCFA";
  const exchangeRate = rates?.rates?.[currency] ?? 1;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl gradient-green flex items-center justify-center shadow-lg">
              <TrendingUp size={24} className="text-white" />
            </div>
            <span className="text-2xl font-bold">TRIX<span className="text-primary">HUB</span></span>
          </div>
          <Badge className="mb-4 gap-1.5 bg-primary/10 text-primary border-primary/30">
            <Zap size={12} />
            Activation requise pour accéder à vos avantages
          </Badge>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4 leading-tight">
            Activez votre compte et commencez<br />à générer des revenus
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            L'activation n'est pas un simple frais d'accès — c'est votre investissement de départ dans un système qui peut vous rapporter des centaines de milliers de FCFA par mois.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Benefits */}
          <div>
            <h2 className="text-xl font-bold mb-6 text-foreground">Ce que vous débloquez</h2>
            <div className="grid gap-4">
              {BENEFITS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 p-4 bg-card rounded-xl border border-card-border">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm text-foreground font-medium mb-2">Exemple de revenus potentiels</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>10 filleuls directs activés</span>
                  <span className="text-primary font-semibold">17 000 FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span>10 x 10 niveau 2 activés</span>
                  <span className="text-primary font-semibold">70 000 FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span>10 x 10 x 10 niveau 3</span>
                  <span className="text-primary font-semibold">300 000 FCFA</span>
                </div>
                <div className="flex justify-between font-bold text-foreground border-t border-border pt-2 mt-2">
                  <span>Total potentiel</span>
                  <span className="text-primary">387 000 FCFA</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment form */}
          <div>
            <div className="bg-card rounded-2xl border border-card-border p-8 shadow-lg">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-foreground mb-1 amount-display">
                  {fee.toLocaleString("fr-FR")} FCFA
                </div>
                {currency !== "FCFA" && (
                  <p className="text-muted-foreground text-sm">
                    ≈ {(fee * exchangeRate).toFixed(2)} {currency}
                  </p>
                )}
                <Badge variant="outline" className="mt-2 text-xs">Paiement unique · Non-récurrent</Badge>
              </div>

              <div className="flex gap-2 mb-6 justify-center flex-wrap">
                <Badge variant="secondary" className="text-xs gap-1"><Shield size={10} />Sécurisé</Badge>
                <Badge variant="secondary" className="text-xs gap-1"><Lock size={10} />Chiffré</Badge>
                <Badge variant="secondary" className="text-xs gap-1"><CheckCircle size={10} />Vérifié</Badge>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Méthode de paiement</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-paymentMethod">
                            <SelectValue placeholder="Choisissez votre méthode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_METHODS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="paymentReference" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Référence / Numéro de transaction</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: TXN123456789" data-testid="input-paymentReference" />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground mt-1">
                        Effectuez votre paiement de {fee.toLocaleString("fr-FR")} FCFA, puis saisissez la référence de transaction reçue.
                      </p>
                    </FormItem>
                  )} />

                  <Button
                    type="submit"
                    className="w-full h-11 text-base font-semibold"
                    disabled={activateMutation.isPending}
                    data-testid="button-submit-activate"
                  >
                    {activateMutation.isPending ? "Activation en cours..." : "Activer mon compte maintenant"}
                  </Button>
                </form>
              </Form>

              <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
                En activant votre compte, vous confirmez avoir effectué le paiement de {fee.toLocaleString("fr-FR")} FCFA. Toute fraude sera sanctionnée conformément à nos conditions d'utilisation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
