import { History, Calendar, MapPin, Palette, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type SavedPlan } from "@/hooks/usePlanHistory";
import { cn } from "@/lib/utils";

interface PlanHistoryProps {
  history: SavedPlan[];
  onLoadPlan: (plan: SavedPlan) => void;
}

export function PlanHistory({ history, onLoadPlan }: PlanHistoryProps) {
  if (history.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="w-5 h-5 text-muted-foreground" />
          Historique récent
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-2">
            {history.map((savedPlan) => (
              <button
                key={savedPlan.id}
                onClick={() => onLoadPlan(savedPlan)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border border-border/50",
                  "bg-background/30 hover:bg-background/50 transition-all duration-200",
                  "hover:border-primary/50 group"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground truncate">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      {savedPlan.formData.venueName || "Sans nom"}
                    </div>
                    {savedPlan.formData.theme && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 truncate">
                        <Palette className="w-3 h-3 shrink-0" />
                        {savedPlan.formData.theme}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Calendar className="w-3 h-3" />
                    {formatDate(savedPlan.createdAt)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
