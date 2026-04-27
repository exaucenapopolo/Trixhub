import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, TrendingUp, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useState } from "react";

const schema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    try {
      const result = await loginMutation.mutateAsync({ data: values });
      login(result.token);
      toast({ title: "Connexion réussie", description: `Bienvenue, ${result.user.firstName} !` });
      if (!result.user.isActivated) {
        setLocation("/activate");
      } else {
        setLocation("/dashboard");
      }
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error || "Email ou mot de passe incorrect";
      toast({ title: "Erreur de connexion", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl gradient-green flex items-center justify-center shadow-lg">
              <TrendingUp size={24} className="text-white" />
            </div>
            <span className="text-2xl font-bold">TRIX<span className="text-primary">HUB</span></span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Bon retour !</h1>
          <p className="text-muted-foreground">Connectez-vous à votre espace membre</p>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-8 shadow-lg">
          <div className="flex gap-2 mb-6 justify-center">
            <Badge variant="secondary" className="text-xs gap-1"><Shield size={10} />Connexion sécurisée</Badge>
            <Badge variant="secondary" className="text-xs gap-1"><Lock size={10} />Chiffrement SSL</Badge>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} placeholder="votre@email.com" autoComplete="email" data-testid="input-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mot de passe</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        {...field}
                        placeholder="Votre mot de passe"
                        autoComplete="current-password"
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold gap-2"
                disabled={loginMutation.isPending}
                data-testid="button-submit-login"
              >
                {loginMutation.isPending ? "Connexion..." : <>Se connecter <ArrowRight size={16} /></>}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Pas encore membre ?{" "}
              <Link href="/" className="text-primary font-medium hover:underline">S'inscrire gratuitement</Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Vos données sont protégées par un chiffrement de niveau bancaire.
        </p>
      </div>
    </div>
  );
}
