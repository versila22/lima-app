import { type CabaretFormData, type TeamData } from "@/components/cabaret/CabaretForm";

export function generateMockPlan(formData: CabaretFormData): string {
  const { 
    venueName, 
    venueContact, 
    showType, 
    theme, 
    playerCount, 
    playerNames, 
    teams,
    arbitreName,
    duration, 
    constraints, 
    djCount, 
    djNames 
  } = formData;
  
  const durationMinutes = duration === "1h" ? 60 : duration === "1h15" ? 75 : duration === "2h" ? 120 : 90;
  const warmupDuration = 10;
  const intermissionDuration = durationMinutes > 60 ? 10 : 0;
  const availableShowTime = durationMinutes - warmupDuration - intermissionDuration;
  
  const isTeamBased = showType === "match" || showType === "catch";
  const isMatch = showType === "match";

  // Format show type
  const showTypeLabels: Record<string, string> = {
    match: "Match d'Impro",
    cabaret: "Cabaret",
    catch: "Catch d'Impro",
    autre: "Spectacle d'Impro"
  };
  const showTypeDisplay = showTypeLabels[showType] || showType || "Cabaret";

  // Format DJ names
  const filledDjNames = (djNames || []).filter(name => name.trim() !== "");
  const djDisplay = djCount === 0 
    ? "Aucun DJ" 
    : filledDjNames.length > 0 
      ? filledDjNames.join(", ") 
      : `${djCount} DJ (nom${djCount > 1 ? "s" : ""} non renseigné${djCount > 1 ? "s" : ""})`;

  // Build team section or player section
  let teamSection = "";
  let totalPlayers = 0;

  if (isTeamBased && teams && teams.length > 0) {
    totalPlayers = teams.reduce((acc, team) => acc + team.playerNames.length, 0);
    teamSection = teams.map((team, i) => {
      const filledNames = team.playerNames.filter(n => n.trim() !== "");
      const playersDisplay = filledNames.length > 0
        ? filledNames.map((name, j) => `   ${j + 1}. ${name}`).join("\n")
        : `   _${team.playerNames.length} joueur${team.playerNames.length > 1 ? "s" : ""} - prénoms non renseignés_`;
      return `### ${getTeamEmoji(i)} ${team.name || `Équipe ${i + 1}`}\n${playersDisplay}`;
    }).join("\n\n");
  } else {
    totalPlayers = playerCount;
    const filledPlayerNames = (playerNames || []).filter(name => name.trim() !== "");
    teamSection = filledPlayerNames.length > 0 
      ? filledPlayerNames.map((name, i) => `${i + 1}. **${name}**`).join("\n") 
      : `_${playerCount} joueur${playerCount > 1 ? "s" : ""} - prénoms non renseignés_`;
  }

  // Get games based on show type
  const games = getGameSuggestions(showType, totalPlayers, availableShowTime, theme);

  // Build intro speech
  const introSpeech = generateIntroSpeech(showType, venueName, theme, teams, arbitreName, filledDjNames);

  // Build staff section
  let staffSection = "";
  
  if (isMatch) {
    staffSection = `### 🎤 MC (Maître de Cérémonie)
_À désigner_

### ⚖️ Arbitre
${arbitreName ? `**${arbitreName}**` : "_À désigner_"}

### 🎧 DJ${djCount > 1 ? "s" : ""}
${filledDjNames.length > 0 
  ? filledDjNames.map((name, i) => `${i + 1}. **${name}**`).join("\n") 
  : `_${djCount} DJ - prénom${djCount > 1 ? "s" : ""} non renseigné${djCount > 1 ? "s" : ""}_`}`;
  } else {
    staffSection = `### 🎤 MC (Maître de Cérémonie)
_À désigner_

### 🎧 DJ
${djCount === 0 
  ? "_Pas de DJ pour cette soirée_" 
  : filledDjNames.length > 0 
    ? filledDjNames.map((name, i) => `${i + 1}. **${name}**`).join("\n") 
    : `_${djCount} DJ - prénom${djCount > 1 ? "s" : ""} non renseigné${djCount > 1 ? "s" : ""}_`}`;
  }

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

${isTeamBased ? `### 🏆 Les Équipes (${teams?.length || 0} équipes - ${totalPlayers} joueurs)\n\n${teamSection}` : `### 🎭 Les Joueurs (${totalPlayers})\n${teamSection}`}

---

## 🎬 Staff Technique

${staffSection}

---

## ⚠️ Contraintes Techniques

${constraints ? constraints.split("\n").map(c => `- ${c}`).join("\n") : "_Aucune contrainte particulière signalée._"}

---

## 🎤 Discours d'Entrée (Suggestion)

${introSpeech}

---

## 📋 Déroulé de la Soirée

### ⏰ Planning

| Horaire | Durée | Segment |
|---------|-------|---------|
| 20h30 | ${warmupDuration} min | 🔥 Échauffement / Accueil |
${games.map((g, i) => `| ${formatTime(30 + warmupDuration + games.slice(0, i).reduce((acc, curr) => acc + curr.duration, 0))} | ${g.duration} min | ${g.emoji} ${g.name} |`).join("\n")}
${intermissionDuration > 0 ? `| ${formatTime(30 + warmupDuration + games.slice(0, Math.ceil(games.length / 2)).reduce((acc, curr) => acc + curr.duration, 0))} | ${intermissionDuration} min | 🍺 Entracte |` : ""}

---

## 🎮 Détail des ${showType === "match" ? "Catégories" : "Jeux"}

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
${isMatch ? "- Préparer les **pancartes de score** et le matériel d'arbitrage" : ""}
${isMatch ? "- L'arbitre doit avoir un **sifflet** et des **cartons**" : ""}
- ${djCount > 0 ? "Coordonner avec le DJ pour les jingles et transitions" : "Prévoir une playlist de fond"}
- Désigner un **MC** pour gérer les transitions
${theme ? `- Intégrer le thème "${theme}" dans les introductions` : ""}

---

## 🌟 Conseils pour ${venueName || "le lieu"}

1. **Gestion du public** : ${constraints?.toLowerCase().includes("proche") ? "Public proche = interactions directes ! Profitez-en pour des apartés." : "Maintenez le contact visuel avec tout le public."}
2. **Énergie** : ${isMatch ? "Maintenez la tension compétitive tout au long du match" : "Commencez fort avec un jeu dynamique, puis alternez les rythmes"}
3. **Thématique** : ${theme ? `N'hésitez pas à glisser des références à "${theme}" tout au long de la soirée` : "Laissez émerger un fil rouge naturellement"}

---

*Plan généré automatiquement - À adapter selon l'énergie du moment ! 🎭✨*
`;
}

function getTeamEmoji(index: number): string {
  const emojis = ["🔴", "🔵", "🟢", "🟡"];
  return emojis[index] || "⚪";
}

function generateIntroSpeech(
  showType: string, 
  venueName: string, 
  theme: string, 
  teams: TeamData[], 
  arbitreName: string,
  djNames: string[]
): string {
  const venue = venueName || "ce magnifique lieu";
  const themeText = theme ? `, sur le thème \"${theme}\"` : "";

  if (showType === "match") {
    const team1 = teams?.[0]?.name || "Équipe 1";
    const team2 = teams?.[1]?.name || "Équipe 2";
    const arbitre = arbitreName || "notre arbitre";
    const dj = djNames.length > 0 ? djNames[0] : "notre DJ";

    return `> *"Mesdames et Messieurs, bonsoir et bienvenue à ${venue} !*
> 
> *Ce soir, préparez-vous à vivre un moment d'improvisation théâtrale intense${themeText} !*
> 
> *Deux équipes, un seul vainqueur... Accueillez chaleureusement :*
> *À ma droite, l'équipe **${team1}** !* 🔴
> *À ma gauche, l'équipe **${team2}** !* 🔵
> 
> *Et pour veiller au respect des règles, accueillez **${arbitre}** !* ⚖️
> 
> *Aux platines ce soir, **${dj}** !* 🎧
> 
> *Que le match commence !"*`;
  }

  if (showType === "catch") {
    const teamIntros = teams?.map((t, i) => `> *L'équipe **${t.name || `Équipe ${i + 1}`}** !* ${getTeamEmoji(i)}`).join("\n") || "";

    return `> *"Mesdames et Messieurs, bonsoir et bienvenue à ${venue} !*
> 
> *Ce soir, c'est CATCH D'IMPRO${themeText} !*
> *Des équipes, de l'énergie, de la compétition... et beaucoup de rires !*
> 
> *Accueillez vos combattants du soir :*
${teamIntros}
> 
> *Que le catch commence !"*`;
  }

  // Cabaret / Autre
  return `> *"Mesdames et Messieurs, bonsoir et bienvenue à ${venue} !*
> 
> *Ce soir, notre troupe vous propose un voyage au cœur de l'improvisation${themeText}.*
> 
> *Installez-vous confortablement, laissez-vous porter, et surtout... participez !*
> *Vos suggestions seront le carburant de notre créativité.*
> 
> *Que le spectacle commence !"*`;
}

