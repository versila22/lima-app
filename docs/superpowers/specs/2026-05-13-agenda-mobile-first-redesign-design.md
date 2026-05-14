# Refonte mobile-first de l'agenda Lima-App

**Date :** 2026-05-13
**Auteur :** versila22
**Approche retenue :** C — Refonte mobile-first complète avec timeline cards

---

## Contexte

Plusieurs utilisateurs (3-4 sur l'effectif) ont remonté de manière convergente plusieurs points de friction lors de l'usage de Lima-App sur smartphone Android :

- Au chargement, la sidebar latérale s'affiche brièvement et occupe la moitié de l'écran (red flag visuel immédiat).
- Le texte général est trop petit ; seuls les titres restent confortables à lire.
- L'affichage du détail d'un événement n'occupe que le bas de l'écran (bottom sheet ~85vh), avec l'agenda toujours visible derrière — pertinence nulle sur mobile.

La page agenda n'a jamais été pensée mobile-first : la vue calendrier est l'état par défaut sur tous les devices, alors qu'elle force un scroll horizontal en dessous de 720px de largeur. La vue liste — plus naturelle sur mobile — cache de surcroît le type d'événement (`hidden sm:inline-block`), donc l'information visuelle la plus utile pour balayer la liste.

Cette spec couvre une refonte mobile-first complète de la page agenda et corrige les défauts d'infrastructure mobile (hook `useIsMobile`, taille de texte par défaut) qui dépassent la page agenda mais conditionnent son rendu.

## Objectifs

- Plus de flash de sidebar au chargement sur mobile.
- Vue par défaut sur mobile = liste, sans toggle visible (le toggle réapparaît à partir de `md`).
- Détail d'événement en plein écran sur mobile (pas de bottom sheet 85vh).
- Tailles de texte de base augmentées sur mobile, sans toucher aux titres.
- Vue liste mobile remaniée en cards chronologiques avec photo de couverture si disponible.
- Sensation native : FAB, swipe horizontal pour naviguer dans le temps, pull-to-refresh, haptic feedback.
- Touch targets ≥ 44pt partout sur la page agenda.

## Hors scope

- Refonte mobile des autres pages (Members, Stats, MonProfil, etc.) — fera l'objet d'autres passes.
- Vue calendrier desktop : aucune modification, juste cachée sur mobile.
- Service Worker / offline-first : le SW PWA existant n'est pas touché.
- Internationalisation (l'app est française monolingue).

---

## Section 1 — Correctifs d'infrastructure mobile

### 1.1 Hook `useIsMobile`

**Fichier :** `src/hooks/use-mobile.tsx`

Le hook initialise actuellement `isMobile` à `undefined` puis retourne `!!isMobile = false` jusqu'à ce que `useEffect` résolve. Conséquence : sur le premier render, l'app croit être desktop. La sidebar (`<aside>` dans `AppSidebar.tsx`) s'affiche alors avec `fixed left-0 w-64` au lieu de `w-72 -translate-x-full`. Au passage en mobile, elle s'enlève visiblement → c'est le flash perçu par les utilisateurs.

**Correction :**
- Lecture **synchrone** de `window.innerWidth` dans l'initialiseur du `useState` (`typeof window !== "undefined" ? window.innerWidth < 768 : true`).
- Fallback `true` (mobile-first) si `window` indisponible (SSR / pré-hydratation), pour que la sidebar reste cachée par défaut.
- Le retour du hook devient `boolean` strict (plus de `boolean | undefined`).

### 1.2 Typographie mobile par défaut

**Fichiers concernés :** `tailwind.config.ts` (ou `src/app/globals.css` selon convention projet), pages utilisant `text-xs` / `text-sm`.

Augmenter les tailles de base utilisées dans les listes, descriptions et métadonnées sur mobile, sans toucher aux titres (qui restent lisibles selon les retours).

- Définir une convention : sur `<md`, le corps de texte par défaut est **15px** (au lieu de 12-14 actuellement). On utilise `text-[15px] md:text-sm` ou `text-base md:text-sm` selon le contexte.
- Auditer les usages de `text-xs` dans la page Agenda et remplacer par `text-sm md:text-xs` lorsqu'il s'agit de contenu (pas de chip décoratif).
- Inputs déjà à `h-11` — OK.
- Boutons : forcer `h-11 min-w-[44px]` quand `<md` pour respecter le 44pt iOS / 48dp Android.

## Section 2 — Vue par défaut et structure du header

### 2.1 Vue par défaut mobile = liste

**Fichier :** `src/pages/Agenda.tsx`

- L'état `viewMode` est initialisé à `"calendar"`. Modifier pour qu'il soit `"list"` si `useIsMobile()` est vrai au mount.
- Toggle calendrier/liste **caché sur `<md`** (`hidden md:flex` sur le conteneur du toggle).
- La vue calendrier reste accessible et identique sur `md+`. Aucune modification de son rendu desktop.

### 2.2 Header mobile compact

**Fichier :** `src/pages/Agenda.tsx`

Le header actuel empile sur mobile : icône+titre / view toggle / 2 boutons nav mois / month label / season select / bouton Ajouter. Sur 375px, cela représente 3-4 lignes wrap, peu lisible.

**Nouvelle structure mobile (<md) :**

- Ligne 1 : `[Titre Agenda]` ........... `[Saison (select compact)]`
- Ligne 2 : barre horizontale scrollable de **filter chips** (tous types + chaque type d'événement, multi-toggleable). Remplace les `Select` filtre type / filtre visibilité par des chips visuelles.
- Pas de bouton Ajouter dans le header → voir FAB section 5.
- Pas de bouton mois précédent/suivant → la nav mois est gérée par swipe (section 6).

**Desktop (md+) :** structure inchangée.

## Section 3 — Vue liste mobile : timeline cards

**Fichier :** `src/pages/Agenda.tsx` → composant `AgendaListView`.

La liste actuelle affiche : colonne date compacte + titre/heure tronqués + chip de type **cachée sur mobile**. Densité forte mais info visuelle pauvre.

**Nouveau rendu mobile (<md) — cards larges :**

- Chaque event = une **card** plein-largeur, hauteur ~110px, coins arrondis (`rounded-xl`).
- Background : photo de couverture de l'event si dispo (réutiliser la query `event-photos` ou un endpoint léger `cover_url` côté backend si pas déjà servi avec l'event ; **à confirmer côté API** — préférer une optimisation backend si nécessaire). À défaut, dégradé coloré dérivé du type d'event (réutiliser `FALLBACK_BG` déjà présent dans `Agenda.tsx`).
- Surcouche `bg-gradient-to-t from-black/85 via-black/50 to-transparent` + `backdrop-blur-md bg-black/30` sur le quart bas, pour la lisibilité du texte (pattern déjà utilisé dans `EventDetailDrawer` lignes 778-789).
- Contenu en bas de la card, en blanc :
  - **Chip de type** (toujours visible, point coloré + label court)
  - **Titre** (font-semibold)
  - **Date + heure** (format `mar. 14 mai · 20:00`)
  - **Badge "Aujourd'hui"** si applicable
- Touch target = la card entière, ouvre le détail event.

**Groupement chronologique :**

- Sticky day-header lors du scroll, format `Mai 2026` (capitalize).
- Header collant `top-0` sous le header de page, avec backdrop blur.

**Aide à la navigation :**

- Bouton flottant "Aller à aujourd'hui" (rond, en bas-droite au-dessus du FAB) qui apparaît si l'utilisateur a scrollé > 1 mois loin de la date du jour.

**Desktop (md+) :** la liste actuelle (dense, sans photo) est conservée — pas de rupture pour les utilisateurs desktop habitués.

## Section 4 — Filtres en bottom sheet

**Fichier :** `src/pages/Agenda.tsx`

Les `Select` `h-8 text-xs` actuels pour filter type / visibility ne respectent pas 44pt et obligent à un menu déroulant peu adapté au pouce.

**Mobile (<md) :**

- Remplacés par une rangée horizontale de **chips** (filter chips) dans le header (section 2.2). Chaque tap toggle un type d'événement. Multiselect.
- Quand on est admin, un chip "Visibilité" supplémentaire ouvre un **bottom sheet** (réutiliser `Drawer` shadcn) avec les 4 options de visibilité.
- Bouton "Effacer filtres" reste, visible uniquement si filtre actif (comme aujourd'hui).

**Desktop (md+) :** filtres `Select` actuels conservés.

## Section 5 — FAB "Ajouter"

**Fichier :** `src/pages/Agenda.tsx`

Sur mobile, le bouton "Ajouter" actuel est noyé dans le header.

**Mobile (<md), admin only :**

- FAB rond `w-14 h-14 rounded-full`, dégradé `from-cabaret-purple to-cabaret-gold` (cohérent avec l'identité), position `fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] right-4 z-30` pour rester au-dessus du `MobileBottomNav` (h-14) et de la safe-area.
- Icône `Plus` (lucide), `aria-label="Ajouter un événement"`.
- Caché sur `md+` ; le bouton header reste sur desktop.

## Section 6 — Gestes natifs

### 6.1 Swipe horizontal pour naviguer dans le temps

**Fichier :** `src/pages/Agenda.tsx` (vue liste mobile uniquement).

**Règle d'adaptation :**

- Si le mois affiché contient **≤ 6 événements** : swipe gauche → mois suivant, swipe droite → mois précédent.
- Si le mois affiché contient **> 6 événements** : swipe gauche → semaine suivante, swipe droite → semaine précédente. Le pas de 1 mois resterait trop long à scroller.
- L'état "fenêtre temporelle" devient (`currentMonth`) + (`anchorWeek` optionnel quand densité haute).

**Implémentation :**

- Utiliser `framer-motion` (`useMotionValue` + `useTransform` + `useDragControls`) déjà présent dans les deps, ou un hook minimal basé sur `pointerdown / pointermove / pointerup` si on veut éviter une dépendance lourde sur cette feature seule. **Décision : `framer-motion`** car déjà installé et plus robuste sur edge cases iOS.
- Seuil de déclenchement : déplacement horizontal > 80px ET vitesse > 0.3 px/ms, sinon retour à la position initiale (snap-back).
- Empêcher le swipe horizontal de capturer le scroll vertical : `direction lock` (gestion des angles dominants).

**Status non utilisé :** si à 4 semaines de release la feature n'est pas utilisée (à juger via le sentiment dev ou un retour informel), la spec autorise son retrait sans nouvelle approbation.

### 6.2 Pull-to-refresh

- Sur la vue liste, geste pull-down depuis le haut recharge la query `["events", activeSeason?.id]` via `queryClient.invalidateQueries`.
- Indicateur visuel : spinner `Loader2` animé qui apparaît dans la zone de "drag" tant qu'on n'a pas relâché.
- Pas de bibliothèque ad hoc — réutiliser la même base `framer-motion` que pour le swipe horizontal, distinguer par direction.

### 6.3 Haptic feedback

- API `navigator.vibrate(...)` avec garde de feature detection.
- Patterns courts :
  - Tap sur une card event : `vibrate(8)`
  - Tap FAB : `vibrate(12)`
  - Pull-to-refresh déclenché : `vibrate(15)`
- Ne pas vibrer sur scroll passif ni sur swipe annulé (snap-back).

## Section 7 — Détail d'événement plein écran

**Fichier :** `src/pages/Agenda.tsx` → composant `EventDetailDrawer`.

Actuellement : `<DrawerContent className="max-h-[85vh]">` — bottom sheet sur tous les devices. Sur mobile, l'agenda en arrière-plan est inutile et le contenu est compressé.

**Mobile (<md) :**

- `DrawerContent` passe en **plein écran** : `h-screen max-h-screen rounded-t-none`.
- Bouton X de fermeture en haut-droite, position `absolute top-3 right-3`, contraste suffisant sur la photo banner (cercle semi-transparent).
- La photo banner garde `h-44` mais le reste du contenu peut désormais utiliser toute la hauteur.

**Desktop (md+) :**

- Comportement inchangé : `max-h-[85vh]` bottom sheet.

## Section 8 — Add / Edit Event en Drawer plein écran sur mobile

**Fichier :** `src/pages/Agenda.tsx` → composants `AddEventDialog` et `EditEventDialog`.

Actuellement : `Dialog` shadcn centré. Sur mobile, un formulaire de 8-10 champs dans un `Dialog` est très contraint.

**Mobile (<md) :**

- Remplacer `Dialog` par `Drawer` (shadcn vaul) en plein écran : `h-screen`.
- Le contenu scroll verticalement à l'intérieur du Drawer.
- Header sticky avec X close + titre.
- Footer sticky avec boutons Annuler / Enregistrer (touch target h-11).

**Desktop (md+) :**

- `Dialog` actuel conservé.

**Notes :**

- Pas de stepper multi-étapes (effort hors scope, on garde un formulaire linéaire scrollable).
- Le `DateTimePicker` + `Popover` doivent être testés sur mobile en plein écran (`Popover` peut clipper). Si problème, basculer en input natif `<input type="datetime-local">` sur mobile uniquement.

---

## Risques et incertitudes

- **Photo de couverture en card mobile** : nécessite que l'endpoint `/events` retourne déjà une URL de cover (ou la première photo). Si ce n'est pas le cas, ça implique un round-trip supplémentaire par card. **À vérifier en début d'implémentation** ; si l'API ne renvoie pas le cover, soit on l'ajoute (préféré), soit on tombe sur le dégradé `FALLBACK_BG` sans charger les photos individuellement.
- **Swipe vs scroll vertical** : direction lock peut nuire à la fluidité sur des cards courtes. À tester sur device réel iOS et Android.
- **Pull-to-refresh** : le navigateur Android Chrome a son propre pull-to-refresh natif qui peut interférer. Il faudra `overscroll-behavior: contain` sur le conteneur de la liste, ou désactiver le swipe natif via meta tag.
- **Vibration API sur iOS** : `navigator.vibrate` n'est pas supporté sur Safari iOS. Le code doit feature-detect et ignorer silencieusement. Pas de fallback alternatif (pas de Taptic Engine accessible depuis le web).
- **Régression desktop** : tout changement structurel du `Agenda.tsx` peut casser le rendu desktop. Tester systématiquement les deux breakpoints après chaque section.

## Critères de succès

- Plus aucun flash de sidebar visible sur Android au chargement (test physique).
- Sur 375px, vue liste mobile : aucun texte sous 14px hors décorations.
- Détail d'événement occupe 100% de la viewport sur mobile.
- Tous les touch targets de la page agenda mesurent ≥ 44×44px sur mobile.
- Vue calendrier desktop : pixel-identique à avant la refonte.

## Ordre d'implémentation suggéré

L'implémentation devrait suivre cet ordre pour limiter les régressions et déployer de la valeur tôt :

1. Section 1.1 — Fix `useIsMobile` (résout le red flag immédiatement, peu de risque)
2. Section 7 — `EventDetailDrawer` plein écran mobile (résout un retour utilisateur direct)
3. Section 2 — Vue par défaut liste + header mobile compact
4. Section 1.2 — Audit typographique global mobile
5. Section 3 — Cards timeline avec photo
6. Section 5 — FAB Ajouter
7. Section 4 — Filtres en chips + bottom sheet
8. Section 8 — Add/Edit en Drawer plein écran
9. Section 6 — Gestes natifs (swipe, pull-to-refresh, haptic) — en dernier car le plus risqué

Chaque étape doit être commitée séparément avec validation visuelle sur 375 / 430 / 768.
