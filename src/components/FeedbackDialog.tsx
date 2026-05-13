import { useEffect, useState } from "react";
import { MessageSquareWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface FeedbackDialogProps {
  /** Element used as the dialog trigger (Button, icon button, etc.). */
  trigger: React.ReactNode;
}

export function FeedbackDialog({ trigger }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const { user } = useAuth();

  // Pre-fill the name field with the user's name when the dialog opens
  useEffect(() => {
    if (open && user) {
      setName(`${user.first_name} ${user.last_name}`.trim());
    }
  }, [open, user]);

  const submit = useMutation<unknown, ApiError>({
    mutationFn: () =>
      api.post("/feedback", {
        body: body.trim(),
        reporter_name: name.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Merci, ton retour a bien été envoyé !");
      setBody("");
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err.detail ?? "Impossible d'envoyer le retour. Réessaie plus tard.");
    },
  });

  const canSubmit = body.trim().length > 0 && !submit.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-card border-border w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-primary" />
            Remarque ou bug
          </DialogTitle>
          <DialogDescription>
            Une idée, un souci, un truc qui te chiffonne ? Dis-moi tout — je verrai si je l'intègre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="feedback-name">Nom (facultatif)</Label>
            <Input
              id="feedback-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anonyme si vide"
              className="bg-background/50"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-body">Ton message</Label>
            <Textarea
              id="feedback-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Décris le bug, la remarque ou la suggestion…"
              className="bg-background/50 min-h-[140px]"
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {body.length}/5000
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submit.isPending}>
            Annuler
          </Button>
          <Button onClick={() => submit.mutate()} disabled={!canSubmit}>
            {submit.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Envoi…
              </>
            ) : (
              "Envoyer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
