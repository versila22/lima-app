# Décisions — lima

Décisions spécifiques à ce projet. Pour les décisions transverses (outillage, process,
multi-projets), voir le registre transverse `decisions/DECISIONS.md`.

**Règles** : *append-only* ; une décision = une entrée numérotée ; si une décision change,
nouvelle entrée avec statut `Remplace #N`. Recherche : `Ctrl+F`.

## Index

| # | Date | Décision | Statut |
|---|------|----------|--------|
| [0001](#adr-0001) | 2026-06-28 | Récupération gracieuse des chunks lazy périmés après déploiement (silence Sentry) | Accepté |

---

## ADR-0001 — Récupération gracieuse des chunks lazy périmés après déploiement {#adr-0001}

- **Date** : 2026-06-28
- **Statut** : Accepté

**Contexte**

Le rapport hebdo Sentry remontait une issue *Ongoing* sur lima :
`TypeError: Failed to fetch dynamically imported module … CabaretOrganizer-*.js`. Cause : la SPA
Vite découpe le code en chunks hashés ; à chaque déploiement les hash changent. Un visiteur dont
l'onglet est resté ouvert sur le build N, qui navigue ensuite vers une route lazy, demande un
fichier `.js` qui n'existe plus côté serveur → échec d'import dynamique. Transitoire (un reload
charge le nouveau build). Un handler `vite:preloadError` rechargeait déjà la page une fois, **mais**
il ne faisait pas `preventDefault()` → Vite relançait l'erreur, captée par Sentry : l'issue restait
vivante à chaque déploiement.

**Décision**

Dans `src/main.tsx` : (1) `event.preventDefault()` dans le handler `vite:preloadError` (Vite ne
relance plus l'erreur avant le reload qu'on déclenche nous-mêmes) ; (2) `ignoreErrors` dans
`Sentry.init` sur la classe « import dynamique échoué », car transitoire et déjà auto-réparée.
Le garde anti-boucle existant (cooldown 10 s via sessionStorage) est conservé.

**Pourquoi**

Le découpage en chunks hashés est inhérent à Vite et souhaitable (cache). On ne peut pas garantir
qu'aucun onglet ne survit à un déploiement. Le seul levier praticable = récupération côté client
+ silence de l'erreur non actionnable. Alternative écartée : garder les anciens chunks sur le
serveur (complexité de rétention, pas de blue-green sur le VPS openclaw).

**Conséquences**

- L'issue Sentry ne se rouvre plus à chaque déploiement ; le visiteur récupère par un reload invisible.
- Angle mort assumé : un asset réellement 404 en permanence (déploiement cassé) ne lèvera plus
  d'issue Sentry → c'est la baseline E2E (deploy-guard) qui doit l'attraper.
- Même classe d'incident que côté tako (Server Action / ChunkLoadError) : garde symétrique.
