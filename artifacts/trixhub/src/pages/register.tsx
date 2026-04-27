import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegister, useGetPlatformConfig, useGetCurrencyRates } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, TrendingUp, Users, Lock, CheckCircle, Star } from "lucide-react";
import { formatDualAmount } from "@/lib/currency";

const schema = z.object({
  firstName: z.string().min(2, "Le prénom doit avoir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit avoir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(8, "Numéro de téléphone invalide"),
  country: z.string().min(1, "Choisissez un pays"),
  password: z.string().min(8, "Le mot de passe doit avoir au moins 8 caractères"),
  confirmPassword: z.string(),
  referralCode: z.string().optional(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const COUNTRIES = [
  "Sénégal", "Côte d'Ivoire", "Mali", "Burkina Faso", "Niger", "Guinée",
  "Togo", "Bénin", "Cameroun", "Congo-Brazzaville", "RD Congo", "Gabon",
  "Tchad", "Centrafrique", "Madagascar", "Mauritanie", "Djibouti",
  "Comores", "Rwanda", "Burundi", "France", "Belgique", "Canada",
  "Suisse", "Maroc", "Tunisie", "Algérie", "Autre"
];

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const { data: config } = useGetPlatformConfig();
  const { data: rates } = useGetCurrencyRates();

  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get("ref") || "";

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "", lastName: "", email: "", phone: "",
      country: "", password: "", confirmPassword: "", referralCode: refCode,
    },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    try {
      const result = await registerMutation.mutateAsync({
        data: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          country: values.country,
          password: values.password,
          referralCode: values.referralCode || null,
        },
      });
      login(result.token);
      toast({ title: "Compte créé !", description: "Bienvenue sur TRIXHUB. Activez votre compte pour commencer." });
      setLocation("/activate");
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || "Une erreur est survenue";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  const exchangeRate = rates?.rates?.["EUR"] ?? 0.00152;
  const activationFee = config?.activationFee ?? 3600;
  const l1 = config?.level1Commission ?? 1700;
  const l2 = config?.level2Commission ?? 700;
  const l3 = config?.level3Commission ?? 300;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-green flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-56 h-56 rounded-full bg-white blur-2xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <TrendingUp size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white">TRIXHUB</span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Construisez votre réseau.<br />Gagnez des commissions.
          </h1>
          <p className="text-white/80 text-lg mb-10">
            La plateforme d'affiliation africaine la plus fiable. Rejoignez des milliers de membres qui génèrent des revenus passifs chaque jour.
          </p>

          <div className="space-y-4">
            {[
              { level: "Niveau 1", amount: l1, desc: "par filleul direct activé" },
              { level: "Niveau 2", amount: l2, desc: "sur votre réseau de 2e rang" },
              { level: "Niveau 3", amount: l3, desc: "sur votre réseau de 3e rang" },
            ].map(({ level, amount, desc }) => (
              <div key={level} className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-lg amount-display">{amount.toLocaleString("fr-FR")}</span>
                </div>
                <div>
                  <p className="text-white font-semibold">{level} — FCFA</p>
                  <p className="text-white/70 text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <Shield size={16} className="text-white/70" />
          <span className="text-white/70 text-sm">Plateforme sécurisée · Données chiffrées · Anti-fraude intégré</span>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-lg gradient-green flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold">TRIX<span className="text-primary">HUB</span></span>
          </div>

          <div className="mb-8">
            <Badge variant="outline" className="text-primary border-primary/30 mb-4 gap-1.5">
              <CheckCircle size={12} />
              Inscription 100% gratuite
            </Badge>
            <h2 className="text-2xl font-bold text-foreground mb-2">Créer votre compte</h2>
            <p className="text-muted-foreground text-sm">
              Rejoignez TRIXHUB et commencez à gagner des commissions dès aujourd'hui.
            </p>
          </div>

          {/* Security badges */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <Badge variant="secondary" className="text-xs gap-1"><Shield size={10} />SSL Sécurisé</Badge>
            <Badge variant="secondary" className="text-xs gap-1"><Lock size={10} />Anti-fraude</Badge>
            <Badge variant="secondary" className="text-xs gap-1"><Star size={10} />Certifié</Badge>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl><Input {...field} placeholder="Kofi" data-testid="input-firstName" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl><Input {...field} placeholder="Mensah" data-testid="input-lastName" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse email</FormLabel>
                  <FormControl><Input type="email" {...field} placeholder="kofi@exemple.com" data-testid="input-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl><Input {...field} placeholder="+225 07 00 00 00 00" data-testid="input-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pays</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-country"><SelectValue placeholder="Choisissez votre pays" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mot de passe</FormLabel>
                  <FormControl><Input type="password" {...field} placeholder="Minimum 8 caractères" data-testid="input-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmer le mot de passe</FormLabel>
                  <FormControl><Input type="password" {...field} placeholder="Répétez votre mot de passe" data-testid="input-confirmPassword" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="referralCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Code de parrainage <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: KOF0001ABC" data-testid="input-referralCode" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold"
                disabled={registerMutation.isPending}
                data-testid="button-submit-register"
              >
                {registerMutation.isPending ? "Création en cours..." : "Créer mon compte gratuitement"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Déjà membre ?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">Se connecter</Link>
            </p>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              En vous inscrivant, vous acceptez nos conditions d'utilisation. L'activation de votre compte ({activationFee.toLocaleString("fr-FR")} FCFA) sera requise pour accéder aux fonctionnalités de gains.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
