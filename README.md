# 🎭 LIMA App — Ligue d'Improvisation du Maine-et-Loire

Application web de gestion pour la **LIMA** (Ligue d'Improvisation du Maine-et-Loire). Planification de spectacles, gestion des membres, agenda de la saison, et grilles d'alignement.

![React](https://img.shields.io/badge/React-18-blue?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)

---

## ✨ Fonctionnalités

### 🔐 Authentification
- Login email / mot de passe (JWT)
- Rôles : **Admin** (CA + Bureau) / **Membre**
- Activation de compte par token

### 👥 Gestion des membres
- Import CSV depuis **HelloAsso** (adhérents + joueurs)
- 4 statuts : **Match** (M), **Cabaret** (C), **Loisir** (L), **Adhérent** (A)
- Commissions : Comspec, Comprog, Comform, Comadh, Comcom
- Recherche et filtrage

### 📅 Agenda
- Calendrier mensuel avec code couleur par type d'événement
- Types : Entraînement spectacle, Entraînement loisir, Match, Cabaret, Welsh, Formation, AG
- Détail événement avec **casting** (joueurs, MJ/MC, DJ, arbitre)

### 🎭 Organisateur de spectacle
- Formulaire de configuration (lieu, type, joueurs, durée, contraintes)
- Génération de plan de soirée en Markdown
- Historique des plans sauvegardés

### 📊 Grilles d'alignement
- Affectation des joueurs aux événements par trimestre
- Rôles : JR (Joueur), DJ, MJ/MC, AR (Arbitre), COACH
- Séparation Cabaret / Match
- Publication pour les adhérents

### ⚙️ Paramètres
- Configuration de l'association (admin only)
- Gestion des saisons, lieux, commissions

---

## 🏗️ Stack technique

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** + **shadcn/ui**
- **React Query** (TanStack) pour les appels API
- **React Router** v6
- `date-fns` + `react-markdown` + `remark-gfm`

### Backend
- **FastAPI** (Python 3.12+)
- **SQLAlchemy 2.0** (async, asyncpg)
- **PostgreSQL 16**
- **Alembic** pour les migrations
- **JWT** (python-jose) + **bcrypt** pour l'auth
- Import CSV HelloAsso + Import Excel calendrier

---

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- Python 3.12+
- PostgreSQL 16+

### Backend

```bash
cd backend

# Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (DATABASE_URL, JWT_SECRET, etc.)

# Installer les dépendances
pip install -r requirements.txt

# Lancer les migrations
alembic upgrade head

# (Optionnel) Seeder avec des données de démo
python seed.py

# Lancer le serveur
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
# Installer les dépendances
npm install

# Configurer l'URL du backend (optionnel si même serveur)
export VITE_API_URL=http://localhost:8000

# Lancer en développement
npm run dev

# Build pour la production
npm run build
```

### Docker Compose (tout-en-un)

```bash
cd backend

# Configurer les variables
cp .env.example .env
# Éditer .env

# Lancer
docker compose up -d
```

---

## 📁 Structure du projet

```
lima-app/
├── src/                          # Frontend React
│   ├── components/               # Composants UI
│   │   ├── cabaret/              # Organisateur de spectacle
│   │   ├── layout/               # Sidebar, Dashboard
│   │   └── ui/                   # shadcn/ui components
│   ├── contexts/                 # AuthContext
│   ├── hooks/                    # Custom hooks
│   ├── lib/                      # API client, utilitaires
│   ├── pages/                    # Pages (Login, Agenda, Members, Settings)
│   └── types/                    # Types TypeScript
├── backend/                      # Backend FastAPI
│   ├── app/
│   │   ├── models/               # SQLAlchemy models
│   │   ├── schemas/              # Pydantic schemas
│   │   ├── routers/              # API endpoints
│   │   ├── services/             # Business logic (import, auth)
│   │   └── utils/                # Security, dependencies
│   ├── alembic/                  # Migrations DB
│   ├── static/                   # Frontend buildé (production)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── docker-compose.yml
├── package.json
└── vite.config.ts
```

---

## 🔌 API Endpoints (33)

| Domaine | Endpoints |
|---------|-----------|
| **Auth** | `POST /auth/login`, `GET /auth/me`, `PUT /auth/me`, `POST /auth/activate`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `PUT /auth/me/password` |
| **Members** | `GET /members`, `POST /members`, `GET /members/{id}`, `PUT /members/{id}`, `DELETE /members/{id}`, `POST /members/import`, `POST /members/{id}/resend-activation`, `PUT /members/{id}/role` |
| **Events** | `GET /events`, `POST /events`, `GET /events/{id}`, `GET /events/{id}/cast`, `PUT /events/{id}`, `DELETE /events/{id}`, `POST /events/import-calendar` |
| **Alignments** | `GET /alignments`, `POST /alignments`, `GET /alignments/{id}`, `PUT /alignments/{id}`, `DELETE /alignments/{id}`, `POST /alignments/{id}/assign`, `PUT /alignments/{id}/publish` |
| **Autres** | `GET /seasons`, `GET /venues`, `GET /commissions`, `GET /show-plans`, `GET /settings`, `GET /health` |

Documentation Swagger : `/docs` | ReDoc : `/redoc`

---

## 📋 Import HelloAsso

L'application importe directement les exports CSV de HelloAsso :

1. **CSV Adhérents** — bulletin d'adhésion (données personnelles, commission)
2. **CSV Joueurs** — cotisation joueur (groupe de jeu : Match/Cabaret, tarif)

Les membres sont rapprochés par **email**. Le statut (M/C/L/A) est déduit du groupe de jeu ou du tarif de cotisation.

---

## 🎨 Design

- Thème **sombre** avec accents **violet** (#7C3AED) et **or** (#F59E0B)
- **Responsive** — mobile-first
- Sidebar rétractable avec navigation et liens sociaux
- Calendrier avec **code couleur** par type d'événement

---

## 📄 Licence

Ce projet est développé pour la **LIMA** (Ligue d'Improvisation du Maine-et-Loire).

---

## 👥 Contributeurs

- **Jérôme Jacq** — Développeur principal, membre LIMA
- Développé avec l'assistance de **Jayvis** (IA coach & dev)
