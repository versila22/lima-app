import { Plus } from "lucide-react";
import { haptic } from "@/lib/haptics";

interface AgendaFABProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AgendaFAB({ onClick, disabled }: AgendaFABProps) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("fab");
        onClick();
      }}
      disabled={disabled}
      aria-label="Ajouter un événement"
      className="md:hidden fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold text-background hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 1rem)" }}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
