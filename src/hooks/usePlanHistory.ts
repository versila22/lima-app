import { useState, useEffect } from "react";
import { type CabaretFormData } from "@/components/cabaret/CabaretForm";

export interface SavedPlan {
  id: string;
  formData: CabaretFormData;
  plan: string;
  createdAt: string;
}

const STORAGE_KEY = "cabaret-plan-history";
const MAX_HISTORY = 5;

export function usePlanHistory() {
  const [history, setHistory] = useState<SavedPlan[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load plan history:", error);
    }
  }, []);

  // Save history to localStorage whenever it changes
  const saveToStorage = (plans: SavedPlan[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
    } catch (error) {
      console.error("Failed to save plan history:", error);
    }
  };

  const savePlan = (formData: CabaretFormData, plan: string) => {
    const newPlan: SavedPlan = {
      id: crypto.randomUUID(),
      formData,
      plan,
      createdAt: new Date().toISOString(),
    };

    setHistory((prev) => {
      // Add new plan at the beginning and keep only MAX_HISTORY items
      const updated = [newPlan, ...prev].slice(0, MAX_HISTORY);
      saveToStorage(updated);
      return updated;
    });
  };

  const loadPlan = (savedPlan: SavedPlan): SavedPlan => {
    return savedPlan;
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    history,
    savePlan,
    loadPlan,
    clearHistory,
  };
}
