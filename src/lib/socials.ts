// Comptes officiels de la LIMA — source unique de vérité pour les liens sociaux.
export const LIMA_WEBSITE = "https://www.lima.asso.fr";
export const LIMA_FACEBOOK = "https://www.facebook.com/lima.impro";
export const LIMA_INSTAGRAM = "https://www.instagram.com/lima_impro_angers/";

/**
 * URL de partage Facebook.
 * Facebook ne permet pas de cibler un post précis ; on partage le lien le plus
 * pertinent disponible (lien HelloAsso de l'événement), sinon on renvoie vers la
 * page Facebook de la LIMA pour publier manuellement.
 */
export function facebookShareUrl(shareableUrl: string | null): string {
  if (shareableUrl) {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableUrl)}`;
  }
  return LIMA_FACEBOOK;
}
