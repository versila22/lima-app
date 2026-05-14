import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, MessageSquareWarning, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB raw

interface FeedbackDialogProps {
  /** Element used as the dialog trigger (Button, icon button, etc.). */
  trigger: React.ReactNode;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function FeedbackDialog({ trigger }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (open && user) {
      setName(`${user.first_name} ${user.last_name}`.trim());
    }
  }, [open, user]);

  const resetImage = () => {
    setImageDataUrl(null);
    setImageFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Le fichier doit être une image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image trop lourde (max 5 Mo).");
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      setImageDataUrl(dataUrl);
      setImageFileName(file.name);
    } catch {
      toast.error("Impossible de lire l'image.");
    }
  };

  const submit = useMutation<unknown, ApiError>({
    mutationFn: () =>
      api.post("/feedback", {
        body: body.trim(),
        reporter_name: name.trim() || undefined,
        image_data_url: imageDataUrl ?? undefined,
      }),
    onSuccess: () => {
      toast.success("Merci, ton retour a bien été envoyé !");
      setBody("");
      resetImage();
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err.detail ?? "Impossible d'envoyer le retour. Réessaie plus tard.");
    },
  });

  const canSubmit = body.trim().length > 0 && !submit.isPending;

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    void handleFile(file);
  };

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

          {/* Image upload (drag-drop on desktop, gallery on mobile) */}
          <div className="space-y-2">
            <Label>Photo (facultative)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            {imageDataUrl ? (
              <div className="relative rounded-md border border-border bg-background/50 p-2">
                <img
                  src={imageDataUrl}
                  alt={imageFileName ?? "Aperçu"}
                  className="max-h-40 mx-auto rounded"
                />
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="text-xs text-muted-foreground truncate">
                    {imageFileName}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetImage}
                    className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Retirer
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                  "w-full flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border bg-background/30 px-4 py-6 text-sm text-muted-foreground transition-colors",
                  "hover:bg-background/50 hover:text-foreground hover:border-primary/50",
                  isDragging && "border-primary bg-primary/5 text-foreground"
                )}
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-center">
                  <span className="hidden sm:inline">Glisse une image ici ou </span>
                  <span className="underline">choisis depuis ta galerie</span>
                </span>
                <span className="text-[10px] text-muted-foreground/70">PNG, JPG — max 5 Mo</span>
              </button>
            )}
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
