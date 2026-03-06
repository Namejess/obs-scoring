# OBS Scoring — Architecture

> Document vivant, mis à jour à chaque étape du refacto.

## Vue d'ensemble

**OBS Scoring** est une application de scoring en temps réel pour les streams OBS. Elle permet de créer des matchs, mettre à jour les scores via une interface d'administration (web ou mobile), et afficher un overlay de score dans OBS Studio.

### Stack technique

| Layer          | Technologie                                     |
| -------------- | ----------------------------------------------- |
| Monorepo       | pnpm workspaces + Turborepo                     |
| Types partagés | TypeScript (`@obs-scoring/shared`)              |
| Backend        | Node.js + Express + Socket.io + Prisma (SQLite) |
| Frontend Web   | Vue 3 (Composition API) + Vite                  |
| Mobile         | React Native (Expo)                             |
| Tests          | Vitest + Supertest + Vue Test Utils             |

---

## Structure du monorepo

```
obs-scoring/
├── package.json                 ← pnpm workspaces root
├── pnpm-workspace.yaml          ← définit packages/*
├── turbo.json                   ← Turborepo pipeline config
├── tsconfig.base.json           ← config TS partagée (strict)
├── .env.example                 ← template des variables d'env
├── ARCHITECTURE.md              ← ce fichier
│
├── packages/
│   ├── shared/                  ← @obs-scoring/shared
│   │   └── src/types/           ← Match, DTO, SocketEvents
│   │
│   ├── bracket-layout/          ← @obs-scoring/bracket-layout (NEW)
│   │   └── src/                 ← Layout engine pour brackets
│   │
│   ├── server/                  ← @obs-scoring/server
│   │   ├── src/                 ← Express + Socket.io
│   │   ├── prisma/              ← schema.prisma + migrations
│   │   └── tests/               ← unit + integration
│   │
│   ├── web/                     ← @obs-scoring/web
│   │   ├── src/                 ← Vue 3 app
│   │   │   ├── composables/     ← useMatches, useSocket, useStartgg
│   │   │   ├── components/      ← UI components + BracketTree
│   │   │   └── views/           ← AdminView, OverlayView, PreviewView
│   │   └── tests/
│   │
│   └── mobile/                  ← @obs-scoring/mobile
│       ├── app/                 ← Expo Router screens
│       ├── components/
│       └── hooks/
│
└── [legacy]/                    ← obs-backend/, obs-frontend/ (à supprimer)
```

---

## Packages

### `@obs-scoring/shared`

Types TypeScript partagés entre tous les packages.

**Exports principaux :**

- `Match` — entité match complète
- `CreateMatchDto` — données pour créer un match
- `UpdateScoreDto` — données pour mettre à jour un score
- `OBSOverlayData` — format optimisé pour l'overlay OBS
- `ScoreUpdateEvent` — payload des events Socket.io
- `SocketEvents` — types des événements socket

### `@obs-scoring/bracket-layout`

Layout engine haute-performance pour affichage de brackets de tournoi (style start.gg).

**Caractéristiques :**

- Calcul de positions pour single/double elimination brackets
- Support Winners/Losers/Grand Final
- Connecteurs SVG entre matchs (type winner/loser)
- Zero dependencies, tree-shakable
- Cross-platform (Web/React Native)

**Exports principaux :**

- `calculateBracketLayout(sets, options)` — calcule les positions de tous les matchs
- `connectorToSvgPath(connector)` — convertit un connecteur en chemin SVG
- Types: `BracketSet`, `BracketNode`, `BracketConnector`, `BracketLayoutOptions`

**Architecture ADR :** Voir `docs/adr/ADR-001-bracket-tree-renderer.md`

### `@obs-scoring/server`

API REST + WebSocket (Socket.io) avec persistance SQLite.

