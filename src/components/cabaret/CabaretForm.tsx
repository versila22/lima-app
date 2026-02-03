import { useState, useEffect } from "react";
import { Sparkles, MapPin, User, Palette, Users, Clock, AlertTriangle, Music, Theater, Gavel, UsersRound } from "lucide-react";
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

export interface TeamData {
  name: string;
  playerNames: string[];
}

export interface CabaretFormData {
  venueName: string;
  venueContact: string;
  showType: string;
  theme: string;
  // For cabaret/autre: single group
  playerCount: number;
  playerNames: string[];
  // For match/catch: teams
  teamCount: number;
  playersPerTeam: number;
  teams: TeamData[];
  // Match specific
  arbitreName: string;
  // Common
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

const createEmptyTeams = (teamCount: number, playersPerTeam: number): TeamData[] => {
  return Array.from({ length: teamCount }, (_, i) => ({
    name: `Équipe ${i + 1}`,
    playerNames: Array(playersPerTeam).fill(""),
  }));
};

const getDefaultFormData = (showType: string): CabaretFormData => {
  const base = {
    venueName: "",
    venueContact: "",
    showType,
    theme: "",
    duration: "1h30",
    constraints: "",
    djNames: [],
    arbitreName: "",
  };

  switch (showType) {
    case "match":
      return {
        ...base,
        playerCount: 8,
        playerNames: [],
        teamCount: 2,
        playersPerTeam: 4,
        teams: createEmptyTeams(2, 4),
        djCount: 1,
        djNames: [""],
      };
    case "catch":
      return {
        ...base,
        playerCount: 4,
        playerNames: [],
        teamCount: 2,
        playersPerTeam: 2,
        teams: createEmptyTeams(2, 2),
        djCount: 0,
        djNames: [],
      };
    case "cabaret":
    case "autre":
    default:
      return {
        ...base,
        playerCount: 4,
        playerNames: ["", "", "", ""],
        teamCount: 1,
        playersPerTeam: 4,
        teams: [],
        djCount: 0,
        djNames: [],
      };
  }
};

export function CabaretForm({ onGenerate, isGenerating, initialData }: CabaretFormProps) {
  const [formData, setFormData] = useState<CabaretFormData>(() => {
    if (initialData) {
      return {
        ...getDefaultFormData(initialData.showType ?? "cabaret"),
        ...initialData,
        teams: initialData.teams ?? [],
        djCount: initialData.djCount ?? 0,
        djNames: initialData.djNames ?? [],
        arbitreName: initialData.arbitreName ?? "",
      };
    }
    return getDefaultFormData("cabaret");
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...getDefaultFormData(initialData.showType ?? "cabaret"),
        ...initialData,
        teams: initialData.teams ?? [],
        djCount: initialData.djCount ?? 0,
        djNames: initialData.djNames ?? [],
        arbitreName: initialData.arbitreName ?? "",
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

  const handleShowTypeChange = (newType: string) => {
    const newDefaults = getDefaultFormData(newType);
    setFormData((prev) => ({
      ...newDefaults,
      venueName: prev.venueName,
      venueContact: prev.venueContact,
      theme: prev.theme,
      constraints: prev.constraints,
    }));
  };

  const updateTeamName = (teamIndex: number, name: string) => {
    const newTeams = [...formData.teams];
    newTeams[teamIndex] = { ...newTeams[teamIndex], name };
    updateField("teams", newTeams);
  };

  const updateTeamPlayerName = (teamIndex: number, playerIndex: number, name: string) => {
    const newTeams = [...formData.teams];
    const newPlayerNames = [...newTeams[teamIndex].playerNames];
    newPlayerNames[playerIndex] = name;
    newTeams[teamIndex] = { ...newTeams[teamIndex], playerNames: newPlayerNames };
    updateField("teams", newTeams);
  };

  const handleTeamCountChange = (count: number) => {
    updateField("teamCount", count);
    const newTeams = createEmptyTeams(count, formData.playersPerTeam);
    // Preserve existing team data
    formData.teams.forEach((team, i) => {
      if (i < count) {
        newTeams[i] = {
          name: team.name,
          playerNames: team.playerNames.slice(0, formData.playersPerTeam),
        };
        while (newTeams[i].playerNames.length < formData.playersPerTeam) {
          newTeams[i].playerNames.push("");
        }
      }
    });
    updateField("teams", newTeams);
  };

  const handlePlayersPerTeamChange = (count: number) => {
    updateField("playersPerTeam", count);
    const newTeams = formData.teams.map((team) => ({
      ...team,
      playerNames: [...team.playerNames.slice(0, count), ...Array(Math.max(0, count - team.playerNames.length)).fill("")],
    }));
    updateField("teams", newTeams);
    updateField("playerCount", formData.teamCount * count);
  };

  const isTeamBased = formData.showType === "match" || formData.showType === "catch";
  const isMatch = formData.showType === "match";

  // Get player count options based on show type
  const getPlayerCountOptions = () => {
    if (formData.showType === "cabaret") {
      return [4, 5];
    }
    return Array.from({ length: 10 }, (_, i) => i + 1);
  };

  // Get team count options
  const getTeamCountOptions = () => {
    if (formData.showType === "match") return [2];
    if (formData.showType === "catch") return [2, 3];
    return [1];
  };

  // Get players per team options
  const getPlayersPerTeamOptions = () => {
    if (formData.showType === "match") return [4, 5];
    if (formData.showType === "catch") return [1, 2, 3];
    return [4, 5];
  };

  // Get DJ count options (match requires at least 1)
  const getDjCountOptions = () => {
    if (formData.showType === "match") return [1, 2];
    return [0, 1, 2];
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

          {/* Show Type */}
          <div className="space-y-2">
            <Label htmlFor="showType" className="flex items-center gap-2">
              <Theater className="w-4 h-4 text-primary" />
              Type de Spectacle
            </Label>
            <Select
              value={formData.showType}
              onValueChange={handleShowTypeChange}
            >
              <SelectTrigger className="bg-background/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="match">Match d'impro</SelectItem>
                <SelectItem value="cabaret">Cabaret</SelectItem>
                <SelectItem value="catch">Catch d'impro</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
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

          {/* Team-based configuration (Match / Catch) */}
          {isTeamBased && (
            <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <h3 className="font-semibold flex items-center gap-2">
                <UsersRound className="w-4 h-4 text-primary" />
                Configuration des Équipes
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Team Count */}
                <div className="space-y-2">
                  <Label className="text-sm">Nombre d'équipes</Label>
                  <Select
                    value={formData.teamCount.toString()}
                    onValueChange={(v) => handleTeamCountChange(parseInt(v))}
                  >
                    <SelectTrigger className="bg-background/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {getTeamCountOptions().map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} équipe{num > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Players per Team */}
                <div className="space-y-2">
                  <Label className="text-sm">Joueurs par équipe</Label>
                  <Select
                    value={formData.playersPerTeam.toString()}
                    onValueChange={(v) => handlePlayersPerTeamChange(parseInt(v))}
                  >
                    <SelectTrigger className="bg-background/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {getPlayersPerTeamOptions().map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} joueur{num > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Teams */}
              {formData.teams.map((team, teamIndex) => (
                <div key={teamIndex} className="space-y-3 p-3 rounded-lg border border-border/50 bg-background/30">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nom de l'équipe {teamIndex + 1}</Label>
                    <Input
                      placeholder={`Ex: Les Improbables`}
                      value={team.name}
                      onChange={(e) => updateTeamName(teamIndex, e.target.value)}
                      className="bg-background/50 border-border"
                    />
                  </div>
                  <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                    {team.playerNames.map((playerName, playerIndex) => (
                      <div key={playerIndex} className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <User className="w-3 h-3 text-primary" />
                          Joueur {playerIndex + 1}
                        </Label>
                        <Input
                          placeholder={`Prénom`}
                          value={playerName}
                          onChange={(e) => updateTeamPlayerName(teamIndex, playerIndex, e.target.value)}
                          className="bg-background/50 border-border h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Single group configuration (Cabaret / Autre) */}
          {!isTeamBased && (
            <div className="space-y-4">
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
                    {getPlayerCountOptions().map((num) => (
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
            </div>
          )}

          {/* Arbitre (Match only) */}
          {isMatch && (
            <div className="space-y-2">
              <Label htmlFor="arbitreName" className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-accent" />
                Prénom de l'Arbitre
              </Label>
              <Input
                id="arbitreName"
                placeholder="Ex: Marie"
                value={formData.arbitreName}
                onChange={(e) => updateField("arbitreName", e.target.value)}
                className="bg-background/50 border-border"
              />
            </div>
          )}

          {/* Duration */}
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

          {/* DJ Count */}
          <div className="space-y-2">
            <Label htmlFor="djCount" className="flex items-center gap-2">
              <Music className="w-4 h-4 text-accent" />
              Nombre de DJ
              {isMatch && <span className="text-xs text-muted-foreground">(minimum 1 pour un match)</span>}
            </Label>
            <Select
              value={formData.djCount.toString()}
              onValueChange={(v) => {
                const count = parseInt(v);
                updateField("djCount", count);
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
                {getDjCountOptions().map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num === 0 ? "Aucun DJ" : `${num} DJ`}
                  </SelectItem>
                ))}
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
