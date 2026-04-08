import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Save,
  Shield,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { api, type ApiError, fetchMyProfile } from "@/lib/api";
import type { MemberProfileRead, MemberUpdate, PlayerStatus } from "@/types";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_CONFIG: Record<PlayerStatus, { label: string; emoji: string; className: string }> = {
  M: {
    label: "Match",
    emoji: "🎭",
    className: "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-200",
  },
  C: {
    label: "Cabaret",
    emoji: "🎪",
    className: "border-amber-500/30 bg-amber-500/15 text-amber-200",
  },
  L: {
    label: "Loisir",
    emoji: "🎈",
    className: "border-sky-500/30 bg-sky-500/15 text-sky-200",
  },
  A: {
    label: "Adhérent",
    emoji: "👋",
    className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  },
};

const ASSO_ROLE_LABELS: Record<string, string> = {
  co_president: "Co-président",
  co_treasurer: "Co-trésorier",
  secretary: "Secrétaire",
  ca_member: "Membre CA",
  coach: "Coach",
};

const COMMISSION_CONFIG: Record<string, string> = {
  comspec: "border-violet-500/30 bg-violet-500/15 text-violet-200",
  comprog: "border-cyan-500/30 bg-cyan-500/15 text-cyan-200",
  comform: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  comadh: "border-amber-500/30 bg-amber-500/15 text-amber-200",
  comcom: "border-rose-500/30 bg-rose-500/15 text-rose-200",
  ca: "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-200",
};

function getInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "MP";
}

function getFullName(profile: Pick<MemberProfileRead, "first_name" | "last_name">) {
  return `${profile.first_name} ${profile.last_name}`.trim() || "Profil membre";
}

function PlayerStatusBadge({ status }: { status: PlayerStatus | null | undefined }) {
  if (!status) {
    return null;
  }

  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.emoji} {config.label}
    </Badge>
  );
}

