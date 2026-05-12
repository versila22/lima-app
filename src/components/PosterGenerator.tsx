import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, Loader2 } from "lucide-react";

import { api } from "@/lib/api";
import type { EventPhoto, EventRead } from "@/types";
import { EVENT_TYPE_CONFIG } from "@/pages/Agenda";
import limaLogo from "@/assets/logo-lima.jpg";
import bgCabaret from "@/assets/posters/bg-cabaret.jpg";
import bgMatch from "@/assets/posters/bg-match.jpg";
import bgFormation from "@/assets/posters/bg-formation.jpg";
import bgWelsh from "@/assets/posters/bg-welsh.jpg";

const FALLBACK_BG: Record<string, string> = {
  cabaret: bgCabaret,
  match: bgMatch,
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

  const mj = cast.filter((c) => c.role === "MJ_MC");
  const dj = cast.filter((c) => c.role === "DJ");
  const players = cast.filter((c) => c.role === "JR");
  const hasCast = cast.length > 0;

  const titleSize = isStory
    ? Math.min(72, Math.max(48, Math.floor(width / (event.title.length * 0.55))))
    : Math.min(60, Math.max(36, Math.floor(width / (event.title.length * 0.52))));

  const dateStr = format(parseISO(event.start_at), "EEEE d MMMM yyyy — HH:mm", { locale: fr });
  const dateStrCap = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // accent color based on event type
  const accentColor =
    event.event_type === "cabaret" ? "#e95220" :
    event.event_type === "formation" ? "#a855f7" :
    event.event_type === "match" ? "#e01f1f" : "#e95220";

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: bgDataUrl ? "transparent" : "#0d0d14",
      }}
    >
      {/* Background photo (blurred) */}
      {bgDataUrl && (
        <div
          style={{
            position: "absolute",
            inset: -40,
            backgroundImage: `url(${bgDataUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(24px) brightness(0.35)",
            transform: "scale(1.1)",
          }}
        />
      )}

      {/* Fallback gradient background */}
      {!bgDataUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, #12001a 0%, #1a0005 50%, #1a0800 100%)",
          }}
        />
      )}

      {/* Bottom gradient overlay for contrast */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.8) 100%)",
        }}
      />

      {/* Accent color strip at top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: `linear-gradient(to right, #e01f1f, ${accentColor})`,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: isStory ? 56 : 44,
        }}
      >
        {/* Header: Logo + association */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src={limaLogo}
            alt="LIMA"
            style={{
              width: isStory ? 72 : 56,
              height: isStory ? 72 : 56,
              borderRadius: 10,
              objectFit: "contain",
              background: "white",
            }}
          />
          <div>
            <div
              style={{
                color: "white",
                fontSize: isStory ? 22 : 17,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              LIMA IMPRO
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: isStory ? 14 : 11,
                letterSpacing: "0.08em",
              }}
            >
              Ligue d'Improvisation du Maine-et-Loire
            </div>
          </div>
        </div>

        {/* Main section */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingTop: isStory ? 60 : 32,
            paddingBottom: isStory ? 40 : 24,
          }}
        >
          {/* Event type badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: `${accentColor}22`,
              border: `1.5px solid ${accentColor}66`,
              borderRadius: 6,
              padding: isStory ? "8px 20px" : "6px 14px",
              color: accentColor,
              fontSize: isStory ? 16 : 13,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: isStory ? 28 : 20,
              width: "fit-content",
            }}
          >
            {cfg.label}
          </div>

          {/* Title */}
          <div
            style={{
              color: "white",
              fontSize: titleSize,
              fontWeight: 900,
              lineHeight: 1.05,
              marginBottom: isStory ? 32 : 22,
              letterSpacing: "-0.02em",
            }}
          >
            {event.title}
          </div>

          {/* Date */}
          <div
            style={{
              color: accentColor,
              fontSize: isStory ? 24 : 18,
              fontWeight: 700,
              marginBottom: 10,
              letterSpacing: "0.01em",
            }}
          >
            {dateStrCap}
          </div>

          {/* Venue */}
          {event.away_city && (
            <div
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: isStory ? 18 : 14,
                fontWeight: 500,
              }}
            >
              {event.away_city}
              {event.away_opponent ? ` — contre ${event.away_opponent}` : ""}
            </div>
          )}
        </div>

        {/* Bottom: casting + QR */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          {/* Casting */}
          {hasCast ? (
            <div style={{ flex: 1, marginRight: 20 }}>
              {mj.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      fontSize: isStory ? 13 : 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      marginRight: 8,
                    }}
                  >
                    Meneur·se
                  </span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.9)",
                      fontSize: isStory ? 16 : 13,
                      fontWeight: 600,
                    }}
                  >
                    {mj.map((m) => `${m.first_name} ${m.last_name}`).join(", ")}
                  </span>
                </div>
              )}
              {dj.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      fontSize: isStory ? 13 : 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      marginRight: 8,
                    }}
                  >
                    DJ
                  </span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.9)",
                      fontSize: isStory ? 16 : 13,
                      fontWeight: 600,
                    }}
                  >
                    {dj.map((m) => `${m.first_name} ${m.last_name}`).join(", ")}
                  </span>
                </div>
              )}
              {players.length > 0 && (
                <div>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      fontSize: isStory ? 13 : 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      marginRight: 8,
                    }}
                  >
                    Joueurs
                  </span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.85)",
                      fontSize: isStory ? 15 : 12,
                    }}
                  >
                    {players
                      .map((m) => `${m.first_name} ${m.last_name.charAt(0)}.`)
                      .join(" · ")}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          {/* QR code */}
          {qrDataUrl && (
            <div
              style={{
                background: "white",
                borderRadius: 10,
                padding: 6,
                flexShrink: 0,
              }}
            >
              <img
                src={qrDataUrl}
                alt="QR code"
                style={{
                  width: isStory ? 110 : 84,
                  height: isStory ? 110 : 84,
                  display: "block",
                }}
              />
            </div>
          )}
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

  // Pre-fetch background image as dataURL to avoid CORS issues with html-to-image
  // Priority: event gallery photo → event-type fallback → null (gradient)
  useEffect(() => {
    if (!open) return;
    const url = photos.length > 0
      ? photos[0].url
      : FALLBACK_BG[event.event_type] ?? bgFormation;
    fetchAsDataUrl(url).then(setBgDataUrl);
  }, [open, photos, event.event_type]);

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
            Fond générique LIMA — ajoute des photos à cet événement pour un fond personnalisé.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
