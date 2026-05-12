import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Images, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { api, listGalleryPhotos, uploadEventPhoto } from "@/lib/api";
import type { EventRead, GalleryPhoto } from "@/types";
import { EVENT_TYPE_CONFIG } from "./Agenda";
import { useAuth } from "@/contexts/AuthContext";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";

// ---- Upload dialog (admin only) ----
function UploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [eventId, setEventId] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [queued, setQueued] = useState<File[]>([]);

  const { data: events = [] } = useQuery<EventRead[]>({
    queryKey: ["events-for-gallery-upload"],
    queryFn: () => api.get<EventRead[]>("/events"),
    enabled: open,
    select: (data) =>
      [...data].sort(
        (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
      ),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setQueued((prev) => [...prev, ...Array.from(files)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const removeQueued = (idx: number) =>
    setQueued((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (!eventId || queued.length === 0) return;
    setPending(true);
    let ok = 0;
    let fail = 0;
    for (const file of queued) {
      try {
        await uploadEventPhoto(eventId, file);
        ok++;
      } catch {
        fail++;
      }
    }
    setPending(false);
    queryClient.invalidateQueries({ queryKey: ["gallery-photos"] });
    queryClient.invalidateQueries({ queryKey: ["event-photos", eventId] });
    setQueued([]);
    setEventId("");
    if (fail === 0) toast.success(`${ok} photo${ok > 1 ? "s" : ""} importée${ok > 1 ? "s" : ""}`);
    else toast.warning(`${ok} importée${ok > 1 ? "s" : ""}, ${fail} échouée${fail > 1 ? "s" : ""}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>Importer des photos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Event picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Événement</label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Choisir un événement…" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-72">
                {events.map((ev) => {
                  const cfg = EVENT_TYPE_CONFIG[ev.event_type] ?? EVENT_TYPE_CONFIG.other;
                  return (
                    <SelectItem key={ev.id} value={ev.id}>
                      <span className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="truncate">{ev.title}</span>
                        <span className="text-xs text-muted-foreground ml-1 shrink-0">
                          {format(parseISO(ev.start_at), "d MMM yyyy", { locale: fr })}
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Glisser-déposer ou <span className="text-primary font-medium">parcourir</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Queued files */}
          {queued.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {queued.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-muted/40 rounded-md px-3 py-1.5">
                  <ImagePlus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={() => removeQueued(i)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={!eventId || queued.length === 0 || pending}
            className="gap-2"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {pending ? "Envoi…" : `Importer${queued.length > 0 ? ` (${queued.length})` : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Galerie page ----
export default function Galerie() {
  const { user } = useAuth();
  const isAdmin = user?.app_role === "admin";
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: photos = [], isLoading } = useQuery<GalleryPhoto[]>({
    queryKey: ["gallery-photos"],
    queryFn: listGalleryPhotos,
  });

  // Group by event, preserving backend anti-chrono order
  const groups = photos.reduce<
    { eventId: string; eventTitle: string; eventType: string; eventDate: string; photos: GalleryPhoto[] }[]
  >((acc, photo) => {
    const existing = acc.find((g) => g.eventId === photo.event_id);
    if (existing) {
      existing.photos.push(photo);
    } else {
      acc.push({
        eventId: photo.event_id,
        eventTitle: photo.event_title,
        eventType: photo.event_type,
        eventDate: photo.event_date,
        photos: [photo],
      });
    }
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold flex items-center justify-center shrink-0">
            <Images className="w-5 h-5 text-background" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Galerie</h1>
            {photos.length > 0 && (
              <p className="text-xs text-muted-foreground">{photos.length} photo{photos.length > 1 ? "s" : ""}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => setUploadOpen(true)}
          >
            <ImagePlus className="w-4 h-4" />
            Importer
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement…
        </div>
      )}

      {!isLoading && photos.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Images className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune photo pour le moment.</p>
          {isAdmin ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={() => setUploadOpen(true)}
            >
              <ImagePlus className="w-4 h-4" />
              Importer les premières photos
            </Button>
          ) : (
            <p className="text-xs mt-1">Les photos ajoutées aux événements apparaîtront ici.</p>
          )}
        </div>
      )}

      {/* Photo groups */}
      {groups.map((group) => {
        const cfg = EVENT_TYPE_CONFIG[group.eventType as keyof typeof EVENT_TYPE_CONFIG] ?? EVENT_TYPE_CONFIG.other;
        return (
          <section key={group.eventId}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-sm">{group.eventTitle}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {format(parseISO(group.eventDate), "d MMMM yyyy", { locale: fr })}
                </span>
              </div>
              <Badge variant="outline" className={`ml-auto text-xs shrink-0 ${cfg.color}`}>
                {cfg.label}
              </Badge>
              <span className="text-xs text-muted-foreground shrink-0">
                {group.photos.length} photo{group.photos.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {group.photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setLightbox(photo)}
                  className="aspect-square rounded-md overflow-hidden border border-border hover:opacity-85 transition-opacity"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? group.eventTitle}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {/* Lightbox */}
      {lightbox && (
        <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-[95vw] p-2 bg-card border-border">
            <img
              src={lightbox.url}
              alt={lightbox.caption ?? lightbox.event_title}
              className="w-full max-h-[85vh] object-contain rounded-md"
            />
            <div className="px-2 pb-1">
              <p className="text-sm font-medium">{lightbox.event_title}</p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(lightbox.event_date), "d MMMM yyyy", { locale: fr })}
              </p>
              {lightbox.caption && (
                <p className="text-xs text-muted-foreground mt-1 italic">{lightbox.caption}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Upload dialog */}
      {isAdmin && (
        <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      )}
    </div>
  );
}
