import { type CabaretFormData } from "@/components/cabaret/CabaretForm";

export function generateMockPlan(formData: CabaretFormData): string {
  const { venueName, venueContact, showType, theme, playerCount, playerNames, duration, constraints, djCount, djNames } = formData;
  
  const durationMinutes = duration === "1h" ? 60 : duration === "1h15" ? 75 : duration === "2h" ? 120 : 90;
  const warmupDuration = 10;
  const intermissionDuration = durationMinutes > 60 ? 10 : 0;
  const availableShowTime = durationMinutes - warmupDuration - intermissionDuration;
  
  const games = getGameSuggestions(playerCount, availableShowTime, theme);

  // Format player names
  const filledPlayerNames = (playerNames || []).filter(name => name.trim() !== "");
  const playerNamesDisplay = filledPlayerNames.length > 0 
    ? filledPlayerNames.join(", ") 
    : `${playerCount} joueur${playerCount > 1 ? "s" : ""} (noms non renseignés)`;

  // Format DJ names
  const filledDjNames = (djNames || []).filter(name => name.trim() !== "");
  const djDisplay = djCount === 0 
    ? "Aucun DJ" 
    : filledDjNames.length > 0 
      ? filledDjNames.join(", ") 
      : `${djCount} DJ (nom${djCount > 1 ? "s" : ""} non renseigné${djCount > 1 ? "s" : ""})`;

  // Format show type
  const showTypeLabels: Record<string, string> = {
    match: "Match d'impro",
    cabaret: "Cabaret",
    catch: "Catch d'impro",
    autre: "Autre format"
  };
  const showTypeDisplay = showTypeLabels[showType] || showType || "Cabaret";

  return `# 🎭 Plan de Soirée ${showTypeDisplay}

## 📍 Informations Générales

| Élément | Détail |
|---------|--------|
| **Lieu** | ${venueName || "À définir"} |
| **Contact** | ${venueContact || "Non renseigné"} |
| **Type** | ${showTypeDisplay} |
| **Thème** | ${theme || "Soirée libre"} |
| **Durée totale** | ${duration} |

---

## 👥 L'Équipe

### 🎭 Joueurs (${playerCount})
${filledPlayerNames.length > 0 
  ? filledPlayerNames.map((name, i) => `${i + 1}. **${name}**`).join("\n") 
  : `_${playerCount} joueur${playerCount > 1 ? "s" : ""} - prénoms non renseignés_`}

### 🎧 DJ
${djCount === 0 
  ? "_Pas de DJ pour cette soirée_" 
  : filledDjNames.length > 0 
    ? filledDjNames.map((name, i) => `${i + 1}. **${name}**`).join("\n") 
    : `_${djCount} DJ - prénom${djCount > 1 ? "s" : ""} non renseigné${djCount > 1 ? "s" : ""}_`}

---

## ⚠️ Contraintes Techniques

${constraints ? constraints.split("\n").map(c => `- ${c}`).join("\n") : "_Aucune contrainte particulière signalée._"}

---

## 🎬 Déroulé de la Soirée

### ⏰ Planning

| Horaire | Durée | Segment |
|---------|-------|---------|
| 20h30 | ${warmupDuration} min | 🔥 Échauffement / Accueil |
${games.map((g, i) => `| ${formatTime(30 + warmupDuration + games.slice(0, i).reduce((acc, curr) => acc + curr.duration, 0))} | ${g.duration} min | ${g.emoji} ${g.name} |`).join("\n")}
${intermissionDuration > 0 ? `| ${formatTime(30 + warmupDuration + games.slice(0, Math.ceil(games.length / 2)).reduce((acc, curr) => acc + curr.duration, 0))} | ${intermissionDuration} min | 🍺 Entracte |` : ""}

---

## 🎮 Détail des Jeux

${games.map((game, index) => `
### ${index + 1}. ${game.emoji} ${game.name}
**Durée** : ${game.duration} minutes  
**Joueurs** : ${game.players}

${game.description}

${game.tips ? `> 💡 **Conseil** : ${game.tips}` : ""}
`).join("\n")}

---

## 📝 Notes pour l'équipe

- Arriver **30 minutes avant** pour le repérage
- Prévoir un **tableau ou paperboard** pour les catégories
- Désigner un **MC** pour gérer les transitions
${theme ? `- Intégrer le thème "${theme}" dans les introductions` : ""}

---

## 🌟 Conseils pour ${venueName || "le lieu"}

1. **Gestion du public** : ${constraints?.toLowerCase().includes("proche") ? "Public proche = interactions directes ! Profitez-en pour des apartés." : "Maintenez le contact visuel avec tout le public."}
2. **Énergie** : Commencez fort avec un jeu dynamique, puis alternez rythmes
3. **Thématique** : ${theme ? `N'hésitez pas à glisser des références à "${theme}" tout au long de la soirée` : "Laissez émerger un fil rouge naturellement"}

---

*Plan généré automatiquement - À adapter selon l'énergie du moment ! 🎭✨*
`;
}

interface Game {
  name: string;
  emoji: string;
  duration: number;
  players: string;
  description: string;
  tips?: string;
}

function getGameSuggestions(playerCount: number, availableTime: number, theme?: string): Game[] {
  const allGames: Game[] = [
    {
      name: "Le Freeze",
      emoji: "🧊",
      duration: 12,
      players: "Tous",
      description: "Deux joueurs commencent une scène. À tout moment, un autre joueur peut crier \"Freeze\", prendre la position exacte d'un des joueurs et lancer une nouvelle scène.",
      tips: "Idéal en ouverture pour dynamiser le public",
    },
    {
      name: "La Moulinette",
      emoji: "🌀",
      duration: 10,
      players: "4-6",
      description: "Scène avec rotations rapides de personnages. Chaque sortie de scène = entrée d'un nouveau personnage.",
      tips: "Parfait après l'échauffement",
    },
    {
      name: "Le Doublage",
      emoji: "🎙️",
      duration: 15,
      players: "4",
      description: "Deux joueurs en scène font des gestes sans parler, deux autres en coulisse doublent leurs voix.",
      tips: "Choisir des voix contrastées",
    },
    {
      name: "Les Experts",
      emoji: "🎓",
      duration: 12,
      players: "3-4",
      description: "Panel d'experts improbables qui doivent répondre aux questions du public sur un sujet décalé.",
      tips: "Préparez quelques sujets absurdes en backup",
    },
    {
      name: "Le Film en Accéléré",
      emoji: "⏩",
      duration: 10,
      players: "3-5",
      description: "Les joueurs improvisent une histoire, puis la rejouent en 2 min, puis en 30 sec, puis en 10 sec.",
      tips: "Finir sur celui-ci garantit des rires",
    },
    {
      name: "La Scène Rejouée",
      emoji: "🔄",
      duration: 12,
      players: "2-4",
      description: "Une scène de base est rejouée dans différents styles (film d'horreur, comédie musicale, western...).",
    },
    {
      name: "Le Tribunal Imaginaire",
      emoji: "⚖️",
      duration: 15,
      players: "5-6",
      description: "Un procès absurde avec juge, avocats et témoins. Le public vote le verdict.",
      tips: "Impliquez le public comme jury",
    },
    {
      name: "La Machine à Remonter le Temps",
      emoji: "⏰",
      duration: 10,
      players: "3-4",
      description: "Une scène peut être rembobinée ou avancée sur demande du public.",
    },
  ];

  // Select games based on player count and available time
  const suitableGames = allGames.filter((game) => {
    const playerRange = game.players.includes("Tous") 
      ? true 
      : game.players.includes("-")
        ? parseInt(game.players.split("-")[0]) <= playerCount
        : parseInt(game.players) <= playerCount;
    return playerRange;
  });

  // Build a set that fits the time
  const selectedGames: Game[] = [];
  let remainingTime = availableTime;

  for (const game of suitableGames) {
    if (remainingTime >= game.duration) {
      selectedGames.push(game);
      remainingTime -= game.duration;
    }
    if (remainingTime < 10) break;
  }

  return selectedGames.slice(0, 6); // Max 6 games
}

function formatTime(minutesAfter20h: number): string {
  const hours = Math.floor(minutesAfter20h / 60) + 20;
  const minutes = minutesAfter20h % 60;
  return `${hours}h${minutes.toString().padStart(2, "0")}`;
}
