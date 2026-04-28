import { Link } from "wouter";
import Layout from "@/components/Layout";
import { ArrowLeft, Compass, Sparkles } from "lucide-react";

export default function MissionDecouvertePage() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Retour aux missions
        </Link>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mission Découverte</h1>
              <p className="text-sm opacity-90">Découvre des produits et services partenaires africains</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-purple-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Bientôt disponible</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Cette mission arrive très bientôt. Tu pourras découvrir et tester des services africains
            (banques, assurances, e-commerce…) et gagner un bonus à chaque découverte.
          </p>
        </div>
      </div>
    </Layout>
  );
}