function AssoRoleBadge({ role }: { role?: string | null }) {
  if (!role) return null;

  return (
    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
      <Shield className="mr-1 h-3.5 w-3.5" />
      {ASSO_ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

function CommissionBadge({ commission }: { commission: string }) {
  return (
    <Badge
      variant="outline"
      className={COMMISSION_CONFIG[commission] ?? "border-border/70 bg-muted/40 text-foreground"}
    >
      {commission}
    </Badge>
  );
}

export default function MonProfil() {
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });

  const { data: profile, isLoading, error } = useQuery<MemberProfileRead>({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      phone: profile.phone ?? "",
    });
  }, [profile]);

  const updateMutation = useMutation<MemberProfileRead, ApiError, MemberUpdate>({
    mutationFn: (payload) => api.put<MemberProfileRead>("/auth/me", payload),
    onSuccess: async (updatedProfile) => {
      queryClient.setQueryData(["my-profile"], updatedProfile);
      await refreshUser();
      toast.success("Profil mis à jour");
      setIsEditing(false);
    },
    onError: (err) => {
      toast.error(err.detail ?? "Erreur lors de la mise à jour du profil");
    },
  });

  const displayedHistory = useMemo(() => (profile?.season_history ?? []).slice(0, 5), [profile?.season_history]);
  const hiddenHistoryCount = Math.max(((profile?.season_history ?? []).length) - displayedHistory.length, 0);

  const hasCurrentSeasonInfo =
    !!profile?.player_status || !!profile?.asso_role || ((profile?.commissions ?? []).length) > 0;

  const handleChange = (field: "first_name" | "last_name" | "phone", value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCancel = () => {
    if (profile) {
      setForm({
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        phone: profile.phone ?? "",
      });
    }
    setIsEditing(false);
  };

  const handleSubmit = () => {
    updateMutation.mutate({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold">
            <User className="h-5 w-5 text-background" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mon Profil</h1>
            <p className="text-sm text-muted-foreground">Impossible de charger votre profil pour le moment.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold">
          <User className="h-5 w-5 text-background" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mon Profil</h1>
          <p className="text-sm text-muted-foreground">Votre fiche membre et votre parcours associatif.</p>
        </div>
      </div>

      <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-24 w-24 border border-primary/20 shadow-lg">
                <AvatarImage
                  src={profile.photo_url ? `https://api-production-e15b.up.railway.app${profile.photo_url}` : undefined}
                  alt={getFullName(profile)}
                />
                <AvatarFallback className="bg-gradient-to-br from-cabaret-purple/80 to-cabaret-gold/80 text-2xl font-bold text-background">
                  {getInitials(profile.first_name, profile.last_name)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-3">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">{getFullName(profile)}</h2>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {profile.app_role === "admin" && (
                    <Badge variant="outline" className="border-cabaret-gold/30 bg-cabaret-gold/10 text-cabaret-gold">
                      Admin
                    </Badge>
                  )}
                  {profile.is_active ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      Compte actif
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-300">
                      Compte inactif
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {!isEditing && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4" />
                Modifier
              </Button>
            )}
          </div>

          {isEditing && (
            <div className="mt-6 rounded-xl border border-border/70 bg-background/40 p-4">
              <div className="mb-4">
                <h3 className="font-semibold">Modifier mes informations</h3>
                <p className="text-sm text-muted-foreground">
                  Vous pouvez mettre à jour votre prénom, votre nom et votre téléphone.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom</Label>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    onChange={(event) => handleChange("first_name", event.target.value)}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom</Label>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    onChange={(event) => handleChange("last_name", event.target.value)}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(event) => handleChange("phone", event.target.value)}
                    placeholder="06 12 34 56 78"
                    disabled={updateMutation.isPending}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={updateMutation.isPending || !form.first_name.trim() || !form.last_name.trim()}
                  className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Enregistrer
                    </>
                  )}
                </Button>
                <Button variant="ghost" onClick={handleCancel} disabled={updateMutation.isPending}>
                  <X className="h-4 w-4" />
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Saison en cours</CardTitle>
          <CardDescription>Votre statut joueur, rôle associatif et commissions actuelles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {hasCurrentSeasonInfo ? (
            <>
              <div className="flex flex-wrap gap-2">
                <PlayerStatusBadge status={profile.player_status} />
                <AssoRoleBadge role={profile.asso_role} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Commissions</p>
                {(profile.commissions ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(profile.commissions ?? []).map((commission) => (
                      <CommissionBadge key={commission} commission={commission} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune commission cette saison.</p>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 bg-background/30 p-6 text-sm text-muted-foreground">
              Aucune affectation cette saison.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Historique des saisons</CardTitle>
          <CardDescription>Vos 5 dernières saisons, avec affichage détaillé à la demande.</CardDescription>
        </CardHeader>
        <CardContent>
          {displayedHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-background/30 p-6 text-sm text-muted-foreground">
              Aucun historique de saison disponible.
            </div>
          ) : (
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Saison</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Rôle associatif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedHistory.slice(0, historyOpen ? displayedHistory.length : Math.min(3, displayedHistory.length)).map((entry) => (
                      <TableRow key={entry.season_id} className="border-border hover:bg-sidebar-accent/30">
                        <TableCell className="font-medium">{entry.season_name}</TableCell>
                        <TableCell>
                          <PlayerStatusBadge status={entry.player_status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ASSO_ROLE_LABELS[entry.asso_role ?? ""] ?? entry.asso_role ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {displayedHistory.length > 3 && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="mt-3">
                    {historyOpen ? (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Réduire l’historique
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-4 w-4" />
                        Voir {displayedHistory.length - 3} saison(s) de plus
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}

              {hiddenHistoryCount > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {hiddenHistoryCount} saison(s) plus ancienne(s) non affichée(s).
                </div>
              )}

              <CollapsibleContent />
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
