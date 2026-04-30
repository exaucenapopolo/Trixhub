import { useState, useMemo, useRef } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  ArrowLeft,
  Sparkles,
  Trophy,
  CheckCircle2,
  Copy,
  Upload,
  Loader2,
  MessageCircle,
  Eye,
  ImageIcon,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  useSubmitSurpriseActivity,
  useGetActivitiesSchedule,
  getGetWeeklyStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ─── 10 messages marketing SBH rotatifs ──────────────────────────
const MESSAGES = [
  {
    id: "sbh-viral",
    label: "Devenir viral",
    preview: "Pendant que les autres attendent...",
    text: `🚀 Tu veux devenir VIRAL sur les réseaux sociaux ?\n\nPendant que les autres attendent que l'algorithme les remarque, les gens qui réussissent utilisent *Social Boost Horizon* !\n\n🎁 À ton inscription, tu reçois un CADEAU DE BIENVENUE :\n✅ Des likes gratuits\n✅ Des abonnés gratuits\n✅ Des vues gratuites\n\n📲 Télécharge l'app maintenant :\n👉 https://socialboosthorizon.com/telecharger.html\n\n#SocialBoostHorizon #TrixHub`,
  },
  {
    id: "sbh-boost",
    label: "Boost Instagram & TikTok",
    preview: "Instagram, TikTok, YouTube — booste tout en 1 clic !",
    text: `💥 Instagram, TikTok, YouTube — booste tout en 1 clic !\n\nJ'utilise *Social Boost Horizon* et mes stats ont explosé 🔥\n\n✅ Abonnés réels\n✅ Vues instantanées\n✅ Likes authentiques\n✅ Cadeau de bienvenue à l'inscription !\n\n👉 https://socialboosthorizon.com/telecharger.html\n\n#Boost #SocialBoostHorizon`,
  },
  {
    id: "sbh-netflix",
    label: "Netflix moins cher",
    preview: "Accède à Netflix pour beaucoup moins cher !",
    text: `🎬 Fini de payer Netflix plein tarif !\n\nVia *Social Boost Horizon*, j'accède à Netflix Premium à prix réduit — HD, 4K, tout y est !\n\n💡 L'app propose aussi Spotify, ChatGPT, Canva Pro à des prix imbattables.\n\n🎁 Cadeau de bienvenue dès l'inscription !\n\n📲 https://socialboosthorizon.com/telecharger.html\n\n#Netflix #SocialBoostHorizon`,
  },
  {
    id: "sbh-chatgpt",
    label: "ChatGPT & IA moins cher",
    preview: "L'intelligence artificielle à ta portée !",
    text: `🤖 L'intelligence artificielle à ta portée !\n\nChatGPT Plus à 20$/mois ? Pas avec *Social Boost Horizon* !\n\nVia l'app, accède à ChatGPT, Canva Pro, Midjourney et plus — à des tarifs accessibles.\n\n🎁 Cadeau de bienvenue : likes & abonnés offerts à l'inscription !\n\n👉 https://socialboosthorizon.com/telecharger.html\n\n#ChatGPT #IA #SocialBoostHorizon`,
  },
  {
    id: "sbh-reseller",
    label: "Devenir revendeur",
    preview: "Crée ton propre business de boost en ligne !",
    text: `💰 Tu veux gagner de l'argent en ligne ?\n\nAvec *Social Boost Horizon*, tu peux ouvrir un compte revendeur et vendre des services de boost à tes propres clients !\n\n✅ Boost Instagram, TikTok, YouTube\n✅ Abonnements Netflix, Spotify, Canva Pro\n✅ Marges attractives\n✅ Cadeau de bienvenue à l'inscription !\n\n📲 https://socialboosthorizon.com/telecharger.html\n\n#Business #SocialBoostHorizon`,
  },
  {
    id: "sbh-welcome",
    label: "Cadeau de bienvenue",
    preview: "Reçois un cadeau dès ton inscription !",
    text: `🎁 J'ai reçu un CADEAU GRATUIT à mon inscription sur *Social Boost Horizon* !\n\nLikes, abonnés, vues — offerts dès que tu rejoins la plateforme.\n\nEt après ça, tu peux commander :\n📺 Netflix & Spotify à petit prix\n💡 ChatGPT & Canva Pro accessibles\n📈 Boost de tes réseaux sociaux\n\n👉 https://socialboosthorizon.com/telecharger.html\n\n#Gratuit #SocialBoostHorizon`,
  },
  {
    id: "sbh-website",
    label: "Site web & App mobile",
    preview: "Lance ton projet digital sans te ruiner !",
    text: `🌐 Tu veux un site web ou une application mobile ?\n\n*Social Boost Horizon* connecte les entrepreneurs africains avec des développeurs professionnels — à des tarifs vraiment accessibles.\n\n✅ Site vitrine\n✅ E-commerce\n✅ Application mobile\n✅ Cadeau de bienvenue à l'inscription !\n\n📲 https://socialboosthorizon.com/telecharger.html\n\n#WebDev #SocialBoostHorizon`,
  },
  {
    id: "sbh-canva",
    label: "Canva Pro réduit",
    preview: "Crée des designs pro pour pas cher !",
    text: `🎨 Canva Pro à prix réduit — c'est possible !\n\nVia *Social Boost Horizon*, accède à Canva Pro sans payer le plein tarif.\n\nTemplates premium, suppression de fond, exports HD — tout ce qu'il faut pour des créations professionnelles.\n\n🎁 + cadeau de bienvenue à l'inscription (likes & abonnés gratuits) !\n\n👉 https://socialboosthorizon.com/telecharger.html\n\n#Canva #Design #SocialBoostHorizon`,
  },
  {
    id: "sbh-spotify",
    label: "Spotify sans pub",
    preview: "Écoute ta musique sans publicité !",
    text: `🎵 Plus jamais de pubs dans ta musique !\n\nSpotify Premium sans se ruiner — c'est possible via *Social Boost Horizon* !\n\n✅ Écoute hors ligne\n✅ Qualité audio supérieure\n✅ Zéro publicité\n\n💡 L'app propose aussi Netflix, ChatGPT, boost réseaux et plus encore.\n\n🎁 Cadeau de bienvenue à l'inscription !\n\n👉 https://socialboosthorizon.com/telecharger.html\n\n#Spotify #SocialBoostHorizon`,
  },
  {
    id: "sbh-all",
    label: "Tout en 1 plateforme",
    preview: "Plus de 50 services en 1 seule app !",
    text: `🔥 Une seule app pour tout !\n\n*Social Boost Horizon* = la plateforme qui change ta vie numérique :\n\n📺 Netflix, Spotify, ChatGPT, Canva Pro à prix réduit\n📱 Boost Instagram, TikTok, YouTube, Facebook\n🌐 Création de site web & app mobile\n💼 Compte revendeur pour gagner de l'argent\n\n🎁 CADEAU DE BIENVENUE à l'inscription !\n\n📲 https://socialboosthorizon.com/telecharger.html\n\n#SocialBoostHorizon #TrixHub`,
  },
] as const;

