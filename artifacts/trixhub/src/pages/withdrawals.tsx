import { useListWithdrawals, useRequestWithdrawal, useGetBalances, getListWithdrawalsQueryKey, getGetBalancesQueryKey } from "@workspace/api-client-react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, ArrowUpRight, Clock, CheckCircle, XCircle, AlertCircle, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";

const schema = z.object({
  amount: z.number({ coerce: true }).min(3000, "Minimum 3 000 FCFA"),
  method: z.string().min(1, "Choisissez une méthode"),
  accountNumber: z.string().min(8, "Numéro de compte requis"),
  accountName: z.string().min(3, "Nom du compte requis"),
});

const METHODS = [
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money", label: "MTN Mobile Money" },
  { value: "wave", label: "Wave" },
  { value: "moov", label: "Moov Money" },
  { value: "free_money", label: "Free Money" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "virement", label: "Virement Bancaire" },
];

const STATUS_CONFIG = {
  pending: { label: "En attente", color: "text-amber-500 border-amber-500/30", icon: Clock },
  processing: { label: "En traitement", color: "text-blue-500 border-blue-500/30", icon: ArrowUpRight },
  completed: { label: "Validé", color: "text-primary border-primary/30", icon: CheckCircle },
  rejected: { label: "Rejeté", color: "text-destructive border-destructive/30", icon: XCircle },
};

export default function WithdrawalsPage() {
  const [open, setOpen] = useState(false);
  const { data: withdrawals, isLoading } = useListWithdrawals({ query: { queryKey: getListWithdrawalsQueryKey() } });
  const { data: balances } = useGetBalances({ query: { queryKey: getGetBalancesQueryKey() } });
  const requestWithdrawal = useRequestWithdrawal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 3000, method: "", accountNumber: "", accountName: "" },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    try {
      await requestWithdrawal.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalancesQueryKey() });
      toast({ title: "Demande envoyée !", description: "Votre demande de retrait est en cours de traitement." });
      form.reset();
      setOpen(false);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || "Erreur lors de la demande";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  const currency = balances?.currency ?? "FCFA";
  const exchangeRate = balances?.exchangeRate ?? 1;
  const available = balances?.totalBalance ?? 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Retraits</h1>
            <p className="text-muted-foreground text-sm mt-1">Gérez vos demandes de retrait</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5" data-testid="button-new-withdrawal">
                <Plus size={16} />Nouveau retrait
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Demande de retrait</DialogTitle>
              </DialogHeader>
              <div className="p-1">
                <div className="flex gap-4 mb-6">
                  <div className="flex-1 p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Solde disponible</p>
                    <p className="text-lg font-bold text-primary amount-display">{available.toLocaleString("fr-FR")} FCFA</p>
                  </div>
                  <div className="flex-1 p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Minimum</p>
                    <p className="text-lg font-bold amount-display">3 000 FCFA</p>
                  </div>
                </div>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="amount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant (FCFA)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={e => field.onChange(parseFloat(e.target.value))}
                            placeholder="3000"
                            data-testid="input-withdrawal-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="method" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Méthode de paiement</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-withdrawal-method">
                              <SelectValue placeholder="Choisissez" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="accountNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro de compte / téléphone</FormLabel>
                        <FormControl><Input {...field} placeholder="+225 07 00 00 00 00" data-testid="input-withdrawal-account" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="accountName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du titulaire</FormLabel>
                        <FormControl><Input {...field} placeholder="Kofi Mensah" data-testid="input-withdrawal-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg">
                      <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Les retraits sont traités sous 24 à 72 heures ouvrables. Assurez-vous que vos informations sont correctes.
                      </p>
                    </div>
                    <Button type="submit" className="w-full" disabled={requestWithdrawal.isPending} data-testid="button-submit-withdrawal">
                      {requestWithdrawal.isPending ? "Envoi en cours..." : "Confirmer la demande"}
                    </Button>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Balance overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Solde disponible", amount: available, color: "text-primary" },
            { label: "Minimum retrait", amount: balances?.minimumWithdrawal ?? 3000, color: "text-foreground" },
            { label: "Total retiré", amount: balances?.withdrawnAmount ?? 0, color: "text-muted-foreground" },
            { label: "Total investi", amount: balances?.spentAmount ?? 0, color: "text-muted-foreground" },
          ].map(({ label, amount, color }) => (
            <Card key={label} className="border-card-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={cn("text-xl font-bold amount-display", color)}>{amount.toLocaleString("fr-FR")}</p>
                <p className="text-xs text-muted-foreground">FCFA</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Withdrawals list */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Historique des retraits</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : !withdrawals || withdrawals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet size={40} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">Aucun retrait pour le moment</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {withdrawals.map(w => {
                  const status = STATUS_CONFIG[w.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                  const Icon = status.icon;
                  return (
                    <div key={w.id} className="flex items-center gap-4 py-4" data-testid={`row-withdrawal-${w.id}`}>
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Wallet size={16} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{METHODS.find(m => m.value === w.method)?.label ?? w.method}</p>
                        <p className="text-xs text-muted-foreground">{w.accountName} · {w.accountNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(w.requestedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-foreground amount-display">{w.amount.toLocaleString("fr-FR")} FCFA</p>
                        <Badge variant="outline" className={cn("text-xs gap-1 mt-1", status.color)}>
                          <Icon size={10} />{status.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
