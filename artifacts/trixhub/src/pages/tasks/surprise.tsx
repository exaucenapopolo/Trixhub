import { Link } from "wouter";
import Layout from "@/components/Layout";
import { ArrowLeft, Sparkles, Gift } from "lucide-react";

export default function MissionSurprisePage() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Retour aux missions
        </Link>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mission Surprise</h1>
              <p className="text-sm opacity-90">Une surprise différente chaque jour</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <Gift className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Bientôt disponible</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Reviens dans quelques jours. Chaque jour, une surprise différente t'attendra :
            cadeau, bonus exclusif, défi rapide… le tout pour pimenter ton expérience TRIXHUB.
          </p>
        </div>
      </div>
    </Layout>
  );
}