**Endpoints REST :**
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/matches` | Liste tous les matchs |
| GET | `/matches/current` | Match actuel (isCurrent=true) |
| GET | `/matches/obsData` | Données formatées pour overlay OBS |
| GET | `/matches/:id` | Détail d'un match |
| POST | `/matches` | Créer un match |
| PATCH | `/matches/:id` | Mettre à jour le score |
| PATCH | `/matches/:id/setCurrent` | Définir comme match en cours |
| DELETE | `/matches/:id` | Supprimer un match |

**Routes start.gg :**
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/startgg/tournaments` | Liste tournois de l'utilisateur |
| GET | `/api/startgg/tournaments/:slug/events` | Events d'un tournoi |
| GET | `/api/startgg/events/:id/sets` | Sets d'un event |
| GET | `/api/startgg/events/:id/sets/active` | Sets en cours |
| POST | `/api/startgg/sets/:id/select` | Sélectionner un set → crée/met à jour match |
| POST | `/api/startgg/poll/event/:id` | Lancer polling pour un event |
| DELETE | `/api/startgg/poll` | Arrêter le polling |

**Events Socket.io :**
| Event | Direction | Payload |
|-------|-----------|---------|
| `scoreUpdate` | Server → Client | `ScoreUpdateEvent` |
| `matchCreated` | Server → Client | `Match` |
| `matchDeleted` | Server → Client | `{ id: number }` |
| `currentMatchChanged` | Server → Client | `Match \| null` |

**Base de données :**
SQLite via Prisma. Fichier stocké dans `packages/server/prisma/data/obs-scoring.db`.

### `@obs-scoring/web`

Application Vue 3 avec deux modes :

1. **Admin** (`/`) — gestion des matchs, scores, preview
2. **Overlay OBS** (`/overlay`) — affichage optimisé pour OBS Browser Source

**Routes :**
| Route | Usage |
|-------|-------|
| `/` | Interface admin |
| `/preview` | Preview live de l'overlay (avec contrôles de style) |
| `/overlay` | URL pour OBS Browser Source |

