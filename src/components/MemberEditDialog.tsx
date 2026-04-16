import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { updateMember, updateMemberRole, ApiError } from "@/lib/api";
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
        // MemberProfileRead doesn't have address/postal_code/city fields, so we use empty defaults
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
              onValueChange={(v) => setValue("app_role", v as "admin" | "member", { shouldDirty: true })}
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
