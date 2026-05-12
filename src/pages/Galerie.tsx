import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Images, Loader2 } from "lucide-react";

import { listGalleryPhotos } from "@/lib/api";
import type { GalleryPhoto } from "@/types";
import { EVENT_TYPE_CONFIG } from "./Agenda";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function Galerie() {
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);

  const { data: photos = [], isLoading } = useQuery<GalleryPhoto[]>({
    queryKey: ["gallery-photos"],
    queryFn: listGalleryPhotos,
  });

  // Group photos by event_id, preserving order (events sorted by date desc in backend)
  const groups = photos.reduce<{ eventId: string; eventTitle: string; eventType: string; eventDate: string; photos: GalleryPhoto[] }[]>(
    (acc, photo) => {
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
    },
    []
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold flex items-center justify-center shrink-0">
          <Images className="w-5 h-5 text-background" />
        </div>
        <h1 className="text-2xl font-bold">Galerie</h1>
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
          <p className="text-xs mt-1">Les photos ajoutées aux événements apparaîtront ici.</p>
        </div>
      )}

      {groups.map((group) => {
        const cfg = EVENT_TYPE_CONFIG[group.eventType as keyof typeof EVENT_TYPE_CONFIG] ?? EVENT_TYPE_CONFIG.other;
        return (
          <section key={group.eventId}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="min-w-0">
                <span className="font-semibold text-sm">{group.eventTitle}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {format(parseISO(group.eventDate), "d MMMM yyyy", { locale: fr })}
                </span>
              </div>
              <Badge variant="outline" className={`ml-auto text-xs ${cfg.color}`}>
                {cfg.label}
              </Badge>
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
    </div>
  );
}
