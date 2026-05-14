import { useState } from "react";
import { CalendarPlus, Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, ApiError, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";

interface TokenResponse {
  token: string;
  path: string;
}

export function IcalSubscribeCard() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = useMutation<TokenResponse, ApiError>({
    mutationFn: () => api.post<TokenResponse>("/members/me/ical-token", {}),
    onSuccess: (res) => {
      setUrl(`${API_BASE_URL}${res.path}`);
    },
    onError: (err) => toast.error(err.detail ?? "Impossible de générer le lien"),
  });

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("URL copiée");
    } catch {
      toast.error("Copie impossible — sélectionne et copie à la main");
    }
  };

  return (
    <Card className="border-border/70 bg-card/80">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="hover:bg-card/60 transition-colors rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarPlus className="h-5 w-5 text-primary" />
              S'abonner au calendrier
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Synchronise tes spectacles et entraînements dans Apple Calendar, Google
              Calendar, Outlook…
            </p>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {!url ? (
              <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
                {generate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Génération…
                  </>
                ) : (
                  "Générer mon lien d'abonnement"
                )}
              </Button>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input value={url} readOnly className="bg-background/50 font-mono text-xs" />
                  <Button onClick={handleCopy} variant="outline" size="icon">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">Comment l'utiliser :</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>
                      <span className="font-medium text-foreground">iPhone / Mac :</span>{" "}
                      Réglages → Calendrier → Comptes → Ajouter un compte → Autre →
                      "Ajouter un calendrier d'abonnement". Colle l'URL.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Google Calendar :</span>{" "}
                      Côté gauche → "Autres agendas" → "+" → "À partir de l'URL".
                      Colle l'URL.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Outlook :</span>{" "}
                      "Ajouter un calendrier" → "S'abonner depuis le web". Colle l'URL.
                    </li>
                  </ul>
                </div>
                <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Lien personnel — ne le partage pas.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => generate.mutate()}
                    disabled={generate.isPending}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Régénérer (invalide l'ancien)
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
