import { useState, type ReactNode } from "react";
import { ShieldOff, MessageCircle, ChevronRight, Lock } from "lucide-react";
import SupportModal from "@/components/SupportModal";
import { cn } from "@/lib/utils";

interface FeatureGateProps {
  blocked?: boolean;
  feature: string;
  children: ReactNode;
}

export default function FeatureGate({ blocked, feature, children }: FeatureGateProps) {
  const [supportOpen, setSupportOpen] = useState(false);

  if (!blocked) return <>{children}</>;

  return (
    <>
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-orange-500/5 pointer-events-none" />

            <div className="relative p-8 flex flex-col items-center text-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center">
                  <ShieldOff size={36} className="text-red-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-orange-500/90 flex items-center justify-center border-2 border-background">
                  <Lock size={13} className="text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">Accès restreint</h2>
                <p className="text-sm font-medium text-muted-foreground">
                  Fonctionnalité : <span className="text-foreground font-semibold">{feature}</span>
                </p>
              </div>

              <div className="w-full rounded-2xl bg-muted/60 border border-border p-4 text-left space-y-2">
                <p className="text-sm text-foreground leading-relaxed">
                  Votre accès à cette fonctionnalité est actuellement <strong>limité par l'équipe TRIXHUB</strong>.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Cela peut être lié à votre contrat avec l'entreprise. Pour rétablir votre accès, veuillez contacter le support afin de régulariser votre situation.
                </p>
              </div>

              <div className={cn(
                "w-full flex items-center gap-3 p-3.5 rounded-2xl border",
                "bg-amber-500/8 border-amber-500/20"
              )}>
                <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                  <span className="text-base">⚠️</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed flex-1">
                  L'accès sera rétabli dès que votre situation sera régularisée auprès de l'équipe.
                </p>
              </div>

              <button
                onClick={() => setSupportOpen(true)}
                className={cn(
                  "w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl",
                  "bg-primary text-primary-foreground font-semibold text-sm",
                  "hover:bg-primary/90 active:scale-[0.98] transition-all"
                )}
              >
                <MessageCircle size={16} />
                Contacter le support
                <ChevronRight size={14} className="ml-auto" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
