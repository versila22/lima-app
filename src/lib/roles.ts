// Source unique du jeu de rôles de casting (évite la dérive MJ_MC entre fichiers).
export const ROLE_ORDER = ["JR", "MJ", "MC", "DJ", "AR", "COACH", "BENEVOLE"] as const;

export type AssignmentRole = (typeof ROLE_ORDER)[number];

export const ROLE_LABELS: Record<AssignmentRole, string> = {
  JR: "Joueur",
  MJ: "MJ",
  MC: "MC",
  DJ: "DJ",
  AR: "Arbitre",
  COACH: "Coach",
  BENEVOLE: "Bénévole",
};

export const ROLE_EMOJI: Record<AssignmentRole, string> = {
  JR: "🎭",
  MJ: "🎬",
  MC: "🎤",
  DJ: "🎵",
  AR: "⚖️",
  COACH: "🏋️",
  BENEVOLE: "🙋",
};
