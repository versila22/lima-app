# Plaquette de démarchage LIMA

Deux PDF en **entonnoir** : début commun (la LIMA), puis la fiche du spectacle
proposé au prospect.

| Fichier | Cible | Contenu |
|---|---|---|
| `plaquette-match.pdf` | Salles de spectacle, scènes municipales, mairies, ligues d'impro (200-400 pers.) | Couverture + Qui sommes-nous + fiche **Match** |
| `plaquette-cabaret.pdf` | Bars, cafés-concerts, salles d'association (30-50 pers.) | Couverture + Qui sommes-nous + fiche **Cabaret** |

## Sources

- `plaquette.html` — **fichier maître** : tout le contenu + le style (couverture,
  Qui sommes-nous, fiche Match, fiche Cabaret).
- `plaquette-match.html` / `plaquette-cabaret.html` — versions découpées (couverture
  + intro + une seule fiche), prêtes à imprimer.
- `01_Intro_commune.md`, `02_Fiche_Match.md`, `03_Fiche_Cabaret.md` — textes seuls.

## Régénérer les PDF

Le plus simple : ouvrir `plaquette-match.html` (ou `-cabaret`) dans un navigateur
→ `Ctrl+P` → **Enregistrer au format PDF**, format A4, marges « aucune »,
cocher « Graphiques d'arrière-plan ».

En ligne de commande (Chrome headless, ce qui a généré ces PDF) :

```bash
chrome --headless=new --no-pdf-header-footer \
  --print-to-pdf="plaquette-match.pdf" "file:///chemin/absolu/plaquette-match.html"
```

> Important : passer une **URL `file://` absolue**, sinon Chrome ne rend qu'une
> seule page.

Après modif du contenu, mettre à jour le fichier maître `plaquette.html` puis
re-découper en deux (couverture + intro + une fiche chacun).
