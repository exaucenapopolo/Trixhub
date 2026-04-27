import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdateProfile, useUpdatePreferredCurrency, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, User, Globe, Copy, CheckCircle } from "lucide-react";
import { CURRENCY_LABELS } from "@/lib/currency";
import { useState } from "react";

const profileSchema = z.object({
  firstName: z.string().min(2, "Prénom requis"),
  lastName: z.string().min(2, "Nom requis"),
  phone: z.string().min(8, "Numéro invalide"),
  country: z.string().min(1, "Pays requis"),
});

const COUNTRIES = [
  "Sénégal", "Côte d'Ivoire", "Mali", "Burkina Faso", "Niger", "Guinée",
  "Togo", "Bénin", "Cameroun", "Congo-Brazzaville", "RD Congo", "Gabon",
  "France", "Belgique", "Canada", "Suisse", "Maroc", "Tunisie", "Algérie", "Autre"
];

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const updateCurrency = useUpdatePreferredCurrency();
  const [codeCopied, setCodeCopied] = useState(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
      country: user?.country ?? "",
    },
  });

  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
    try {
      await updateProfile.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      refreshUser();
      toast({ title: "Profil mis à jour", description: "Vos informations ont été enregistrées." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le profil.", variant: "destructive" });
    }
  };

  const handleCurrencyChange = async (currency: string) => {
    try {
      await updateCurrency.mutateAsync({ data: { currency } });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      refreshUser();
      toast({ title: "Devise mise à jour", description: `Votre devise préférée est maintenant ${currency}.` });
    } catch {
      toast({ title: "Erreur", description: "Impossible de changer la devise.", variant: "destructive" });
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(user?.referralCode ?? "");
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
    toast({ title: "Code copié !" });
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mon Profil</h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez vos informations personnelles et préférences</p>
        </div>

        {/* Profile header */}
        <Card className="border-card-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full gradient-green flex items-center justify-center shrink-0">
                <span className="text-white text-2xl font-bold">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{user?.firstName} {user?.lastName}</h2>
                <p className="text-muted-foreground text-sm">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  {user?.isActivated ? (
                    <Badge className="gap-1 bg-primary/10 text-primary border-primary/30 text-xs">
                      <CheckCircle size={10} />Compte Actif
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">Compte Inactif</Badge>
                  )}
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Globe size={10} />{user?.country}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral code */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Votre code de parrainage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 bg-background rounded-lg border border-border font-mono text-lg font-bold text-primary tracking-widest">
                {user?.referralCode}
              </div>
              <Button onClick={copyCode} variant="outline" size="sm" className="gap-1.5 shrink-0" data-testid="button-copy-referral-code">
                {codeCopied ? <CheckCircle size={14} className="text-primary" /> : <Copy size={14} />}
                {codeCopied ? "Copié !" : "Copier"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Partagez ce code pour parrainer de nouveaux membres et gagner des commissions.
            </p>
          </CardContent>
        </Card>

        {/* Currency preference */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Devise d'affichage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Select defaultValue={user?.preferredCurrency ?? "FCFA"} onValueChange={handleCurrencyChange}>
                <SelectTrigger className="flex-1" data-testid="select-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CURRENCY_LABELS).map(([code, label]) => (
                    <SelectItem key={code} value={code}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Les montants en FCFA seront convertis et affichés dans votre devise préférée sur tout le site.
            </p>
          </CardContent>
        </Card>

        {/* Edit profile */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User size={18} />Informations personnelles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={profileForm.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom</FormLabel>
                      <FormControl><Input {...field} data-testid="input-profile-firstName" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={profileForm.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl><Input {...field} data-testid="input-profile-lastName" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={profileForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl><Input {...field} data-testid="input-profile-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={profileForm.control} name="country" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pays</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-profile-country">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" disabled={updateProfile.isPending} data-testid="button-save-profile">
                  {updateProfile.isPending ? "Enregistrement..." : "Sauvegarder les modifications"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Security info */}
        <Card className="border-card-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-primary" />
              <div>
                <p className="font-medium text-foreground text-sm">Sécurité du compte</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vos données sont chiffrées et protégées. Pour modifier votre email ou mot de passe, contactez le support.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