**Paramètres URL de l'overlay (`/overlay?...`) :**
| Param | Default | Description |
|-------|---------|-------------|
| `textColor` | `ffffff` | Couleur du texte (hex sans #) |
| `bgColor` | `transparent` | Couleur de fond |
| `fontSize` | `48` | Taille de police (px) |
| `fontFamily` | `Inter` | Police |
| `showTeams` | `true` | Afficher les équipes |
| `layout` | `horizontal` | `horizontal` ou `vertical` |

### `@obs-scoring/mobile`

App React Native (Expo) pour Android. Navigation simple basée sur state (pas de React Navigation).

**Structure :**

```
packages/mobile/
├── App.tsx                        ← Entry point avec navigation state
├── app.json                       ← Expo config
├── index.ts                       ← Expo registerRootComponent
├── tsconfig.json
└── src/
    ├── services/
    │   ├── api.ts                 ← Client REST API (axios)
    │   ├── storage.ts             ← AsyncStorage (URL serveur)
    │   └── startgg.ts             ← Client API start.gg
    ├── context/
    │   └── SocketContext.tsx      ← Provider Socket.io + auto-reconnect
    ├── hooks/
    │   └── useMatches.ts          ← Hook CRUD matchs
    ├── components/
    │   ├── ConnectionIndicator.tsx ← Badge online/offline
    │   ├── MatchCard.tsx          ← Affichage match dans liste
    │   └── ScoreControls.tsx      ← Boutons +1/-1
    └── screens/
        ├── MatchListScreen.tsx    ← Liste des matchs
        ├── MatchDetailScreen.tsx  ← Détail + contrôles score
        ├── CreateMatchScreen.tsx  ← Formulaire création
        ├── SettingsScreen.tsx     ← Configuration URL serveur
        ├── TournamentScreen.tsx   ← Sélection tournoi start.gg
        └── BracketScreen.tsx      ← Sets d'un event start.gg
```

**Écrans :**

- **Matches** — liste des matchs avec indicateur "en cours"
- **Match Detail** — boutons +1/-1 pour update rapide du score
- **Create Match** — formulaire de création
- **Settings** — configuration URL du serveur (IP locale)
- **Tournaments** — liste des tournois start.gg, sélection d'event
- **Bracket** — sets en cours/à venir, sélection pour OBS

---

## Configuration

### Variables d'environnement

Copier `.env.example` vers `.env` à la racine et dans `packages/server/`.

| Variable          | Description            | Exemple                                          |
| ----------------- | ---------------------- | ------------------------------------------------ |
| `PORT`            | Port du serveur        | `3000`                                           |
| `DATABASE_URL`    | URL SQLite Prisma      | `file:./data/obs-scoring.db`                     |
| `ALLOWED_ORIGINS` | Origins CORS autorisés | `http://localhost:5173,http://192.168.1.42:5173` |

### Pour le mobile

L'app mobile nécessite de configurer l'IP locale du serveur dans les settings (ex: `192.168.1.42:3000`). Le serveur et le téléphone doivent être sur le même réseau WiFi.

---

## Commandes

### Développement

```bash
# Installation
pnpm install

# Lancer tout (server + web en parallèle)
pnpm dev

# Lancer un package spécifique
pnpm --filter @obs-scoring/server dev
pnpm --filter @obs-scoring/web dev
pnpm --filter @obs-scoring/mobile dev
```

### Base de données

```bash
# Appliquer le schema Prisma
pnpm db:push

# Ouvrir Prisma Studio (UI pour voir/éditer les données)
pnpm db:studio
```

### Tests

```bash
# Tous les tests
pnpm test

# Tests unitaires seulement
pnpm test:unit

# Tests d'intégration seulement
pnpm test:integration
```

### Build

```bash
# Build de production
pnpm build
```

---

## Scripts disponibles

### Commandes globales (depuis la racine)

```bash
# Développement
pnpm dev              # Lance server + web en parallèle (Turborepo)
pnpm dev:server       # Lance uniquement le backend (port 3000)
pnpm dev:web          # Lance uniquement le frontend web (port 5173)
pnpm dev:mobile       # Lance Expo dev server

# Build
pnpm build            # Build tous les packages
pnpm build:server     # Build uniquement le server (dist/)
pnpm build:web        # Build uniquement le web (dist/)

# Tests
pnpm test             # Run tous les tests (37 tests)
pnpm test:unit        # Tests unitaires seulement
pnpm test:integration # Tests d'intégration seulement

# Qualité
pnpm lint             # TypeScript check sur tous les packages
pnpm typecheck        # Alias de lint
pnpm format           # Prettier sur tous les fichiers
pnpm format:check     # Vérifie le formatting

# Base de données (Prisma)
pnpm db:push          # Sync schema → SQLite (dev)
pnpm db:studio        # Lance Prisma Studio GUI
pnpm db:migrate       # Crée une migration

# Mobile
pnpm mobile           # Lance Expo dev server
pnpm mobile:android   # Lance sur émulateur/device Android
pnpm mobile:ios       # Lance sur simulateur iOS
pnpm mobile:build:android    # Build APK via EAS
pnpm mobile:build:ios        # Build iOS via EAS
pnpm mobile:build:preview    # Build preview (internal)

# Nettoyage
pnpm clean            # Supprime node_modules et caches
pnpm clean:build      # Supprime les builds et DB
```

### Commandes par package

```bash
# Server (@obs-scoring/server)
pnpm --filter @obs-scoring/server dev       # nodemon + ts-node
pnpm --filter @obs-scoring/server build     # tsc → dist/
pnpm --filter @obs-scoring/server start     # node dist/index.js
pnpm --filter @obs-scoring/server test      # vitest

# Web (@obs-scoring/web)
pnpm --filter @obs-scoring/web dev          # vite dev server
pnpm --filter @obs-scoring/web build        # vite build
pnpm --filter @obs-scoring/web preview      # serve production build
pnpm --filter @obs-scoring/web test         # vitest

# Mobile (@obs-scoring/mobile)
pnpm --filter @obs-scoring/mobile start     # expo start
pnpm --filter @obs-scoring/mobile android   # expo start --android
pnpm --filter @obs-scoring/mobile ios       # expo start --ios
```

---

## Lancer l'app sur un téléphone Android

### Méthode 1 : Expo Go (développement rapide)

1. **Installer Expo Go** sur votre téléphone Android (Play Store)
2. **Démarrer le serveur** : `pnpm dev:server`
3. **Démarrer l'app mobile** : `pnpm mobile`
4. **Scanner le QR code** affiché dans le terminal avec Expo Go
5. **Configurer l'IP du serveur** : Dans Settings, entrer l'IP locale (ex: `http://192.168.1.100:3000`)

### Méthode 2 : APK Preview (build standalone)

1. **Installer EAS CLI** : `npm install -g eas-cli`
2. **Login Expo** : `eas login`
3. **Build APK** : `pnpm mobile:build:android`
4. **Télécharger et installer** l'APK depuis le lien fourni

### Méthode 3 : Émulateur Android

1. **Installer Android Studio** + configurer un AVD
2. **Lancer l'émulateur**
3. **Run** : `pnpm mobile:android`

---

## Workflow OBS

### Configuration de l'overlay dans OBS

1. Lancer le serveur : `pnpm dev`
2. Dans OBS, ajouter une **Source > Navigateur**
3. URL : `http://localhost:5173/overlay`
4. Dimensions recommandées : 1920x200 (horizontal) ou 400x600 (vertical)
5. Personnaliser via URL params : `http://localhost:5173/overlay?textColor=00ff00&fontSize=64`

### Preview dans l'admin

Avant de configurer OBS, utiliser `/preview` dans l'admin pour :

- Voir l'overlay en temps réel dans un iframe
- Tester différentes configurations de style
- Copier l'URL finale à coller dans OBS

---

## Historique des changements

| Date       | Phase | Description                                                             |
| ---------- | ----- | ----------------------------------------------------------------------- |
| 2026-03-06 | 1     | Init monorepo pnpm + Turborepo + tsconfig base                          |
| 2026-03-06 | 2     | Package `@obs-scoring/shared` — types TypeScript partagés               |
| 2026-03-06 | 3     | Package `@obs-scoring/server` — API Express + Socket.io + Prisma/SQLite |
| 2026-03-06 | 4     | Package `@obs-scoring/web` — Vue 3 Composition API + Vite               |
| 2026-03-06 | 5     | Package `@obs-scoring/mobile` — Expo React Native app                   |
| 2026-03-06 | A-B   | start.gg integration — Prisma models, StartggService, API routes        |
| 2026-03-06 | C     | Mobile start.gg — TournamentScreen, BracketScreen                       |
| 2026-03-06 | D     | Web start.gg — StartggPanel, useStartgg composable                      |

---

## Tests

**37 tests passants** (33 server + 4 web) :

```
packages/server:
├── tests/unit/matchService.test.ts     (16 tests)
└── tests/integration/matches.test.ts   (17 tests)

packages/web:
├── tests/unit/useSocket.test.ts        (2 tests)
├── tests/unit/useMatches.test.ts       (1 test)
└── tests/unit/ScoreOverlay.test.ts     (1 test)
```

---

## Migration depuis l'ancien code

Les dossiers `obs-backend/` et `obs-frontend/` ont été supprimés après migration complète.

**Changements majeurs :**

- JavaScript → TypeScript strict
- MongoDB/Mongoose → SQLite/Prisma
- Vue Options API → Composition API
- URLs hardcodées → Variables d'environnement
- Pas de tests → Vitest + Supertest (37 tests)
