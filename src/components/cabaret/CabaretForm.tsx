import { useState, useEffect } from "react";
import { Sparkles, MapPin, User, Palette, Users, Clock, AlertTriangle, Music } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface CabaretFormData {
  venueName: string;
  venueContact: string;
  theme: string;
  playerCount: number;
  playerNames: string[];
  duration: string;
  constraints: string;
  djCount: number;
  djNames: string[];
}

interface CabaretFormProps {
  onGenerate: (data: CabaretFormData) => void;
  isGenerating: boolean;
  initialData?: CabaretFormData | null;
}

const defaultFormData: CabaretFormData = {
  venueName: "",
  venueContact: "",
  theme: "",
  playerCount: 4,
  playerNames: ["", "", "", ""],
  duration: "1h30",
  constraints: "",
  djCount: 0,
  djNames: [],
};

export function CabaretForm({ onGenerate, isGenerating, initialData }: CabaretFormProps) {
  const [formData, setFormData] = useState<CabaretFormData>(() => {
    const playerCount = initialData?.playerCount ?? 4;
    const playerNames = initialData?.playerNames ?? Array(playerCount).fill("");
    return {
      ...defaultFormData,
      ...initialData,
      playerCount,
      playerNames,
      djCount: initialData?.djCount ?? 0,
      djNames: initialData?.djNames ?? [],
    };
  });

  useEffect(() => {
    if (initialData) {
      const playerCount = initialData.playerCount ?? 4;
      const playerNames = initialData.playerNames ?? Array(playerCount).fill("");
      setFormData({
        ...defaultFormData,
        ...initialData,
        playerCount,
        playerNames,
        djCount: initialData.djCount ?? 0,
        djNames: initialData.djNames ?? [],
      });
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(formData);
  };

  const updateField = <K extends keyof CabaretFormData>(
    field: K,
    value: CabaretFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-background" />
          </div>
          Détails de la Soirée
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Venue Name */}
          <div className="space-y-2">
            <Label htmlFor="venueName" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Nom du Lieu
            </Label>
            <Input
              id="venueName"
              placeholder="Ex: Bar le Joker"
              value={formData.venueName}
              onChange={(e) => updateField("venueName", e.target.value)}
              className="bg-background/50 border-border"
            />
          </div>

          {/* Venue Contact */}
          <div className="space-y-2">
            <Label htmlFor="venueContact" className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Contact Établissement
            </Label>
            <Input
              id="venueContact"
              placeholder="Ex: Jean Dupont - 06 12 34 56 78"
              value={formData.venueContact}
              onChange={(e) => updateField("venueContact", e.target.value)}
              className="bg-background/50 border-border"
            />
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <Label htmlFor="theme" className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-accent" />
              Thème de la Soirée
            </Label>
            <Input
              id="theme"
              placeholder="Ex: Sueur et Paillettes"
              value={formData.theme}
              onChange={(e) => updateField("theme", e.target.value)}
              className="bg-background/50 border-border"
            />
          </div>

          {/* Player Count & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="playerCount" className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Nombre de Joueurs
              </Label>
              <Select
                value={formData.playerCount.toString()}
                onValueChange={(v) => {
                  const count = parseInt(v);
                  updateField("playerCount", count);
                  // Adjust playerNames array size
                  const newNames = [...formData.playerNames];
                  while (newNames.length < count) newNames.push("");
                  while (newNames.length > count) newNames.pop();
                  updateField("playerNames", newNames);
                }}
              >
                <SelectTrigger className="bg-background/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} joueur{num > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          {/* Player Names */}
          {formData.playerCount > 0 && (
            <div className="space-y-3 pl-4 border-l-2 border-primary/30">
              {Array.from({ length: formData.playerCount }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Label htmlFor={`playerName-${i}`} className="flex items-center gap-2 text-sm">
                    <User className="w-3 h-3 text-primary" />
                    Prénom Joueur {i + 1}
                  </Label>
                  <Input
                    id={`playerName-${i}`}
                    placeholder={`Ex: Joueur ${i + 1}`}
                    value={formData.playerNames[i] || ""}
                    onChange={(e) => {
                      const newNames = [...formData.playerNames];
                      newNames[i] = e.target.value;
                      updateField("playerNames", newNames);
                    }}
                    className="bg-background/50 border-border"
                  />
                </div>
              ))}
            </div>
          )}

            <div className="space-y-2">
              <Label htmlFor="duration" className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                Durée totale
              </Label>
              <Select
                value={formData.duration}
                onValueChange={(v) => updateField("duration", v)}
              >
                <SelectTrigger className="bg-background/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="1h">1 heure</SelectItem>
                  <SelectItem value="1h15">1h15</SelectItem>
                  <SelectItem value="1h30">1h30</SelectItem>
                  <SelectItem value="2h">2 heures</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* DJ Count */}
          <div className="space-y-2">
            <Label htmlFor="djCount" className="flex items-center gap-2">
              <Music className="w-4 h-4 text-accent" />
              Nombre de DJ
            </Label>
            <Select
              value={formData.djCount.toString()}
              onValueChange={(v) => {
                const count = parseInt(v);
                updateField("djCount", count);
                // Adjust djNames array size
                const newNames = [...formData.djNames];
                while (newNames.length < count) newNames.push("");
                while (newNames.length > count) newNames.pop();
                updateField("djNames", newNames);
              }}
            >
              <SelectTrigger className="bg-background/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="0">Aucun DJ</SelectItem>
                <SelectItem value="1">1 DJ</SelectItem>
                <SelectItem value="2">2 DJ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* DJ Names */}
          {formData.djCount > 0 && (
            <div className="space-y-3 pl-4 border-l-2 border-accent/30">
              {Array.from({ length: formData.djCount }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Label htmlFor={`djName-${i}`} className="flex items-center gap-2 text-sm">
                    <Music className="w-3 h-3 text-accent" />
                    Prénom DJ {i + 1}
                  </Label>
                  <Input
                    id={`djName-${i}`}
                    placeholder={`Ex: DJ ${i + 1}`}
                    value={formData.djNames[i] || ""}
                    onChange={(e) => {
                      const newNames = [...formData.djNames];
                      newNames[i] = e.target.value;
                      updateField("djNames", newNames);
                    }}
                    className="bg-background/50 border-border"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Constraints */}
          <div className="space-y-2">
            <Label htmlFor="constraints" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Contraintes Techniques
            </Label>
            <Textarea
              id="constraints"
              placeholder="Ex: Pas de micro, petite scène, public très proche..."
              value={formData.constraints}
              onChange={(e) => updateField("constraints", e.target.value)}
              className="bg-background/50 border-border min-h-[80px]"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isGenerating}
            className={cn(
              "w-full bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background font-semibold",
              "hover:opacity-90 transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isGenerating && "animate-pulse"
            )}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin mr-2" />
                Génération en cours...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Générer le Plan de Soirée
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
