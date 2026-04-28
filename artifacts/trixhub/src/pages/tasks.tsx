import { useListTasks, useCompleteTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { formatLocal } from "@/lib/currency";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare, CheckCircle, ExternalLink, Zap, Share2, Video, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, React.ElementType> = {
  social: Share2, survey: ClipboardList, video: Video, referral: Zap, bonus: CheckSquare,
};

const TYPE_LABELS: Record<string, string> = {
  social: "Réseaux sociaux", survey: "Sondage", video: "Vidéo", referral: "Parrainage", bonus: "Bonus",
};

export default function TasksPage() {
  const { user } = useAuth();
  const { data: tasks, isLoading } = useListTasks({ query: { queryKey: getListTasksQueryKey() } });
  const completeTask = useCompleteTask();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleComplete = async (id: number, title: string) => {
    try {
      await completeTask.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      toast({ title: "Tâche complétée !", description: `Votre récompense pour "${title}" a été créditée.` });
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || "Erreur lors de la complétion";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  const pending = tasks?.filter(t => !t.isCompleted) ?? [];
  const completed = tasks?.filter(t => t.isCompleted) ?? [];
  const totalEarned = completed.reduce((sum, t) => sum + t.reward, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tâches & Missions</h1>
            <p className="text-muted-foreground text-sm mt-1">Complétez des missions pour gagner des récompenses supplémentaires</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total gagné</p>
            <p className="text-xl font-bold text-primary amount-display">{formatLocal(totalEarned, user)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="border-card-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold amount-display">{tasks?.length ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total missions</p>
            </CardContent>
          </Card>
          <Card className="border-card-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary amount-display">{completed.length}</p>
              <p className="text-sm text-muted-foreground">Complétées</p>
            </CardContent>
          </Card>
          <Card className="border-card-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-500 amount-display">{pending.length}</p>
              <p className="text-sm text-muted-foreground">Disponibles</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Missions disponibles</h2>
                <div className="grid gap-4">
                  {pending.map(task => {
                    const Icon = TYPE_ICONS[task.type] ?? CheckSquare;
                    return (
                      <Card key={task.id} className="border-card-border hover:border-primary/30 transition-colors" data-testid={`card-task-${task.id}`}>
                        <CardContent className="p-5">
                          <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon size={18} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <p className="font-semibold text-foreground">{task.title}</p>
                                  <Badge variant="secondary" className="text-xs mt-1">{TYPE_LABELS[task.type] ?? task.type}</Badge>
                                </div>
                                <p className="text-lg font-bold text-primary amount-display shrink-0">
                                  +{formatLocal(task.reward, user)}
                                </p>
                              </div>
                              <p className="text-sm text-muted-foreground mt-2">{task.description}</p>
                              <div className="flex gap-2 mt-3">
                                {task.url && (
                                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" asChild>
                                    <a href={task.url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink size={12} />Accéder
                                    </a>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  className="gap-1.5 h-8 text-xs"
                                  onClick={() => handleComplete(task.id, task.title)}
                                  disabled={completeTask.isPending}
                                  data-testid={`button-complete-task-${task.id}`}
                                >
                                  <CheckCircle size={12} />
                                  Marquer complétée
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {completed.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Missions complétées</h2>
                <div className="grid gap-3">
                  {completed.map(task => (
                    <Card key={task.id} className="border-card-border opacity-70">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle size={18} className="text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm">{task.title}</p>
                            {task.completedAt && (
                              <p className="text-xs text-muted-foreground">
                                Complétée le {new Date(task.completedAt).toLocaleDateString("fr-FR")}
                              </p>
                            )}
                          </div>
                          <p className="text-sm font-bold text-primary amount-display">+{formatLocal(task.reward, user)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {tasks?.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <CheckSquare size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">Aucune mission disponible pour le moment.</p>
                <p className="text-xs mt-1">Revenez plus tard, de nouvelles missions seront disponibles.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
