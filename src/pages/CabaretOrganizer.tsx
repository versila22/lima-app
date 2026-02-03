import { useState } from "react";
import { CabaretForm, type CabaretFormData } from "@/components/cabaret/CabaretForm";
import { PlanPreview } from "@/components/cabaret/PlanPreview";
import { PlanHistory } from "@/components/cabaret/PlanHistory";
import { generateMockPlan } from "@/lib/cabaret-generator";
import { usePlanHistory, type SavedPlan } from "@/hooks/usePlanHistory";
import { toast } from "sonner";

export default function CabaretOrganizer() {
  const [generatedPlan, setGeneratedPlan] = useState<string>("");
  const [currentFormData, setCurrentFormData] = useState<CabaretFormData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { history, savePlan, loadPlan } = usePlanHistory();

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
