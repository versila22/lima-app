# Sprint 3 — Members CRUD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux admins de consulter, éditer, désactiver/réactiver et réinviter des membres depuis l'UI. Améliorer le feedback de l'import CSV.

**Architecture:** Le backend a déjà `PUT /members/{id}`, `DELETE /members/{id}` (désactivation), `POST /members/{id}/resend-activation`, `GET /members/{id}/profile`. On ajoute `PATCH /members/{id}/reactivate` côté backend. Côté frontend, on ajoute un drawer de détail + un dialog d'édition, et on rend les lignes du tableau cliquables.

**Tech Stack:** React 18 + TypeScript, react-hook-form + zod, shadcn/ui Sheet + Dialog, @tanstack/react-query, FastAPI.

---

## File Map

| Fichier | Action |
|---------|--------|
| `backend/app/routers/members.py` | Ajouter `PATCH /{member_id}/reactivate` |
| `src/lib/api.ts` | Ajouter helpers membres CRUD |
| `src/components/MemberDetailDrawer.tsx` | Nouveau — drawer détail + actions admin |
| `src/components/MemberEditDialog.tsx` | Nouveau — dialog édition membre |
| `src/pages/Members.tsx` | Lignes cliquables, drawer intégré, erreurs CSV affichées |

---

## Task 1 : Ajouter `PATCH /members/{member_id}/reactivate` dans `backend/app/routers/members.py`

**Files:**
- Modify: `backend/app/routers/members.py`

- [ ] **Step 1 : Ajouter l'endpoint après `deactivate_member`**

Lire les lignes 220-250 du fichier pour trouver le bon emplacement (après `deactivate_member`).

Ajouter :
```python
@router.patch("/{member_id}/reactivate", response_model=MemberRead)
async def reactivate_member(
    member_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Reactivate a previously deactivated member (admin only)."""
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    member.is_active = True
    await db.flush()
    await db.commit()
    return await _get_member_for_response(db, member.id)
```

- [ ] **Step 2 : Vérifier syntaxe**

```bash
cd C:/WorkspaceVSCode/lima-app/backend
python -c "import ast; ast.parse(open('app/routers/members.py').read()); print('OK')"
```

- [ ] **Step 3 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add backend/app/routers/members.py
git commit -m "feat(members): add PATCH /members/{id}/reactivate endpoint"
```

---

## Task 2 : Ajouter les helpers API membres dans `src/lib/api.ts`

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1 : Lire la fin du fichier** pour trouver où ajouter les helpers

```bash
tail -50 C:/WorkspaceVSCode/lima-app/src/lib/api.ts
```

- [ ] **Step 2 : Ajouter les fonctions à la fin du fichier**

```ts
// ---- Members CRUD helpers ----
import type { MemberProfileRead, MemberRead, MemberUpdate } from "@/types";

export function getMemberProfile(id: string): Promise<MemberProfileRead> {
  return api.get<MemberProfileRead>(`/members/${id}/profile`);
}

export function updateMember(id: string, data: MemberUpdate): Promise<MemberRead> {
  return api.put<MemberRead>(`/members/${id}`, data);
}

export function updateMemberRole(id: string, app_role: "admin" | "member"): Promise<MemberRead> {
  return api.put<MemberRead>(`/members/${id}/role`, { app_role });
}

export function deactivateMember(id: string): Promise<void> {
  return api.delete<void>(`/members/${id}`);
}

export function reactivateMember(id: string): Promise<MemberRead> {
  return api.patch<MemberRead>(`/members/${id}/reactivate`);
}

