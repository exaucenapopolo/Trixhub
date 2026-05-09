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
import {
  Shield, User, Globe, Copy, CheckCircle, Link as LinkIcon, Camera, Trash2, Loader2,
  Users2, Briefcase, TrendingUp, Star, Info, X,
} from "lucide-react";
import { CURRENCY_LABELS } from "@/lib/currency";
import { resolveAvatarUrl } from "@/lib/utils";
import { useRef, useState } from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from "@/lib/utils";

const TOKEN_KEY = "trixhub_token";
const ACCEPTED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const AVATAR_MAX_BYTES = 3 * 1024 * 1024;
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const profileSchema = z.object({
  displayName: z.string().min(2, "Nom d'affichage requis (min. 2 caractères)"),
  phone: z.string().min(8, "Numéro invalide"),
  country: z.string().min(1, "Pays requis"),
});

const AFRICAN_COUNTRIES = [
  "Bénin", "Burkina Faso", "Cameroun", "Côte d'Ivoire", "Congo-Brazzaville",
  "RD Congo", "Gabon", "Ghana", "Guinée", "Kenya", "Madagascar",
  "Mali", "Niger", "Nigeria", "Rwanda", "Sénégal", "Togo", "Tanzanie",
];

function PhoneVisibleInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted text-muted-foreground"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Users2 size={20} className="text-emerald-500" />
          </div>
          <h3 className="font-bold text-foreground text-base">Visibilité de votre contact</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Votre numéro WhatsApp sera disponible dans l'annuaire communautaire TRIXHUB, accessible uniquement aux membres ayant un compte activé.
        </p>
        <div className="space-y-3 mb-4">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Les avantages de partager</p>
          {[
            { icon: Briefcase, text: "Des entrepreneurs et chefs d'entreprise pourront vous contacter pour des opportunités de partenariat ou de collaboration." },
            { icon: TrendingUp, text: "Des professionnels pourront vous solliciter pour des projets communs ou des opportunités d'affaires." },
            { icon: Star, text: "Chaque contact est une porte ouverte : clients, partenaires, opportunités inattendues." },
            { icon: Users2, text: "Vous bénéficiez aussi de l'annuaire pour contacter d'autres membres selon vos besoins." },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={12} className="text-emerald-500" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Totalement libre :</strong> Activer ou désactiver cette option n'a aucune incidence sur vos soldes, commissions ou quoi que ce soit d'autre sur votre compte.
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  usePageTitle('Mon profil');
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const updateCurrency = useUpdatePreferredCurrency();
  const [linkCopied, setLinkCopied] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState<"upload" | "delete" | null>(null);
  const [showPhoneVisibleInfo, setShowPhoneVisibleInfo] = useState(false);
  const [phoneVisiblePending, setPhoneVisiblePending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarSrc = resolveAvatarUrl(user?.avatarUrl);

  const triggerAvatarPicker = () => {
    if (avatarBusy) return;
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      toast({ title: "Format non supporté", description: "Utilise PNG, JPG ou WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast({ title: "Fichier trop volumineux", description: "Taille maximale : 3 Mo.", variant: "destructive" });
      return;
    }

    setAvatarBusy("upload");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${BASE}/api/users/me/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Échec du téléversement");
      }
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      refreshUser();
      toast({ title: "Photo de profil mise à jour", description: "Ta nouvelle photo est en ligne." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec du téléversement";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setAvatarBusy(null);
    }
  };

  const handleAvatarDelete = async () => {
    if (avatarBusy || !user?.avatarUrl) return;
    setAvatarBusy("delete");
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${BASE}/api/users/me/avatar`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Échec de la suppression");
      }
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      refreshUser();
      toast({ title: "Photo supprimée", description: "Ta photo de profil a été retirée." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de la suppression";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setAvatarBusy(null);
    }
  };

  const handlePhoneVisibleToggle = async (newValue: boolean) => {
    setPhoneVisiblePending(true);
    try {
      await updateProfile.mutateAsync({ data: { phoneVisible: newValue } });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      refreshUser();
      toast({
        title: newValue ? "Numéro rendu visible" : "Numéro masqué",
        description: newValue
          ? "Votre numéro est maintenant accessible aux membres activés."
          : "Votre numéro n'est plus visible dans l'annuaire.",
      });
    } catch {
      toast({ title: "Erreur", description: "Impossible de modifier la visibilité.", variant: "destructive" });
    } finally {
      setPhoneVisiblePending(false);
    }
  };

  const referralLink = `${window.location.origin}${BASE}/?ref=${user?.referralCode}`;

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName ?? "",
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
      toast({ title: "Devise mise à jour", description: `Votre devise est maintenant ${currency}.` });
    } catch {
      toast({ title: "Erreur", description: "Impossible de changer la devise.", variant: "destructive" });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast({ title: "Lien copié !" });
  };

  const initials = (user?.displayName || user?.email || "?").charAt(0).toUpperCase();
  const isPhoneVisible = user?.phoneVisible ?? false;

  return (
    <Layout>
      {showPhoneVisibleInfo && <PhoneVisibleInfoModal onClose={() => setShowPhoneVisibleInfo(false)} />}

      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mon Profil</h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez vos informations personnelles et préférences</p>
        </div>

        {/* Profile header */}
        <Card className="border-card-border">
          <CardContent className="p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleAvatarFileChange}
              data-testid="input-avatar-file"
            />
            <div className="flex items-center gap-4">
              <div className="relative shrink-0 group">
                <button
                  type="button"
                  onClick={triggerAvatarPicker}
                  disabled={avatarBusy !== null}
                  className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-primary/30 shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label="Changer la photo de profil"
                  data-testid="button-avatar-change"
                >
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={user?.displayName ?? "Avatar"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full gradient-green flex items-center justify-center">
                      <span className="text-white text-3xl font-bold">{initials}</span>
                    </div>
                  )}
                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {avatarBusy === "upload" ? (
                      <Loader2 size={18} className="text-white animate-spin" />
                    ) : (
                      <Camera size={18} className="text-white" />
                    )}
                  </span>
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-foreground truncate">{user?.displayName}</h2>
                <p className="text-muted-foreground text-sm truncate">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                  {isPhoneVisible && (
                    <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                      <Users2 size={10} />Visible
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Boutons avatar */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border/60">
              <Button
                onClick={triggerAvatarPicker}
                disabled={avatarBusy !== null}
                size="sm"
                variant="outline"
                className="gap-1.5"
                data-testid="button-avatar-upload"
              >
                {avatarBusy === "upload" ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                {avatarSrc ? "Changer la photo" : "Ajouter une photo"}
              </Button>
              {avatarSrc && (
                <Button
                  onClick={handleAvatarDelete}
                  disabled={avatarBusy !== null}
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  data-testid="button-avatar-delete"
                >
                  {avatarBusy === "delete" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Supprimer
                </Button>
              )}
              <span className="text-[11px] text-muted-foreground ml-auto">PNG, JPG ou WEBP — max 3 Mo</span>
            </div>
          </CardContent>
        </Card>

        {/* Referral link */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon size={16} className="text-primary" />
              Votre lien de parrainage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 bg-background rounded-lg border border-border font-mono text-xs text-muted-foreground truncate">
                {referralLink}
              </div>
              <Button onClick={copyLink} variant="outline" size="sm" className="gap-1.5 shrink-0" data-testid="button-copy-referral-link">
                {linkCopied ? <CheckCircle size={14} className="text-primary" /> : <Copy size={14} />}
                {linkCopied ? "Copié !" : "Copier"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Partagez ce lien pour parrainer de nouveaux membres et gagner des commissions.
            </p>
          </CardContent>
        </Card>

        {/* Contact visibility */}
        <Card className={cn("border-card-border", isPhoneVisible && "border-emerald-500/30")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users2 size={18} className={isPhoneVisible ? "text-emerald-500" : "text-muted-foreground"} />
              Visibilité de mon contact
              <button
                type="button"
                onClick={() => setShowPhoneVisibleInfo(true)}
                className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline font-normal"
              >
                <Info size={12} /> En savoir plus
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={isPhoneVisible}
                disabled={phoneVisiblePending}
                onClick={() => handlePhoneVisibleToggle(!isPhoneVisible)}
                className={cn(
                  "relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50",
                  isPhoneVisible ? "bg-emerald-500" : "bg-muted-foreground/30"
                )}
                data-testid="toggle-phone-visible"
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200",
                    isPhoneVisible ? "translate-x-6" : "translate-x-0"
                  )}
                >
                  {phoneVisiblePending && <Loader2 size={12} className="absolute inset-0 m-auto text-emerald-500 animate-spin" />}
                </span>
              </button>

              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {isPhoneVisible ? "Mon numéro est visible par la communauté" : "Mon numéro est masqué"}
                </p>
                {isPhoneVisible ? (
                  <div className="mt-1.5 space-y-1">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Votre numéro WhatsApp est accessible aux membres ayant un compte activé.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        { icon: Briefcase, label: "Partenariats" },
                        { icon: TrendingUp, label: "Opportunités" },
                        { icon: Star, label: "Clients potentiels" },
                      ].map(({ icon: Icon, label }) => (
                        <span key={label} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                          <Icon size={9} />{label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Activez pour apparaître dans l'annuaire communautaire et recevoir des opportunités professionnelles.
                  </p>
                )}
                <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-2 font-medium">
                  Vous pouvez changer ce choix à tout moment — aucun impact sur votre compte ou vos gains.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Currency preference */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Devise d'affichage</CardTitle>
          </CardHeader>
          <CardContent>
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
            <p className="text-xs text-muted-foreground mt-2">
              Les montants en FCFA seront convertis dans votre devise préférée sur tout le site.
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
                <FormField control={profileForm.control} name="displayName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom d'affichage</FormLabel>
                    <FormControl><Input {...field} placeholder="Votre nom" data-testid="input-profile-displayName" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={profileForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone / WhatsApp</FormLabel>
                    <FormControl><Input {...field} placeholder="+225 07 00 00 00 00" data-testid="input-profile-phone" /></FormControl>
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
                        {AFRICAN_COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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

        {/* Security */}
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
