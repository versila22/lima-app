import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Settings2, Loader2, Save, Trash2, AlertTriangle } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { AppSettings } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

// Date de coupure de la purge des anciens événements (premier alignement fiable).
const PURGE_BEFORE = "2026-03-01";

type SettingsFormData = {
  association_name: string;
  association_email: string;
  association_website: string;
  membership_fee_default: number;
  player_fee_match: number;
  player_fee_cabaret: number;
  player_fee_loisir: number;
  activation_token_validity_days: number;
  reset_token_validity_hours: number;
};

export default function Settings() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<SettingsFormData>();

  // Fetch
  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: () => api.get<AppSettings>("/settings"),
  });

  // Populate form once loaded
  useEffect(() => {
    if (settings) {
      reset({
        association_name: settings.association_name as string,
        association_email: settings.association_email as string,
        association_website: settings.association_website as string,
        membership_fee_default: settings.membership_fee_default as number,
        player_fee_match: settings.player_fee_match as number,
        player_fee_cabaret: settings.player_fee_cabaret as number,
        player_fee_loisir: settings.player_fee_loisir as number,
        activation_token_validity_days: settings.activation_token_validity_days as number,
        reset_token_validity_hours: settings.reset_token_validity_hours as number,
      });
    }
  }, [settings, reset]);

  const queryClient = useQueryClient();

  // Save mutation
  const saveMutation = useMutation<AppSettings, ApiError, SettingsFormData>({
    mutationFn: (data) =>
      api.put<AppSettings>("/settings", data),
    onSuccess: () => toast.success("Paramètres sauvegardés"),
    onError: (err) => toast.error(err.detail ?? "Erreur lors de la sauvegarde"),
  });

  // Purge old events
  const purgeMutation = useMutation<{ deleted: number }, ApiError>({
    mutationFn: () =>
      api.post<{ deleted: number }>("/api/admin/events/purge-before", undefined, {
        before: PURGE_BEFORE,
      }),
    onSuccess: (res) => {
      toast.success(`${res.deleted} ancien(s) événement(s) supprimé(s)`);
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err) => toast.error(err.detail ?? "Erreur lors de la purge"),
  });

  const onSubmit = (data: SettingsFormData) => {
    saveMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-background" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Paramètres</h1>
          <p className="text-sm text-muted-foreground">Configuration de l'association (admin)</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Association */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">Association</CardTitle>
            <CardDescription>Informations générales de l'asso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assoc-name">Nom</Label>
              <Input
                id="assoc-name"
                {...register("association_name")}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assoc-email">Email</Label>
              <Input
                id="assoc-email"
                type="email"
                {...register("association_email")}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assoc-website">Site web</Label>
              <Input
                id="assoc-website"
                {...register("association_website")}
                className="bg-background/50"
              />
            </div>
          </CardContent>
        </Card>

        {/* Cotisations */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">Cotisations (€)</CardTitle>
            <CardDescription>Tarifs par défaut</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fee-membership">Adhésion</Label>
                <Input
                  id="fee-membership"
                  type="number"
                  step="0.01"
                  {...register("membership_fee_default", { valueAsNumber: true })}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee-match">Joueur Match</Label>
                <Input
                  id="fee-match"
                  type="number"
                  step="0.01"
                  {...register("player_fee_match", { valueAsNumber: true })}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee-cabaret">Joueur Cabaret</Label>
                <Input
                  id="fee-cabaret"
                  type="number"
                  step="0.01"
                  {...register("player_fee_cabaret", { valueAsNumber: true })}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee-loisir">Loisir</Label>
                <Input
                  id="fee-loisir"
                  type="number"
                  step="0.01"
                  {...register("player_fee_loisir", { valueAsNumber: true })}
                  className="bg-background/50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sécurité */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">Sécurité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="activation-days">Validité activation (jours)</Label>
                <Input
                  id="activation-days"
                  type="number"
                  {...register("activation_token_validity_days", { valueAsNumber: true })}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-hours">Validité reset mdp (heures)</Label>
                <Input
                  id="reset-hours"
                  type="number"
                  {...register("reset_token_validity_hours", { valueAsNumber: true })}
                  className="bg-background/50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saveMutation.isPending || !isDirty}
            className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background font-semibold"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Sauvegarder
          </Button>
        </div>
      </form>

      {/* Maintenance */}
      <Card className="border-destructive/30 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Maintenance
          </CardTitle>
          <CardDescription>
            Supprimer définitivement les événements antérieurs au 1ᵉʳ mars 2026
            (avant le premier alignement fiable). Les grilles, affectations,
            inscriptions et photos liées à ces événements sont aussi supprimées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={purgeMutation.isPending}>
                {purgeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Purger les anciens événements
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Purger les anciens événements ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tous les événements démarrant avant le 1ᵉʳ mars 2026 seront
                  supprimés définitivement, avec leurs grilles, affectations,
                  inscriptions et photos. Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => purgeMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