type Phase = "select" | "share" | "upload" | "processing" | "done";

function pointsLabel(pts: number) {
  if (pts === 0) return "Aucun point (moins de 10 vues)";
  if (pts === 100) return "+100 pts (100 vues ou plus)";
  return `+${pts} pts (${pts} vues détectées)`;
}

export default function ActivitiesSurprisePage() {
  usePageTitle('Activité Surprise');
  const { data: schedule, refetch: refetchSchedule } = useGetActivitiesSchedule();
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedMsg, setSelectedMsg] = useState<(typeof MESSAGES)[number] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [result, setResult] = useState<{ points: number; viewCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitMut = useSubmitSurpriseActivity();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isAlreadyDone = useMemo(() => {
    const today = schedule?.days.find((d) => d.isToday);
    return today?.activities.find((a) => a.type === "surprise")?.isCompleted ?? false;
  }, [schedule]);

  const isFriday = useMemo(() => {
    const d = new Date();
    const cameroon = new Date(d.getTime() + 60 * 60 * 1000);
    return cameroon.getUTCDay() === 5; // 0=dimanche, 5=vendredi
  }, []);

  const handleCopyMessage = () => {
    if (!selectedMsg) return;
    void navigator.clipboard.writeText(selectedMsg.text).then(() => {
      toast({ title: "Message copié !", description: "Colle-le dans ton statut WhatsApp." });
    });
  };

  const handleOpenWhatsApp = () => {
    if (!selectedMsg) return;
    const encoded = encodeURIComponent(selectedMsg.text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
    setPhase("upload");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Format invalide", description: "JPG, PNG ou WebP seulement.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image trop grande", description: "Max 10 MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // dataUrl = "data:image/jpeg;base64,/9j/..."
      const [meta, b64] = dataUrl.split(",");
      const mime = meta.split(":")[1].split(";")[0];
      setPreviewUrl(dataUrl);
      setImageBase64(b64);
      setImageMime(mime);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!imageBase64) return;
    setPhase("processing");
    try {
      const res = await submitMut.mutateAsync({ data: { imageBase64, mimeType: imageMime } });
      setResult({ points: res.points, viewCount: res.viewCount });
      setPhase("done");
      await qc.invalidateQueries({ queryKey: getGetWeeklyStatusQueryKey() });
      await refetchSchedule();
      if (res.points > 0) {
        toast({ title: `🎉 +${res.points} pts gagnés !`, description: `${res.viewCount} vues détectées sur ton statut.` });
      } else {
        toast({ title: "Soumission acceptée", description: `${res.viewCount} vues détectées — moins de 10 vues, aucun point attribué.`, variant: "destructive" });
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast({ title: "Erreur", description: e.response?.data?.error ?? "Erreur lors de l'analyse", variant: "destructive" });
      setPhase("upload");
    }
  };

  const handleReset = () => {
    setPhase("select");
    setSelectedMsg(null);
    setPreviewUrl(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Back */}
        <Link href="/activities">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Retour aux activités
          </Button>
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-purple-500" />
              Activité Surprise
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Partage une pub SBH sur ton statut WhatsApp et gagne jusqu'à{" "}
              <strong>+100 pts</strong> selon tes vues
            </p>
          </div>
          <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-2 rounded-xl">
            <Trophy className="w-4 h-4 text-purple-600" />
            <span className="font-bold text-purple-600 text-sm">Jusqu'à 100 pts</span>
          </div>
        </div>

        {/* ── Non disponible aujourd'hui ── */}
        {!isFriday && (
          <Card className="border-muted">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <AlertCircle className="w-10 h-10 text-muted-foreground" />
              <div className="font-bold text-lg">Disponible uniquement le vendredi</div>
              <div className="text-sm text-muted-foreground">
                Reviens vendredi pour partager une pub Social Boost Horizon et gagner jusqu'à 100 pts !
              </div>
              <Link href="/activities">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour aux activités
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* ── Déjà fait ── */}
        {isFriday && isAlreadyDone && phase !== "done" && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <div className="text-lg font-bold">Activité terminée cette semaine !</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Tu as déjà soumis ta capture d'écran. Reviens vendredi prochain.
                </div>
              </div>
              <Link href="/activities">
                <Button variant="outline" className="mt-2">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour aux activités
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* ── Activité disponible ── */}
        {isFriday && !isAlreadyDone && phase !== "done" && (
          <>
            {/* Règle des points */}
            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2 font-bold text-sm text-purple-700 dark:text-purple-300">
                  <Eye className="w-4 h-4" />
                  Barème des points selon les vues
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  <div className="bg-background rounded-lg p-2 border">
                    <div className="font-black text-red-500">0 pt</div>
                    <div className="text-muted-foreground">Moins de 10 vues</div>
                  </div>
                  <div className="bg-background rounded-lg p-2 border">
                    <div className="font-black text-amber-500">10–99 pts</div>
                    <div className="text-muted-foreground">= nombre de vues</div>
                  </div>
                  <div className="bg-background rounded-lg p-2 border">
                    <div className="font-black text-green-500">100 pts</div>
                    <div className="text-muted-foreground">100 vues ou plus</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Phase 1 : Sélection du message ── */}
            {phase === "select" && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Choisis un message publicitaire à partager sur ton statut WhatsApp :
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MESSAGES.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => setSelectedMsg(msg)}
                      className={cn(
                        "text-left p-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500",
                        selectedMsg?.id === msg.id
                          ? "border-purple-500 bg-purple-500/5"
                          : "border-border hover:border-purple-300",
                      )}
                      data-testid={`msg-card-${msg.id}`}
                    >
                      <div className="font-bold text-sm mb-1">{msg.label}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{msg.preview}</div>
                    </button>
                  ))}
                </div>

                {selectedMsg && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-muted/50 border p-4 text-sm whitespace-pre-wrap text-foreground/80 max-h-48 overflow-y-auto">
                      {selectedMsg.text}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyMessage}
                        className="gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Copier le message
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleOpenWhatsApp}
                        className="gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Ouvrir WhatsApp
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                      💡 <strong>Comment faire :</strong> Copie le message → ouvre WhatsApp → va dans{" "}
                      <em>Mon statut</em> → colle le texte → publie → attends les vues → reviens ici
                      avec une capture d'écran.
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-600"
                      onClick={() => setPhase("upload")}
                    >
                      J'ai déjà partagé, passer à l'upload →
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ── Phase 2 : Upload capture d'écran ── */}
            {phase === "upload" && (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => setPhase("select")} className="gap-2 text-muted-foreground">
                  <ArrowLeft className="w-3 h-3" /> Retour aux messages
                </Button>

                <Card>
                  <CardContent className="p-5 space-y-4">
                    <div className="font-bold text-sm flex items-center gap-2">
                      <Upload className="w-4 h-4 text-purple-500" />
                      Upload ta capture d'écran du statut WhatsApp
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Prends une capture d'écran de ton statut WhatsApp qui montre le nombre de vues,
                      puis importe-la ici. La capture doit clairement afficher le compteur de vues.
                    </div>

                    <label className="block cursor-pointer">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                        data-testid="file-input"
                      />
                      {previewUrl ? (
                        <div className="relative rounded-xl overflow-hidden border-2 border-purple-500/30">
                          <img
                            src={previewUrl}
                            alt="Aperçu"
                            className="w-full max-h-80 object-contain bg-muted"
                          />
                          <div className="absolute bottom-2 right-2 text-xs bg-black/60 text-white px-2 py-1 rounded-md">
                            Cliquer pour changer
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-purple-400 transition-colors">
                          <ImageIcon className="w-10 h-10 text-muted-foreground" />
                          <div className="text-sm font-medium">Cliquer pour importer</div>
                          <div className="text-xs text-muted-foreground">JPG, PNG ou WebP · Max 10 MB</div>
                        </div>
                      )}
                    </label>

                    {imageBase64 && (
                      <Button
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold"
                        onClick={() => void handleSubmit()}
                        data-testid="button-submit"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Analyser ma capture d'écran
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Phase 3 : Traitement ── */}
            {phase === "processing" && (
              <Card>
                <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                  <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                  <div className="font-bold text-lg">Analyse en cours…</div>
                  <div className="text-sm text-muted-foreground">
                    L'IA analyse ta capture d'écran pour détecter le nombre de vues.
                    <br />
                    Cela prend quelques secondes.
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── Phase 4 : Résultat ── */}
        {phase === "done" && result && (
          <Card
            className={cn(
              "border-2",
              result.points > 0
                ? "border-purple-500/30 bg-purple-500/5"
                : "border-amber-500/20 bg-amber-500/5",
            )}
          >
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center",
                  result.points > 0 ? "bg-purple-500/15" : "bg-amber-500/15",
                )}
              >
                {result.points > 0 ? (
                  <Sparkles className="w-8 h-8 text-purple-600" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                )}
              </div>
              <div>
                <div
                  className={cn(
                    "text-2xl font-black",
                    result.points > 0 ? "text-purple-600" : "text-amber-600",
                  )}
                >
                  {result.points > 0 ? `+${result.points} pts gagnés !` : "Aucun point attribué"}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  <Eye className="w-3.5 h-3.5 inline mr-1" />
                  {result.viewCount} vue{result.viewCount > 1 ? "s" : ""} détectée
                  {result.viewCount > 1 ? "s" : ""} sur ton statut
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {result.points === 0
                    ? "Il te faut au moins 10 vues pour gagner des points."
                    : "L'admin a été notifié et tes points ont été crédités."}
                </div>
              </div>
              <div className="flex flex-col items-center gap-3 w-full">
                {result.points === 0 && (
                  <div className="text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg text-center">
                    Tu ne peux soumettre qu'une capture par semaine. Reviens vendredi prochain avec plus de vues !
                  </div>
                )}
                <Link href="/activities">
                  <Button
                    className={cn(
                      "text-white",
                      result.points > 0
                        ? "bg-gradient-to-r from-purple-500 to-pink-500"
                        : "bg-gradient-to-r from-amber-500 to-orange-500",
                    )}
                  >
                    Retour aux activités
                    <Trophy className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
