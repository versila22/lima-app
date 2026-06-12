import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, Loader2 } from "lucide-react";

import { api, listGalleryPhotos } from "@/lib/api";
import type { EventPhoto, EventRead, GalleryPhoto } from "@/types";
import { EVENT_TYPE_CONFIG } from "@/pages/Agenda";
import limaLogo from "@/assets/logo-lima.jpg";
import bgCabaretPoster from "@/assets/posters/bg-cabaret-poster.jpg";
import bgMatchPoster from "@/assets/posters/bg-match-poster.jpg";
import bgFormation from "@/assets/posters/bg-formation.jpg";
import bgWelsh from "@/assets/posters/bg-welsh.jpg";

const FALLBACK_BG: Record<string, string> = {
  cabaret: bgCabaretPoster,
  match: bgMatchPoster,
  formation: bgFormation,
  welsh: bgWelsh,
};

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CastMember {
  member_id: string;
  first_name: string;
  last_name: string;
  role: string;
}

// ---- helpers ----

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function parseHelloAssoUrl(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/https?:\/\/www\.helloasso\.com\/\S+/);
  return m ? m[0] : null;
}

// ---- Poster layout ----

function PosterLayout({
  event,
  cast,
  bgDataUrl,
  qrDataUrl,
  width,
  height,
}: {
  event: EventRead;
  cast: CastMember[];
  bgDataUrl: string | null;
  qrDataUrl: string | null;
  width: number;
  height: number;
}) {
  const cfg = EVENT_TYPE_CONFIG[event.event_type] ?? EVENT_TYPE_CONFIG.other;
  const isStory = height > width;

  const mj = cast.filter((c) => c.role === "MJ" || c.role === "MC");
  const dj = cast.filter((c) => c.role === "DJ");
  const players = cast.filter((c) => c.role === "JR");
  const hasCast = cast.length > 0;
  const hasPhoto = !!bgDataUrl;

  const dateStr = format(parseISO(event.start_at), "EEEE d MMMM yyyy — HH:mm", { locale: fr });
  const dateStrCap = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // Vivid gradient palette per event type
  const BG: Record<string, [string, string, string]> = {
    cabaret:   ["#ff5500", "#d41010", "#6a0000"],
    match:     ["#e82020", "#a30000", "#4a0000"],
    welsh:     ["#f59e0b", "#d97706", "#7c3500"],
    formation: ["#8b5cf6", "#6d28d9", "#2e1065"],
  };
  const [c1, c2, c3] = BG[event.event_type] ?? ["#e95220", "#c01010", "#5a0000"];
  const bgGradient = `linear-gradient(155deg, ${c1} 0%, ${c2} 48%, ${c3} 100%)`;

  // accent for date / badge text
  const accentColor =
    event.event_type === "cabaret"   ? "#ffb347" :
    event.event_type === "match"     ? "#ff8080" :
    event.event_type === "welsh"     ? "#fde68a" :
    event.event_type === "formation" ? "#c4b5fd" : "#ffb347";

  // Photo hero: takes top 44% (square) or 42% (story) when available
  const photoRatio = isStory ? 0.42 : 0.44;
  const photoZoneH = hasPhoto ? Math.floor(photoRatio * height) : 0;

  // Title: bigger, uppercase-friendly
  const titleSize = isStory
    ? Math.min(88, Math.max(52, Math.floor(width / (event.title.length * 0.48))))
    : Math.min(72, Math.max(40, Math.floor(width / (event.title.length * 0.46))));

  const pad = isStory ? 56 : 44;
  const headerH = isStory ? 100 : 80;

  return (
    <div style={{ width, height, position: "relative", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── 1. Vivid gradient base ── */}
      <div style={{ position: "absolute", inset: 0, background: bgGradient }} />

      {/* ── 2. Spotlight from top-centre ── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(255,220,130,0.22) 0%, transparent 60%)",
      }} />

      {/* ── 3. Event photo: hero zone at top ── */}
      {hasPhoto && (
        <>
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: photoZoneH,
            backgroundImage: `url(${bgDataUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
          }} />
          {/* fade photo → gradient */}
          <div style={{
            position: "absolute",
            top: photoZoneH - Math.floor(height * 0.14),
            left: 0, right: 0,
            height: Math.floor(height * 0.16),
            background: `linear-gradient(to bottom, transparent, ${c3})`,
          }} />
        </>
      )}

      {/* ── 4. Bottom darkening so text pops ── */}
      <div style={{
        position: "absolute", inset: 0,
        background: hasPhoto
          ? `linear-gradient(to bottom, transparent ${Math.floor(photoRatio * 70)}%, rgba(0,0,0,0.45) 100%)`
          : "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.35) 100%)",
      }} />

      {/* ── 5. Content ── */}
      <div style={{ position: "relative", zIndex: 1, width, height, display: "flex", flexDirection: "column" }}>

        {/* Header row: logo pill + event badge */}
        <div style={{
          flexShrink: 0,
          height: headerH,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: `0 ${pad}px`,
        }}>
          {/* Logo pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(0,0,0,0.30)",
            borderRadius: 50,
            padding: isStory ? "8px 18px 8px 8px" : "6px 14px 6px 6px",
            border: "1px solid rgba(255,255,255,0.15)",
          }}>
            <img src={limaLogo} alt="LIMA" style={{
              width: isStory ? 42 : 34, height: isStory ? 42 : 34,
              borderRadius: "50%", objectFit: "contain", background: "white",
            }} />
            <span style={{ color: "white", fontSize: isStory ? 17 : 13, fontWeight: 800, letterSpacing: "0.1em" }}>
              LIMA IMPRO
            </span>
          </div>

          {/* Event type badge */}
          <div style={{
            background: "white",
            color: c2,
            borderRadius: 6,
            padding: isStory ? "7px 18px" : "5px 14px",
            fontSize: isStory ? 15 : 12,
            fontWeight: 800,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
          }}>
            {cfg.label}
          </div>
        </div>

        {/* Spacer: pushes content below the photo zone */}
        <div style={{ flexShrink: 0, height: Math.max(0, photoZoneH - headerH) }} />

        {/* Content zone: title → date → divider → cast + QR */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: `0 ${pad}px ${pad}px`,
        }}>
          {/* Title */}
          <div style={{
            color: "white",
            fontSize: titleSize,
            fontWeight: 900,
            lineHeight: 1.0,
            letterSpacing: "-0.025em",
            textTransform: "uppercase",
            textShadow: "0 3px 24px rgba(0,0,0,0.5)",
            marginBottom: isStory ? 18 : 12,
          }}>
            {event.title}
          </div>

          {/* Date pill */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.13)",
            border: "1px solid rgba(255,255,255,0.28)",
            borderRadius: 50,
            padding: isStory ? "10px 26px" : "8px 20px",
            color: accentColor,
            fontSize: isStory ? 22 : 17,
            fontWeight: 700,
            width: "fit-content",
            marginBottom: hasCast ? (isStory ? 28 : 18) : 0,
          }}>
            {dateStrCap}
          </div>

          {/* Divider */}
          {hasCast && (
            <div style={{ height: 1, background: "rgba(255,255,255,0.18)", marginBottom: isStory ? 20 : 14 }} />
          )}

          {/* Cast + QR */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ flex: 1, marginRight: 20 }}>
              {mj.length > 0 && (
                <div style={{ marginBottom: isStory ? 8 : 5 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: isStory ? 11 : 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginRight: 8 }}>Meneur·se</span>
                  <span style={{ color: "white", fontSize: isStory ? 18 : 14, fontWeight: 700 }}>
                    {mj.map((m) => `${m.first_name} ${m.last_name}`).join(", ")}
                  </span>
                </div>
              )}
              {dj.length > 0 && (
                <div style={{ marginBottom: isStory ? 8 : 5 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: isStory ? 11 : 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginRight: 8 }}>DJ</span>
                  <span style={{ color: "white", fontSize: isStory ? 18 : 14, fontWeight: 700 }}>
                    {dj.map((m) => `${m.first_name} ${m.last_name}`).join(", ")}
                  </span>
                </div>
              )}
              {players.length > 0 && (
                <div>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: isStory ? 11 : 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginRight: 8 }}>Joueurs</span>
                  <span style={{ color: "rgba(255,255,255,0.88)", fontSize: isStory ? 16 : 12 }}>
                    {players.map((m) => `${m.first_name} ${m.last_name.charAt(0)}.`).join(" · ")}
                  </span>
                </div>
              )}
            </div>

            {qrDataUrl && (
              <div style={{ background: "white", borderRadius: 10, padding: 6, flexShrink: 0 }}>
                <img src={qrDataUrl} alt="QR" style={{ width: isStory ? 100 : 78, height: isStory ? 100 : 78, display: "block" }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main component ----

export function PosterGenerator({
  event,
  cast,
  open,
  onClose,
}: {
  event: EventRead;
  cast: CastMember[];
  open: boolean;
  onClose: () => void;
}) {
  const squareRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"square" | "story" | null>(null);

  const { data: photos = [] } = useQuery<EventPhoto[]>({
    queryKey: ["event-photos", event.id],
    queryFn: () => api.get<EventPhoto[]>(`/events/${event.id}/photos`),
    enabled: open,
  });

  // Photos from most recent past event of same type at same venue (poster background fallback)
  const { data: refPhotos = [] } = useQuery<GalleryPhoto[]>({
    queryKey: ["gallery-photos-ref", event.event_type, event.venue_id ?? "none"],
    queryFn: () => listGalleryPhotos({
      event_type: event.event_type,
      ...(event.venue_id ? { venue_id: event.venue_id } : {}),
    }),
    enabled: open,
    select: (data) => data.filter((p) => p.event_id !== event.id),
  });

  // Pre-fetch background image as dataURL to avoid CORS issues with html-to-image
  // Priority: event's own photos → most recent past same-venue/type photo → static fallback
  useEffect(() => {
    if (!open) return;
    const photoUrl = photos.length > 0
      ? photos[0].url
      : refPhotos.length > 0
        ? refPhotos[0].url
        : null;
    const url = photoUrl ?? FALLBACK_BG[event.event_type] ?? bgFormation;
    fetchAsDataUrl(url).then(setBgDataUrl);
  }, [open, photos, refPhotos, event.event_type]);

  // Generate QR code dataURL
  useEffect(() => {
    if (!open) return;
    const qrUrl = parseHelloAssoUrl(event.notes) ?? "https://www.lima.asso.fr";
    QRCode.toDataURL(qrUrl, { width: 300, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [open, event.notes]);

  const download = async (ref: React.RefObject<HTMLDivElement | null>, filename: string, format: "square" | "story") => {
    if (!ref.current) return;
    setDownloading(format);
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Poster export error:", err);
    } finally {
      setDownloading(null);
    }
  };

  const safeName = event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl bg-card border-border p-4">
        <DialogHeader>
          <DialogTitle className="text-base">Générer une affiche</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="square">
          <TabsList className="mb-3">
            <TabsTrigger value="square">Carré 1:1</TabsTrigger>
            <TabsTrigger value="story">Story 9:16</TabsTrigger>
          </TabsList>

          {/* Square tab */}
          <TabsContent value="square" className="flex flex-col items-center gap-4">
            {/* Preview: 540×540 poster scaled to 270×270 */}
            <div
              style={{ width: 270, height: 270, overflow: "hidden", position: "relative", borderRadius: 8 }}
              className="border border-border shadow-md"
            >
              <div
                ref={squareRef}
                style={{ transform: "scale(0.5)", transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}
              >
                <PosterLayout
                  event={event}
                  cast={cast}
                  bgDataUrl={bgDataUrl}
                  qrDataUrl={qrDataUrl}
                  width={540}
                  height={540}
                />
              </div>
            </div>

            <Button
              className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background gap-2"
              onClick={() => download(squareRef, `affiche-${safeName}-carre.png`, "square")}
              disabled={downloading !== null}
            >
              {downloading === "square" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Télécharger 1080×1080
            </Button>
          </TabsContent>

          {/* Story tab */}
          <TabsContent value="story" className="flex flex-col items-center gap-4">
            {/* Preview: 540×960 poster scaled to 240×427 */}
            <div
              style={{ width: 240, height: 427, overflow: "hidden", position: "relative", borderRadius: 8 }}
              className="border border-border shadow-md"
            >
              <div
                ref={storyRef}
                style={{ transform: "scale(0.444)", transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}
              >
                <PosterLayout
                  event={event}
                  cast={cast}
                  bgDataUrl={bgDataUrl}
                  qrDataUrl={qrDataUrl}
                  width={540}
                  height={960}
                />
              </div>
            </div>

            <Button
              className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background gap-2"
              onClick={() => download(storyRef, `affiche-${safeName}-story.png`, "story")}
              disabled={downloading !== null}
            >
              {downloading === "story" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Télécharger 1080×1920
            </Button>
          </TabsContent>
        </Tabs>

        {photos.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            {refPhotos.length > 0
              ? `Fond basé sur "${refPhotos[0].event_title}" — importe des photos sur cet événement pour personnaliser.`
              : "Fond générique — importe des photos sur cet événement pour un fond personnalisé."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
