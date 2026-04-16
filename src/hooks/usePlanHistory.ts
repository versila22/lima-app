import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { ShowPlanRead, ShowPlanCreate } from "@/types";
import { type CabaretFormData } from "@/components/cabaret/CabaretForm";

export interface SavedPlan {
  id: string;
  formData: CabaretFormData;
  plan: string;
  createdAt: string;
}

const STORAGE_KEY = "cabaret-plan-history";
const MAX_HISTORY = 5;

// ---- LocalStorage helpers (fallback) ----
function getLocalHistory(): SavedPlan[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveLocalHistory(plans: SavedPlan[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // ignore
  }
}

// ---- Converters ----
function showPlanToSavedPlan(sp: ShowPlanRead): SavedPlan {
  const config = (sp.config ?? {}) as Partial<CabaretFormData>;
  const formData: CabaretFormData = {
    venueName: sp.venue_name ?? "",
    venueContact: sp.venue_contact ?? "",
    showType: sp.show_type,
    theme: sp.theme ?? "",
    playerCount: (config.playerCount as number) ?? 4,
    playerNames: (config.playerNames as string[]) ?? [],
    teamCount: (config.teamCount as number) ?? 1,
    playersPerTeam: (config.playersPerTeam as number) ?? 4,
    teams: (config.teams as CabaretFormData["teams"]) ?? [],
    arbitreName: (config.arbitreName as string) ?? "",
    duration: sp.duration ?? "1h30",
    constraints: (config.constraints as string) ?? "",
    djCount: (config.djCount as number) ?? 0,
    djNames: (config.djNames as string[]) ?? [],
  };
  return {
    id: sp.id,
    formData,
    plan: sp.generated_plan ?? "",
    createdAt: sp.created_at,
  };
}

// ---- Main hook ----
export function usePlanHistory() {
  const queryClient = useQueryClient();
  const { isAuthenticated: isLoggedIn } = useAuth();

  // ---- Fetch: API if logged in, localStorage otherwise ----
  const {
    data: history = [],
  } = useQuery<SavedPlan[]>({
    queryKey: ["show-plans"],
    queryFn: async () => {
      if (!isLoggedIn) return getLocalHistory();
      try {
        const plans = await api.get<ShowPlanRead[]>("/show-plans");
        return plans.map(showPlanToSavedPlan);
      } catch {
        // Fallback to localStorage on error
        return getLocalHistory();
      }
    },
    staleTime: 30_000,
  });

  // ---- Save: API if logged in ----
  const saveMutation = useMutation<SavedPlan, Error, { formData: CabaretFormData; plan: string }>({
    mutationFn: async ({ formData, plan }) => {
      if (!isLoggedIn) {
        // localStorage fallback
        const newPlan: SavedPlan = {
          id: crypto.randomUUID(),
          formData,
          plan,
          createdAt: new Date().toISOString(),
        };
        const existing = getLocalHistory();
        const updated = [newPlan, ...existing].slice(0, MAX_HISTORY);
        saveLocalHistory(updated);
        return newPlan;
      }

      // API save
      const createData: ShowPlanCreate = {
        title: formData.venueName
          ? `${formData.showType} — ${formData.venueName}`
          : `Plan ${new Date().toLocaleDateString("fr-FR")}`,
        show_type: formData.showType as ShowPlanCreate["show_type"],
        theme: formData.theme || undefined,
        duration: formData.duration || undefined,
        venue_name: formData.venueName || undefined,
        venue_contact: formData.venueContact || undefined,
        config: {
          playerCount: formData.playerCount,
          playerNames: formData.playerNames,
          teamCount: formData.teamCount,
          playersPerTeam: formData.playersPerTeam,
          teams: formData.teams,
          arbitreName: formData.arbitreName,
          constraints: formData.constraints,
          djCount: formData.djCount,
          djNames: formData.djNames,
        },
      };

      const created = await api.post<ShowPlanRead>("/show-plans", createData);

      // Save generated plan text via PUT
      const updated = await api.put<ShowPlanRead>(`/show-plans/${created.id}`, {
        generated_plan: plan,
      });

      return showPlanToSavedPlan(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["show-plans"] });
    },
    onError: (err) => {
      toast.error(`Erreur sauvegarde : ${err.message}`);
    },
  });

  // ---- Delete: API if logged in ----
  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      if (!isLoggedIn) {
        const existing = getLocalHistory().filter((p) => p.id !== id);
        saveLocalHistory(existing);
        return;
      }
      await api.delete(`/show-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["show-plans"] });
      toast.success("Plan supprimé");
    },
    onError: (err) => {
      toast.error(`Erreur suppression : ${err.message}`);
    },
  });

  const savePlan = (formData: CabaretFormData, plan: string) => {
    saveMutation.mutate({ formData, plan });
  };

  const loadPlan = (savedPlan: SavedPlan): SavedPlan => savedPlan;

  const clearHistory = () => {
    if (!isLoggedIn) {
      saveLocalHistory([]);
      queryClient.setQueryData<SavedPlan[]>(["show-plans"], []);
      return;
    }
    // Delete all plans
    history.forEach((p) => deleteMutation.mutate(p.id));
  };

  return {
    history,
    savePlan,
    loadPlan,
    clearHistory,
  };
}
