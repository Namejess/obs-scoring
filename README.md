# OBS Scoring App

Application de scoring en temps réel pour tournois FGC (Fighting Game Community), intégrée à **OBS Studio** et **start.gg**. Architecture monorepo pnpm/Turborepo avec backend TypeScript, frontend Vue 3, et application mobile React Native (Expo).

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture du monorepo](#architecture-du-monorepo)
- [Flux de données](#flux-de-données)
  - [Flux 1 — Gestion manuelle des matchs](#flux-1--gestion-manuelle-des-matchs)
  - [Flux 2 — Intégration start.gg](#flux-2--intégration-startgg)
  - [Flux 3 — Bracket viewer](#flux-3--bracket-viewer)
  - [Flux 4 — Overlay OBS](#flux-4--overlay-obs)
  - [Flux 5 — Application mobile](#flux-5--application-mobile)
- [Packages](#packages)
  - [packages/server](#packagesserver)
  - [packages/web](#packagesweb)
  - [packages/mobile](#packagesmobile)
  - [packages/shared](#packagesshared)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Lancer le projet](#lancer-le-projet)
- [Utilisation dans OBS](#utilisation-dans-obs)

---

## Vue d'ensemble

L'application permet à un opérateur de tournoi de :

1. **Créer et gérer des matchs manuellement** (noms des joueurs, équipes, scores)
2. **Importer des matchs depuis start.gg** (sélection de tournoi → event → set actif)
3. **Visualiser le bracket complet** dans une modale avec dark theme
4. **Diffuser les scores en temps réel dans OBS** via un overlay HTML transparent
5. **Contrôler les scores depuis un téléphone Android** via l'application mobile

---

## Architecture du monorepo

```
obs-scoring/
├── packages/
│   ├── server/          # Backend Express + Socket.io + Prisma (SQLite)
│   ├── web/             # Frontend Vue 3 + Vite (interface admin + overlay OBS)
│   ├── mobile/          # Application Android React Native (Expo)
│   ├── shared/          # Types TypeScript partagés (Match, Socket events, OBS data)
│   └── bracket-layout/  # (futur) Moteur de calcul de layout bracket
├── docs/
│   └── adr/             # Architecture Decision Records
├── scripts/
│   └── start-emulator.sh
├── package.json         # Root workspace (pnpm)
├── pnpm-workspace.yaml
├── turbo.json           # Pipeline Turborepo (build, dev, test, lint)
└── tsconfig.base.json   # Config TypeScript de base partagée
```

**Gestionnaire de paquets :** pnpm workspaces  
**Orchestration des tâches :** Turborepo (cache, pipelines parallèles)  
**TypeScript strict** activé sur tous les packages

---

## Flux de données

### Flux 1 — Gestion manuelle des matchs

```
[AdminView.vue]
    │
    ├─ <MatchCreator> ──POST /matches──────────────► [Server: createMatch()]
    │                                                      │
    ├─ <MatchList>                                         ├─ Prisma.match.create() → SQLite
    │   └─ Clic "setCurrent" ──PATCH /matches/:id/setCurrent─►│
    │                                                      └─ io.emit('currentMatchChanged')
    │                                                              │
    ├─ <ScoreUpdater> ──PATCH /matches/:id──────────►            │
    │   (incr/décr score)     updateScore()                       │
    │                              │                              │
    └─ <ScoreDisplay>         io.emit('scoreUpdate')             │
                                   │                              │
                    ┌──────────────▼──────────────────────────────▼──────┐
                    │          Socket.io broadcast                        │
                    │  scoreUpdate / currentMatchChanged / matchCreated   │
                    └──────────┬──────────────────────┬──────────────────┘
                               │                      │
                        [useSocket.ts]         [SocketContext.tsx]
                        (web Vue)              (mobile React Native)
                               │
                        [useMatches.ts]
                        met à jour matches[]
                        + currentMatch
```

**Route REST impliquées :**
| Méthode | Route | Action |
|---------|-------|--------|
| GET | `/matches` | Liste tous les matchs |
| GET | `/matches/current` | Match courant |
| GET | `/matches/obsData` | Données formatées OBS |
| POST | `/matches` | Créer un match |
| PATCH | `/matches/:id` | Mettre à jour les scores |
| PATCH | `/matches/:id/setCurrent` | Définir le match actif |
| DELETE | `/matches/:id` | Supprimer un match |

---

### Flux 2 — Intégration start.gg

```
[StartggPanel.vue]
    │
    ├─ onMounted ──GET /api/startgg/tournaments──────────► [startggService.getMyTournaments()]
    │                                                           │
    │                                                    GraphQL: UserTournaments
    │                                                    (past + upcoming, dedup, sort)
    │
    ├─ Clic tournoi ──GET /api/startgg/tournaments/:slug/events──► getTournamentEvents(slug)
    │                                                               │
    │                                                        GraphQL: TournamentEvents
    │                                                        (phases + phaseGroups)
    │
    ├─ Clic event ──GET /api/startgg/events/:id/sets?states=2,6,7──► getEventSets()
    │               perPage=50                                         │
    │                                                          GraphQL: EventSets
    │                                                          sortType CALL_ORDER
    │                                                          + upsert → StartggSet (SQLite)
    │                                                          Retourne mapSetForBracket[]
    │
    ├─ Clic set-card ──POST /api/startgg/sets/:setId/select──────► selectSet(setId)
    │                                                               │
    │                                                        1. getSetDetail() (GraphQL)
    │                                                        2. upsert StartggSet
    │                                                        3. updateMany Match.isCurrent=false
    │                                                        4. upsert/create Match avec startggSetId
    │                                                        5. io.emit('currentMatchChanged')
    │                                                        Retourne {match, set, fullRoundText}
    │
    └─ (optionnel) polling ──setInterval(15s)──────────────► refreshSets() avec filtre courant
```

**Modèle de données start.gg → SQLite :**

```
StartggSet {
  id (start.gg set ID), eventId, eventName
  phaseId, phaseName, phaseGroupId
  fullRoundText, identifier, round, state, bestOf
  player1Tag, player1Prefix, player1Score
  player2Tag, player2Prefix, player2Score
  winnerId?, startedAt?, completedAt?
  ──► match? (relation 1-to-1 optionnelle vers Match)
}

Match {
  id, player1, player2, team1?, team2?
  player1Score, player2Score
  isCurrent
  startggSetId? ──► StartggSet
}
```

**États des sets start.gg :**
| Code | Libellé |
|------|---------|
| 1 | CREATED |
| 2 | ACTIVE |
| 3 | COMPLETED |
| 4 | BYE |
| 6 | CALLED |
| 7 | QUEUED |

---

### Flux 3 — Bracket viewer

```
[StartggPanel.vue]
    │
    └─ Clic "🏆 Bracket"
           │
           ├─ fetchSets(eventId, {perPage:100})  ← charge tous les sets
           └─ showBracketModal = true
                    │
            [BracketModal.vue]  ← Teleport to="body", overlay dark
                    │
            [BracketViewer.vue]
                    │
                    ├─ loadCSS() ──► CDN: brackets-viewer@1.9.0/dist/brackets-viewer.min.css
                    ├─ loadScript() ──► CDN: brackets-viewer@1.9.0/dist/brackets-viewer.min.js
                    │
                    ├─ convertStartggToBracketsViewer(sets, eventName)
                    │       │
                    │       ├─ Extraire participants uniques (par prefix|tag)
                    │       ├─ Séparer Winners (round>0) / Losers (round<0)
                    │       ├─ Créer Stage {type:'single'|'double_elimination'}
                    │       ├─ Mapper sets → Match[] avec opponent1/opponent2
                    │       └─ Retourner {stages,matches,matchGames,participants,matchIdToSetId}
                    │
                    ├─ window.bracketsViewer.render(data, {selector:'.brackets-viewer', ...})
                    │
                    └─ setupMatchClickHandlers()
                            │
                            ├─ querySelectorAll('.match') → addEventListener('click')
                            ├─ data-match-id → matchIdToSetId.get(id) → startggSetId
                            └─ emit('select', setId, set) ──► BracketModal ──► StartggPanel
                                                                    │
                                                            handleBracketMatchSelect(set)
                                                                    │
                                                            handleSelectSet(set) [= sélection OBS]
                                                            + fermeture modale après 300ms
```

**Note critique :** Le package npm `brackets-viewer` est cassé (dist manquant). Le chargement se fait obligatoirement via CDN.

---

### Flux 4 — Overlay OBS

```
[OBS Studio]
    │
    ├─ Source Navigateur ──► http://localhost:5173/overlay
    │                               │
    │                        [OverlayView.vue]
    │                               │
    │                        [ScoreOverlay.vue / obs/ScoreOverlay.vue]
    │                               │
    │                        useSocket() → onCurrentMatchChanged()
    │                        useSocket() → onScoreUpdate()
    │                               │
    │                        Affichage temps réel:
    │                        player1 | score1 - score2 | player2
    │                        (layout horizontal ou vertical)
    │
    └─ Source URL/API ──GET /matches/obsData──► OBSOverlayData {
                                                  players: [
                                                    {name, team, score},
                                                    {name, team, score}
                                                  ],
                                                  matchId
                                                }
                                               (utilisable avec plugin URL/API Source + templating Inja)
```

**Deux modes de lecture OBS :**

1. **Source navigateur** → affiche `/overlay` (Vue app, Socket.io temps réel, thème configurable)
2. **Source URL/API** → poll `GET /matches/obsData` (JSON brut, pour templates Inja personnalisés)

**Configuration overlay (OverlayConfig) :**

```typescript
{ textColor: 'ffffff', bgColor: 'transparent', fontSize: 48,
  fontFamily: 'Inter', showTeams: true, layout: 'horizontal' }
```

---

### Flux 5 — Application mobile

```
[Android (Expo)]
    │
    ├─ SettingsScreen ──AsyncStorage──► URL du serveur (ex: http://192.168.x.x:3000)
    │
    └─ SocketContext.tsx (React Context global)
            │
            ├─ connect() → io(apiUrl) avec reconnectionAttempts:Infinity
            │
            ├─ MatchListScreen
            │   ├─ FlatList de MatchCard
            │   ├─ FAB '+' → CreateMatchScreen
            │   └─ FAB '🎮' → TournamentScreen (start.gg)
            │
            ├─ MatchDetailScreen
            │   └─ ScoreControls (+1/-1 par joueur) ──PATCH /matches/:id──► Server
            │
            ├─ TournamentScreen ──► BracketScreen
            │   └─ Intégration start.gg mobile (lecture seule)
            │
            └─ Events Socket.io:
                onScoreUpdate → met à jour le score affiché
                onCurrentMatchChanged → met à jour le match actif
                onMatchCreated / onMatchDeleted → mise à jour liste
```

---

## Packages

### `packages/server`

Backend Express.js TypeScript.

**Dépendances clés :** `express`, `socket.io`, `@prisma/client`, `zod`, `swagger-jsdoc`, `swagger-ui-express`  
**Base de données :** SQLite via Prisma (fichier `dev.db`, gitignored)  
**Port par défaut :** `3000`

```
src/
├── index.ts           # Entry point, Express + Socket.io + Swagger + routes
├── lib/
│   ├── prisma.ts      # Singleton PrismaClient
│   └── validation.ts  # Schémas Joi (createMatch, updateScore, idParam)
├── middleware/
│   └── cors.ts        # CORS configurable via ALLOWED_ORIGINS env
├── routes/
│   ├── matches.ts     # CRUD matchs + Socket.io emit (factory createMatchRoutes(io))
│   └── startgg.ts     # Proxy + intégration start.gg (config, tournois, sets, poll)
└── services/
    ├── matchService.ts    # Logique métier Match (CRUD, setCurrent, getOBSData)
    └── startggService.ts  # Client GraphQL start.gg + sync SQLite
```

**Variables d'environnement :**

```bash
PORT=3000
DATABASE_URL="file:./dev.db"
STARTGG=<votre_token_start.gg>
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8081
```

---

### `packages/web`

Frontend Vue 3 + Vite. Deux routes principales :

| Route      | Vue               | Usage                                            |
| ---------- | ----------------- | ------------------------------------------------ |
| `/`        | `AdminView.vue`   | Interface admin (gestion matchs + start.gg)      |
| `/overlay` | `OverlayView.vue` | Overlay transparent pour OBS (Source navigateur) |

**Structure :**

```
src/
├── components/
│   ├── BracketModal.vue    # Modale plein-écran bracket (Teleport, dark theme)
│   ├── BracketViewer.vue   # Intégration brackets-viewer.js via CDN
│   ├── BracketTree.vue     # (legacy, non utilisé)
│   ├── ConnectionIndicator.vue
│   ├── MatchCreator.vue
│   ├── MatchList.vue
│   ├── ScoreDisplay.vue
│   ├── ScoreUpdater.vue
│   └── StartggPanel.vue    # Panel start.gg (tournois → events → sets → bracket)
├── composables/
│   ├── useMatches.ts       # CRUD matchs REST + sync Socket.io
│   ├── useSocket.ts        # Singleton socket.io-client typé, auto-reconnect
│   ├── useStartgg.ts       # Client start.gg (fetches, state, helpers)
│   └── useOverlayConfig.ts # Config thème overlay (localStorage)
├── utils/
│   └── startggToBracketsViewer.ts  # Adaptateur start.gg Sets → brackets-viewer format
├── views/
│   ├── AdminView.vue       # Layout admin 2 colonnes (manual | startgg)
│   ├── OverlayView.vue     # Route /overlay pour OBS
│   └── PreviewView.vue     # Prévisualisation overlay
└── obs/
    └── ScoreOverlay.vue    # Composant overlay OBS (fond transparent)
```

**Variables d'environnement (`.env.local`) :**

```bash
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

---

### `packages/mobile`

Application Android (Expo / React Native).

**Dépendances clés :** `expo`, `react-native`, `socket.io-client`, `@react-navigation/native`, `expo-router`

```
src/
├── context/
│   └── SocketContext.tsx   # React Context socket.io (URL dynamique depuis storage)
├── hooks/
│   └── useMatches.ts       # CRUD matchs REST
├── screens/
│   ├── MatchListScreen.tsx     # Liste matchs + FABs
│   ├── MatchDetailScreen.tsx   # Détail + ScoreControls
│   ├── CreateMatchScreen.tsx   # Formulaire création
│   ├── TournamentScreen.tsx    # start.gg (tournois/events)
│   ├── BracketScreen.tsx       # Visualisation bracket (mobile)
│   └── SettingsScreen.tsx      # Config URL serveur
├── components/
│   ├── MatchCard.tsx
│   ├── ScoreControls.tsx
│   └── ConnectionIndicator.tsx
└── services/
    ├── api.ts       # Axios client REST
    ├── startgg.ts   # Appels start.gg via le serveur
    └── storage.ts   # AsyncStorage (URL serveur persistée)
```

---

### `packages/shared`

Types TypeScript partagés entre server, web et mobile.

```typescript
// types/match.ts
Match, CreateMatchDto, UpdateScoreDto
OBSPlayerData, OBSOverlayData
OverlayConfig, DEFAULT_OVERLAY_CONFIG

// types/socket.ts
ScoreUpdateEvent, CurrentMatchChangedEvent
MatchCreatedEvent, MatchDeletedEvent
ServerToClientEvents, ClientToServerEvents
InterServerEvents, SocketData

// types/api.ts
(réponses API paginées, erreurs...)
```

---

## Prérequis

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8 (`npm install -g pnpm`)
- [OBS Studio](https://obsproject.com/) avec le plugin [URL/API Source](https://obsproject.com/forum/resources/url-api-source-live-data-media-and-ai-on-obs-made-simple.1438/) (optionnel)
- [Android Studio](https://developer.android.com/studio) ou appareil Android (pour le mobile, optionnel)
- Compte [start.gg](https://start.gg) avec token API (optionnel)

---

## Installation

```bash
# 1. Cloner le dépôt
git clone <repo-url>
cd obs-scoring

# 2. Installer toutes les dépendances (tous les packages)
pnpm install

# 3. Initialiser la base de données SQLite
pnpm --filter @obs-scoring/server exec prisma migrate dev --name init
```

---

## Configuration

### 1. Variables d'environnement serveur

Créer `packages/server/.env` :

```bash
PORT=3000
DATABASE_URL="file:./dev.db"
STARTGG=<votre_token_api_startgg>
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8081
NODE_ENV=development
```

### 2. Variables d'environnement web

Créer `packages/web/.env.local` :

```bash
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

### 3. Token start.gg

1. Se connecter sur [start.gg](https://start.gg)
2. Aller dans **Settings → Developer → Personal Access Tokens**
3. Générer un token et le mettre dans `STARTGG`

**Ou** configurer directement dans l'interface admin : onglet start.gg → icône paramètres

---

## Lancer le projet

### Développement (tout en parallèle)

```bash
pnpm dev
# Lance server (port 3000) + web (port 5173) en parallèle via Turborepo
```

### Séparément

```bash
# Backend uniquement
pnpm --filter @obs-scoring/server dev

# Frontend web uniquement
pnpm --filter @obs-scoring/web dev

# Application mobile
pnpm --filter @obs-scoring/mobile start
# Puis : a (Android), i (iOS), w (web)
```

### Build production

```bash
pnpm build
# Turborepo cache intelligent + build ordonné (shared → server+web)
```

### Tests

```bash
pnpm test
# Vitest (server + web)
```

---

## Utilisation dans OBS

### Mode 1 — Source navigateur (recommandé)

1. Dans OBS : **Sources** → `+` → **Source navigateur**
2. URL : `http://localhost:5173/overlay`
3. Largeur/hauteur selon votre scène
4. Cocher **"Contrôler l'audio via OBS"** si nécessaire
5. Les scores se mettent à jour en temps réel via Socket.io

### Mode 2 — Plugin URL/API Source (JSON templating)

1. Installer le plugin [URL/API Source](https://obsproject.com/forum/resources/url-api-source-live-data-media-and-ai-on-obs-made-simple.1438/)
2. URL : `http://localhost:3000/matches/obsData`
3. Format de réponse :

```json
{
  "players": [
    { "name": "Joueur1", "team": "TeamA", "score": 2 },
    { "name": "Joueur2", "team": "TeamB", "score": 1 }
  ],
  "matchId": 42
}
```

4. Utiliser les templates Inja pour afficher les données

---

## Auteur

Jess

## Licence

MIT
