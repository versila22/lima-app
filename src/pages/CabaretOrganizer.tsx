import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CabaretForm, type CabaretFormData } from "@/components/cabaret/CabaretForm";
import { PlanPreview } from "@/components/cabaret/PlanPreview";
import { PlanHistory } from "@/components/cabaret/PlanHistory";
import { generateMockPlan } from "@/lib/cabaret-generator";
import { usePlanHistory, type SavedPlan } from "@/hooks/usePlanHistory";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { SeasonRead } from "@/types";

const SHOW_TYPE_LABELS: Record<string, string> = {
  match: "Match d'impro",
  cabaret: "Cabaret",
  catch: "Catch d'impro",
  autre: "Spectacle",
};

const EVENT_TYPE_MAP: Record<string, string> = {
  match: "match",
  cabaret: "cabaret",
  catch: "match",
  autre: "other",
};

export default function CabaretOrganizer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generatedPlan, setGeneratedPlan] = useState<string>("");
  const [currentFormData, setCurrentFormData] = useState<CabaretFormData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { history, savePlan, loadPlan } = usePlanHistory();

  const { data: seasons = [] } = useQuery<SeasonRead[]>({
    queryKey: ["seasons"],
    queryFn: () => api.get<SeasonRead[]>("/seasons"),
    staleTime: 60_000,
  });
  const currentSeason = seasons.find((s) => s.is_current) ?? seasons[0];

  const addToCalendarMutation = useMutation({
    mutationFn: (formData: CabaretFormData) => {
      const label = SHOW_TYPE_LABELS[formData.showType] ?? "Spectacle";
      const title = formData.venueName ? `${label} - ${formData.venueName}` : label;
      return api.post("/events", {
        season_id: currentSeason?.id,
        title,
        event_type: EVENT_TYPE_MAP[formData.showType] ?? "other",
        start_at: formData.startAt,
        notes: formData.constraints || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Événement ajouté à l'agenda !");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      navigate("/agenda");
    },
    onError: () => toast.error("Erreur lors de l'ajout à l'agenda"),
  });

  const handleGenerate = async (formData: CabaretFormData) => {
    setIsGenerating(true);
    setCurrentFormData(formData);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const plan = generateMockPlan(formData);
    setGeneratedPlan(plan);
    savePlan(formData, plan);
    setIsGenerating(false);
    toast.success("Plan de soirée généré avec succès !");
  };

  const handleLoadPlan = (savedPlan: SavedPlan) => {
    setGeneratedPlan(savedPlan.plan);
    setCurrentFormData(savedPlan.formData);
    toast.info("Plan chargé depuis l'historique");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold gradient-text">Organisateur de Cabaret</h1>
        <p className="text-muted-foreground mt-1">
          Planifiez vos soirées d'improvisation en quelques clics
        </p>
      </header>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Left column - Form */}
        <div className="flex flex-col gap-4 overflow-auto">
          <CabaretForm
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            initialData={currentFormData}
            onAddToCalendar={(data) => addToCalendarMutation.mutate(data)}
            isAddingToCalendar={addToCalendarMutation.isPending}
          />
          <PlanHistory history={history} onLoadPlan={handleLoadPlan} />
        </div>

        {/* Right column - Preview */}
        <div className="flex flex-col min-h-0">
          <PlanPreview plan={generatedPlan} isGenerating={isGenerating} />
        </div>
      </div>
    </div>
  );
}
