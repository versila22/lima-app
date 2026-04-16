import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, Phone, ShieldCheck, UserX, UserCheck, Send } from "lucide-react";

import {
  getMemberProfile,
  deactivateMember,
  reactivateMember,
  resendInvite,
  API_BASE_URL,
} from "@/lib/api";
import type { MemberSummary, MemberProfileRead } from "@/types";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { MemberEditDialog } from "./MemberEditDialog";

function getPhotoUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url}`;
}

interface MemberDetailDrawerProps {
  member: MemberSummary | null;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemberDetailDrawer({
  member,
  isAdmin,
  open,
  onOpenChange,
}: MemberDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: profile, isLoading } = useQuery<MemberProfileRead>({
    queryKey: ["member-profile", member?.id],
    queryFn: () => getMemberProfile(member!.id),
    enabled: open && !!member,
    staleTime: 30_000,
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateMember(member!.id),
    onSuccess: () => {
      toast.success(`${member?.first_name} ${member?.last_name} désactivé(e)`);
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-profile", member?.id] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erreur lors de la désactivation"),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateMember(member!.id),
    onSuccess: () => {
      toast.success(`${member?.first_name} ${member?.last_name} réactivé(e)`);
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-profile", member?.id] });
    },
    onError: () => toast.error("Erreur lors de la réactivation"),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendInvite(member!.id),
    onSuccess: () => toast.success("Email d'invitation renvoyé"),
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  if (!member) return null;

  const isPending =
    deactivateMutation.isPending ||
    reactivateMutation.isPending ||
    resendMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-card border-border">
          <SheetHeader className="pb-4">
            <SheetTitle>Détail du membre</SheetTitle>
            <SheetDescription>
              Informations et actions pour {member.first_name} {member.last_name}
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : profile ? (
            <div className="space-y-6">
              {/* Avatar + Nom */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={getPhotoUrl(profile.photo_url)}
                    alt={`${profile.first_name} ${profile.last_name}`}
                  />
                  <AvatarFallback className="text-lg bg-primary/20 text-primary">
                    {profile.first_name[0]}{profile.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">
                    {profile.first_name} {profile.last_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={profile.is_active ? "border-green-500/50 text-green-400" : "border-red-500/50 text-red-400"}
                    >
                      {profile.is_active ? "Actif" : "Inactif"}
                    </Badge>
                    {profile.app_role === "admin" && (
                      <Badge variant="outline" className="border-primary/50 text-primary">
                        Admin
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Coordonnées */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>{profile.email}</span>
                </div>
                {profile.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{profile.phone}</span>
                  </div>
                )}
              </div>

              {/* Saison courante */}
              {(profile.player_status || profile.asso_role || (profile.commissions && profile.commissions.length > 0)) && (
                <>
                  <Separator className="bg-border/50" />
                  <div className="space-y-2 text-sm">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Saison courante</p>
                    {profile.player_status && (
                      <p>Statut joueur : <span className="font-medium">{profile.player_status}</span></p>
                    )}
                    {profile.asso_role && (
                      <p>Rôle asso : <span className="font-medium">{profile.asso_role}</span></p>
                    )}
                    {profile.commissions && profile.commissions.length > 0 && (
                      <p>Commissions : <span className="font-medium">{profile.commissions.join(", ")}</span></p>
                    )}
                  </div>
                </>
              )}

              {/* Actions admin */}
              {isAdmin && (
                <>
                  <Separator className="bg-border/50" />
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Actions admin</p>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditOpen(true)}
                        disabled={isPending}
                        className="justify-start"
                      >
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Modifier le profil
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendMutation.mutate()}
                        disabled={isPending}
                        className="justify-start"
                      >
                        {resendMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Renvoyer l'invitation
                      </Button>
                      {profile.is_active ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deactivateMutation.mutate()}
                          disabled={isPending}
                          className="justify-start border-destructive/50 text-destructive hover:bg-destructive/10"
                        >
                          {deactivateMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <UserX className="w-4 h-4 mr-2" />
                          )}
                          Désactiver le compte
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reactivateMutation.mutate()}
                          disabled={isPending}
                          className="justify-start border-green-500/50 text-green-400 hover:bg-green-500/10"
                        >
                          {reactivateMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <UserCheck className="w-4 h-4 mr-2" />
                          )}
                          Réactiver le compte
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {profile && (
        <MemberEditDialog
          member={profile}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["members"] });
            queryClient.invalidateQueries({ queryKey: ["member-profile", member?.id] });
          }}
        />
      )}
    </>
  );
}
