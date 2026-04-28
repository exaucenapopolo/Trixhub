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
import { Shield, User, Globe, Copy, CheckCircle, Link as LinkIcon, Camera, Trash2, Loader2 } from "lucide-react";
import { CURRENCY_LABELS } from "@/lib/currency";
import { resolveAvatarUrl } from "@/lib/utils";
import { useRef, useState } from "react";

const TOKEN_KEY = "trixhub_token";
const ACCEPTED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const AVATAR_MAX_BYTES = 3 * 1024 * 1024;

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

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const updateCurrency = useUpdatePreferredCurrency();
  const [linkCopied, setLinkCopied] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState<"upload" | "delete" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarSrc = resolveAvatarUrl(user?.avatarUrl);

  const triggerAvatarPicker = () => {
    if (avatarBusy) return;
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de réuploader le même fichier
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleAvatarFileChange}
              data-testid="input-avatar-file"
            />
            <div className="flex items-center gap-4">
              {/* Avatar avec overlay caméra */}
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
                  {/* Overlay au hover/click */}
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