export function resendInvite(id: string): Promise<{ detail: string }> {
  return api.post<{ detail: string }>(`/members/${id}/resend-activation`);
}
```

Note : vérifier que `api.patch` et `api.delete` existent dans le fichier. S'ils n'existent pas, les ajouter dans la section `api = { ... }` :
```ts
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T>(path: string) => request<T>("DELETE", path),
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4 : Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(members): add CRUD API helpers (profile, update, deactivate, reactivate, resend)"
```

---

## Task 3 : Créer `src/components/MemberDetailDrawer.tsx`

**Files:**
- Create: `src/components/MemberDetailDrawer.tsx`

Ce composant est un Sheet (drawer latéral) qui s'ouvre quand on clique sur un membre dans le tableau. Il affiche les infos complètes et les actions admin.

- [ ] **Step 1 : Créer le fichier**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, Phone, MapPin, ShieldCheck, UserX, UserCheck, Send } from "lucide-react";

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
              {(profile.player_status || profile.asso_role || profile.commissions?.length > 0) && (
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
                    {profile.commissions?.length > 0 && (
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
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/MemberDetailDrawer.tsx
git commit -m "feat(members): add MemberDetailDrawer with admin actions"
```

---

## Task 4 : Créer `src/components/MemberEditDialog.tsx`

**Files:**
- Create: `src/components/MemberEditDialog.tsx`

- [ ] **Step 1 : Créer le fichier**

```tsx
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { updateMember, updateMemberRole } from "@/lib/api";
import type { MemberProfileRead } from "@/types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";

const editSchema = z.object({
  first_name: z.string().min(1, "Requis"),
  last_name: z.string().min(1, "Requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  app_role: z.enum(["admin", "member"]),
});

type EditFormData = z.infer<typeof editSchema>;

interface MemberEditDialogProps {
  member: MemberProfileRead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MemberEditDialog({
  member,
  open,
  onOpenChange,
  onSuccess,
}: MemberEditDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    if (open) {
      reset({
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        phone: member.phone ?? "",
        address: "",
        postal_code: "",
        city: "",
        app_role: member.app_role,
      });
    }
  }, [open, member, reset]);

  const mutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      const { app_role, ...rest } = data;
      const promises: Promise<unknown>[] = [
        updateMember(member.id, {
          first_name: rest.first_name,
          last_name: rest.last_name,
          email: rest.email,
          phone: rest.phone || undefined,
          address: rest.address || undefined,
          postal_code: rest.postal_code || undefined,
          city: rest.city || undefined,
        }),
      ];
      if (app_role !== member.app_role) {
        promises.push(updateMemberRole(member.id, app_role));
      }
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      onSuccess();
      onOpenChange(false);
    },
    onError: (err) => {
      const detail = err instanceof ApiError ? err.detail : "Erreur lors de la mise à jour";
      toast.error(detail);
    },
  });

  const currentRole = watch("app_role");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le profil</DialogTitle>
          <DialogDescription>
            Modifier les informations de {member.first_name} {member.last_name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-first-name">Prénom</Label>
              <Input
                id="edit-first-name"
                {...register("first_name")}
                className="bg-background/50"
              />
              {errors.first_name && (
                <p className="text-xs text-destructive">{errors.first_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last-name">Nom</Label>
              <Input
                id="edit-last-name"
                {...register("last_name")}
                className="bg-background/50"
              />
              {errors.last_name && (
                <p className="text-xs text-destructive">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              {...register("email")}
              className="bg-background/50"
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Téléphone</Label>
            <Input
              id="edit-phone"
              type="tel"
              {...register("phone")}
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-address">Adresse</Label>
            <Input
              id="edit-address"
              {...register("address")}
              className="bg-background/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-postal">Code postal</Label>
              <Input
                id="edit-postal"
                {...register("postal_code")}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-city">Ville</Label>
              <Input
                id="edit-city"
                {...register("city")}
                className="bg-background/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">Rôle applicatif</Label>
            <Select
              value={currentRole}
              onValueChange={(v) => setValue("app_role", v as "admin" | "member")}
            >
              <SelectTrigger id="edit-role" className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membre</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !isDirty}
              className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sauvegarde…
                </>
              ) : (
                "Sauvegarder"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2 : Vérifier que `zod` et `@hookform/resolvers` sont dans les dépendances**

```bash
cd C:/WorkspaceVSCode/lima-app
grep -E "\"zod\"|\"@hookform" package.json
```

Si absents, les installer :
```bash
npm install zod @hookform/resolvers
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4 : Commit**

```bash
git add src/components/MemberEditDialog.tsx
git commit -m "feat(members): add MemberEditDialog with react-hook-form + zod"
```

---

