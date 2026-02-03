

# 🎭 Module "Organisateur de Cabaret"

Un outil dédié à la planification de soirées cabaret/impro, intégré dans un dashboard avec navigation latérale.

---

## 🎨 Design & Ambiance

**Thème général** : Mode sombre élégant avec des accents violets et dorés évoquant l'univers du spectacle et du cabaret.

- **Palette** : Fond sombre (gris foncé/noir), accents violet (#9b87f5) et doré (#F5A623)
- **Typographie** : Moderne et lisible, avec des titres expressifs
- **Touches visuelles** : Subtils dégradés, effets de lueur sur les éléments interactifs

---

## 📐 Structure de l'Application

### Sidebar de Navigation
- Logo/nom de l'association en haut
- Menu de navigation préparé pour futurs modules
- Lien actif vers "Organisateur de Cabaret"
- Bouton de collapse pour maximiser l'espace de travail

### Page Principale - Layout en 2 colonnes

| **Gauche - Formulaire** | **Droite - Prévisualisation** |
|-------------------------|-------------------------------|
| Tous les champs de saisie | Affichage du plan généré |
| Bouton "Générer le Plan" | Boutons d'action |

---

## 📝 Formulaire (Colonne Gauche)

**Champs prévus :**

1. **Nom du Lieu** - Champ texte (ex: "Bar le Joker")
2. **Contact Établissement** - Champ texte pour le gérant/infos clés
3. **Thème de la Soirée** - Champ texte (ex: "Sueur et Paillettes")
4. **Nombre de Joueurs** - Sélecteur numérique de 1 à 10
5. **Durée totale souhaitée** - Menu déroulant (1h, 1h15, 1h30)
6. **Contraintes Techniques** - Zone de texte multiligne

**Bouton principal :**
- "Générer le Plan de Soirée" avec icône ✨
- Animation de chargement pendant la génération (spinner + texte "Génération en cours...")

---

## 📋 Zone de Prévisualisation (Colonne Droite)

**Affichage du plan :**
- Rendu Markdown complet (titres, listes, tableaux, etc.)
- Style cohérent avec le thème sombre
- État vide avec message d'invitation à générer un plan

**Boutons d'action :**
- 📋 **Copier dans le presse-papier** - Copie le texte du plan
- 📄 **Télécharger en PDF** - Export simulé pour l'instant

---

## 📚 Historique Local

**Fonctionnalités :**
- Sauvegarde automatique des 5 derniers plans dans le navigateur (localStorage)
- Section "Historique récent" avec liste des plans précédents
- Chaque entrée affiche : date, nom du lieu, thème
- Clic pour recharger un plan précédent

---

## ⚙️ Comportement Technique

**Génération du plan :**
- Pour l'instant : réponse simulée avec un exemple de plan de soirée réaliste
- Structure prête pour intégrer un webhook n8n plus tard
- Animation de chargement pendant la "génération"

**Responsive :**
- Sur mobile : les colonnes s'empilent verticalement
- Formulaire en premier, puis zone de prévisualisation

---

## 🚀 Livrables

1. **Dashboard avec sidebar** - Navigation prête pour futurs modules
2. **Page Organisateur de Cabaret** - Formulaire complet + prévisualisation
3. **Composant Markdown** - Rendu élégant du plan généré
4. **Système d'historique** - 5 derniers plans en localStorage
5. **Actions** - Copier + Export PDF (simulé)
6. **Design dark mode** - Accents violet/doré style cabaret

