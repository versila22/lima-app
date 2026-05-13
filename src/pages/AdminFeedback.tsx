import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, MessageSquareWarning, Trash2, User } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FeedbackItem {
  id: string;
  body: string;
  reporter_name: string | null;
  reporter_member_id: string | null;
  reporter_first_name: string | null;
  reporter_last_name: string | null;
  image_data_url: string | null;
  created_at: string;
}

function reporterLabel(item: FeedbackItem): string {
  if (item.reporter_first_name || item.reporter_last_name) {
    const memberName = `${item.reporter_first_name ?? ""} ${item.reporter_last_name ?? ""}`.trim();
    if (item.reporter_name && item.reporter_name !== memberName) {
      return `${memberName} (saisi : ${item.reporter_name})`;
    }
    return memberName;
  }
  if (item.reporter_name) return item.reporter_name;
  return "Anonyme";
}

export default function AdminFeedback() {
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<FeedbackItem | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<FeedbackItem[]>({
    queryKey: ["admin-feedback"],
    queryFn: () => api.get<FeedbackItem[]>("/feedback"),
  });

  const deleteMut = useMutation<unknown, ApiError, string>({
    mutationFn: (id) => api.delete(`/feedback/${id}`),
    onSuccess: () => {
      toast.success("Retour supprimé");
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      setToDelete(null);
    },
    onError: (err) => toast.error(err.detail ?? "Erreur lors de la suppression"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold">
          <MessageSquareWarning className="h-5 w-5 text-background" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Remarques / bugs</h1>
          <p className="text-sm text-muted-foreground">
            Retours envoyés par les utilisateurs depuis le bouton de la sidebar.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center min-h-[30vh]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Impossible de charger les retours.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (data ?? []).length === 0 && (
        <Card className="border-dashed border-border/70 bg-card/50">
          <CardContent className="p-6 text-sm text-muted-foreground text-center">
            Aucun retour pour le moment.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(data ?? []).map((item) => (
          <Card key={item.id} className="border-border/70 bg-card/80">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <User className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{reporterLabel(item)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(item.created_at), "EEEE d MMMM yyyy 'à' HH'h'mm", {
                        locale: fr,
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setToDelete(item)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm whitespace-pre-wrap">{item.body}</p>

              {item.image_data_url && (
                <button
                  type="button"
                  onClick={() => setLightbox(item.image_data_url)}
                  className="block max-h-48 rounded-md border border-border overflow-hidden bg-background/50 hover:opacity-90 transition-opacity"
                >
                  <img
                    src={item.image_data_url}
                    alt="Capture"
                    className="max-h-48 w-auto object-contain"
                  />
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce retour ?</AlertDialogTitle>
            <AlertDialogDescription>
              Action définitive. Le contenu sera perdu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMut.mutate(toDelete.id)}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lightbox && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => e.key === "Escape" && setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={lightbox}
            alt="Aperçu agrandi"
            className="max-h-[90vh] max-w-[95vw] object-contain"
          />
        </div>
      )}
    </div>
  );
}