interface Game {
  name: string;
  emoji: string;
  duration: number;
  players: string;
  description: string;
  tips?: string;
}

function getGameSuggestions(showType: string, playerCount: number, availableTime: number, theme?: string): Game[] {
  // Different game pools based on show type
  const matchCategories: Game[] = [
    {
      name: "Comparée - Libre",
      emoji: "⚔️",
      duration: 8,
      players: "2 vs 2",
      description: "Deux équipes improvisent sur le même thème. Le public vote pour sa préférée.",
      tips: "Le MC donne le thème et le nombre de joueurs avant le coup de sifflet",
    },
    {
      name: "Mixte - Chantée",
      emoji: "🎵",
      duration: 10,
      players: "Mixte",
      description: "Impro où les équipes alternent et doivent intégrer des passages chantés.",
      tips: "Le DJ doit être réactif pour accompagner les chants",
    },
    {
      name: "Comparée - À la manière de",
      emoji: "🎬",
      duration: 8,
      players: "2 vs 2",
      description: "Les équipes improvisent dans le style d'un réalisateur ou d'un genre cinématographique.",
    },
    {
      name: "Caucus",
      emoji: "🤝",
      duration: 5,
      players: "Tous",
      description: "Les deux équipes improvisent ensemble sur un même thème, sans compétition.",
      tips: "Moment de cohésion, souvent placé après l'entracte",
    },
    {
      name: "Comparée - Avec accessoire",
      emoji: "🎭",
      duration: 8,
      players: "2 vs 2",
      description: "Chaque équipe doit utiliser un accessoire imposé dans son impro.",
    },
    {
      name: "Mixte - Émotion imposée",
      emoji: "😭",
      duration: 10,
      players: "Mixte",
      description: "L'arbitre impose des changements d'émotion au cours de l'impro.",
    },
  ];

  const catchGames: Game[] = [
    {
      name: "Le Duel",
      emoji: "⚔️",
      duration: 8,
      players: "1 vs 1",
      description: "Deux joueurs s'affrontent en solo sur un thème donné. Le public vote.",
      tips: "Parfait pour chauffer la salle en début de spectacle",
    },
    {
      name: "La Revanche",
      emoji: "🔄",
      duration: 10,
      players: "Équipe vs Équipe",
      description: "L'équipe perdante du tour précédent peut défier l'équipe gagnante.",
    },
    {
      name: "Le Tag Team",
      emoji: "🏷️",
      duration: 12,
      players: "Tous",
      description: "Les joueurs peuvent se \"tagger\" pour entrer/sortir de scène à tout moment.",
      tips: "Très dynamique, limiter à 5 minutes par équipe",
    },
    {
      name: "Le Handicap",
      emoji: "🦿",
      duration: 8,
      players: "2 vs 3",
      description: "Une équipe joue en infériorité numérique contre l'autre.",
    },
    {
      name: "La Bataille Royale",
      emoji: "👑",
      duration: 15,
      players: "Tous",
      description: "Tous les joueurs sur scène, élimination progressive par le public.",
      tips: "Excellent en final de soirée",
    },
  ];

  const cabaretGames: Game[] = [
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

  // Select game pool based on show type
  let gamePool: Game[];
  switch (showType) {
    case "match":
      gamePool = matchCategories;
      break;
    case "catch":
      gamePool = catchGames;
      break;
    case "cabaret":
    case "autre":
    default:
      gamePool = cabaretGames;
  }

  // Build a set that fits the time
  const selectedGames: Game[] = [];
  let remainingTime = availableTime;

  for (const game of gamePool) {
    if (remainingTime >= game.duration) {
      selectedGames.push(game);
      remainingTime -= game.duration;
    }
    if (remainingTime < 8) break;
  }

  return selectedGames.slice(0, 6); // Max 6 games
}

function formatTime(minutesAfter20h: number): string {
  const hours = Math.floor(minutesAfter20h / 60) + 20;
  const minutes = minutesAfter20h % 60;
  return `${hours}h${minutes.toString().padStart(2, "0")}`;
}