## Task 5 : Mettre à jour `src/pages/Members.tsx`

**Files:**
- Modify: `src/pages/Members.tsx`

### Changements

1. Rendre les lignes du tableau cliquables → ouvrir le drawer
2. Intégrer `MemberDetailDrawer`
3. Afficher les erreurs CSV dans le dialog après import

- [ ] **Step 1 : Lire le fichier actuel**

```bash
cat C:/WorkspaceVSCode/lima-app/src/pages/Members.tsx
```

- [ ] **Step 2 : Ajouter l'import du drawer en haut du fichier**

```ts
import { MemberDetailDrawer } from "@/components/MemberDetailDrawer";
```

- [ ] **Step 3 : Ajouter l'état du drawer** dans le composant `Members`

Après `const [importOpen, setImportOpen] = useState(false);` :
```ts
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
```

- [ ] **Step 4 : Rendre les lignes cliquables**

Sur chaque `<TableRow key={m.id}...>`, ajouter :
```tsx
<TableRow
  key={m.id}
  className="border-border hover:bg-sidebar-accent/30 cursor-pointer"
  onClick={() => {
    setSelectedMember(m);
    setDrawerOpen(true);
  }}
>
```

- [ ] **Step 5 : Ajouter le drawer après le `</div>` fermant principal**

Ajouter avant le `return` final (ou juste avant la fermeture du `</div>` principal) :
```tsx
      <MemberDetailDrawer
        member={selectedMember}
        isAdmin={isAdmin}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
```

- [ ] **Step 6 : Afficher les erreurs CSV dans le dialog**

Dans le `onSuccess` de `importMutation`, après les toasts existants, stocker les erreurs pour les afficher :

Ajouter un état :
```ts
  const [importErrors, setImportErrors] = useState<string[]>([]);
```

Dans `onSuccess` :
```ts
    onSuccess: (report) => {
      toast.success(
        `Import terminé : ${report.created} créés, ${report.updated} mis à jour`
      );
      setImportErrors(report.errors);
      if (report.errors.length > 0) {
        toast.warning(`${report.errors.length} erreur(s) lors de l'import`);
      } else {
        setImportOpen(false);
      }
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
```

Dans le `DialogContent` du dialog import, ajouter après les inputs CSV (avant `DialogFooter`) :
```tsx
                {importErrors.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                    <p className="text-xs font-medium text-destructive">
                      {importErrors.length} erreur(s) :
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                      {importErrors.map((err, i) => (
                        <li key={i} className="truncate">• {err}</li>
                      ))}
                    </ul>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => { setImportErrors([]); setImportOpen(false); }}
                    >
                      Fermer
                    </Button>
                  </div>
                )}
```

- [ ] **Step 7 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8 : Commit**

```bash
git add src/pages/Members.tsx
git commit -m "feat(members): clickable rows, member detail drawer, CSV error display"
```

---

## Task 6 : Vérification finale

- [ ] **Step 1 : Vérifier le build frontend**

```bash
cd C:/WorkspaceVSCode/lima-app
npm run build 2>&1 | tail -15
```
Attendu : build sans erreur.

- [ ] **Step 2 : Vérifier les tests backend**

```bash
cd C:/WorkspaceVSCode/lima-app/backend
pytest tests/test_members.py -v --tb=short 2>&1 | tail -20
```

- [ ] **Step 3 : Vérifier le git log**

```bash
cd C:/WorkspaceVSCode/lima-app
git log --oneline -8
```
Attendu : 5 commits Sprint 3 visibles.

---

## Checklist self-review

- [x] Backend : `reactivate` complète le cycle activate/deactivate
- [x] Frontend : pas de duplication de `getPhotoUrl` (défini dans MemberDetailDrawer, Members.tsx garde le sien — acceptable car fichiers séparés)
- [x] `MemberEditDialog` : rôle mis à jour via endpoint dédié si changé
- [x] Drawer : query désactivée si `open=false` ou `member=null` (via `enabled`)
- [x] CSV errors : dialog reste ouvert si erreurs présentes pour que l'admin puisse les lire
- [x] Pas de migration DB nécessaire (`is_active` existe déjà sur `Member`)
