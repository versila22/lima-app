import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Activate() {
  const { activateAccount } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const tokenMissing = useMemo(() => token.trim().length === 0, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (tokenMissing) {
      toast.error("Lien d’activation invalide.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await activateAccount({ token, password });
      toast.success(response.detail || "Compte activé avec succès.");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.detail
          : "Impossible d’activer le compte pour le moment."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/50 bg-card/90 shadow-xl">
        <CardHeader>
          <CardTitle>Activer votre compte</CardTitle>
          <CardDescription>
            Définissez votre mot de passe pour accéder au portail membres LIMA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokenMissing ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>Le lien d’activation est incomplet ou expiré.</p>
              <Button asChild className="w-full">
                <Link to="/login">Retour à la connexion</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 8 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Retapez votre mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Activation en cours…
                  </>
                ) : (
                  "Activer mon compte"
                )}
              </Button>

              <Button type="button" variant="ghost" asChild className="w-full">
                <Link to="/login">Retour à la connexion</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
