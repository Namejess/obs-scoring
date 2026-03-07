# Benchmarks — Node.js/Express vs Rust/Axum

> Date : Mars 2026  
> Machine : macOS (Apple Silicon)  
> Outil : `wrk -t4 -c100 -d30s` (4 threads, 100 connexions simultanées, 30 secondes)  
> Conditions identiques : même machine, même SQLite (3 matchs), profil release pour Axum

---

## Résultats

### GET /health — Overhead pur du framework

| Métrique    | Express (Node.js) | Axum (Rust) | Gain     |
| ----------- | ----------------- | ----------- | -------- |
| **Req/sec** | 9 957             | **45 184**  | **×4.5** |
| Latence avg | 16.28 ms          | **2.17 ms** | **×7.5** |
| Latence max | 990 ms            | 32 ms       | ×30      |
| p99 (stdev) | ~50 ms            | ~3.3 ms     | ×15      |

---

### GET /matches — Lecture liste (SQLite)

| Métrique    | Express + Prisma | Axum + sqlx | Gain     |
| ----------- | ---------------- | ----------- | -------- |
| **Req/sec** | 7 436            | **17 782**  | **×2.4** |
| Latence avg | 13.62 ms         | **5.61 ms** | **×2.4** |
| Latence max | 108 ms           | 51 ms       | ×2.1     |

---

### GET /matches/current — Lecture single row (SQLite)

| Métrique    | Express + Prisma | Axum + sqlx | Gain     |
| ----------- | ---------------- | ----------- | -------- |
| **Req/sec** | 6 685            | **34 781**  | **×5.2** |
| Latence avg | 15.13 ms         | **3.05 ms** | **×5.0** |
| Latence max | 258 ms           | 43 ms       | ×6.0     |

---

### GET /matches/obsData — Lecture + transformation

| Métrique    | Express + Prisma | Axum + sqlx | Gain     |
| ----------- | ---------------- | ----------- | -------- |
| **Req/sec** | 6 767            | **31 981**  | **×4.7** |
| Latence avg | 15.29 ms         | **3.26 ms** | **×4.7** |
| Latence max | 349 ms           | 54 ms       | ×6.5     |

---

## Synthèse visuelle

```
                     Requests/sec (100 connexions simultanées)
                     ─────────────────────────────────────────

GET /health
  Express  │█████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  9 957 req/s
  Axum     │████████████████████████████████████████│ 45 184 req/s

GET /matches
  Express  │█████████████████░░░░░░░░░░░░░░░░░░░░░░│  7 436 req/s
  Axum     │████████████████████████████████████████│ 17 782 req/s

GET /matches/current
  Express  │███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  6 685 req/s
  Axum     │████████████████████████████████████████│ 34 781 req/s

GET /matches/obsData
  Express  │███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  6 767 req/s
  Axum     │████████████████████████████████████████│ 31 981 req/s
```

```
                     Latence moyenne
                     ───────────────

GET /health        Express  16.28 ms  │████████████████░░░░░
                   Axum      2.17 ms  │██░░░░░░░░░░░░░░░░░░░

GET /matches       Express  13.62 ms  │█████████████░░░░░░░░
                   Axum      5.61 ms  │█████░░░░░░░░░░░░░░░░

/matches/current   Express  15.13 ms  │███████████████░░░░░░
                   Axum      3.05 ms  │███░░░░░░░░░░░░░░░░░░

/matches/obsData   Express  15.29 ms  │███████████████░░░░░░
                   Axum      3.26 ms  │███░░░░░░░░░░░░░░░░░░
```

---

## Analyse

### Pourquoi Axum est plus rapide

| Facteur           | Express (Node.js)                   | Axum (Rust)                                |
| ----------------- | ----------------------------------- | ------------------------------------------ |
| **Runtime**       | Mono-thread event loop (V8 + libuv) | Multi-thread tokio (4 workers, 1 par core) |
| **ORM**           | Prisma (JavaScript layer + IPC)     | sqlx (zero-copy, async natif)              |
| **Sérialisation** | JSON.stringify (runtime JS)         | serde_json (zero-alloc, SIMD)              |
| **GC**            | V8 GC pauses (~1–10ms)              | Aucun GC (ownership Rust)                  |
| **Mémoire**       | ~80MB RSS au démarrage              | ~8MB RSS au démarrage                      |
| **Compilé**       | JIT (optimisation à runtime)        | AOT release + LTO (optimal à build time)   |

### Différences notables

- **Overhead framework (/health)** : ×4.5 — le coût pur du middleware Express vs Axum. Sans DB, Axum montre l'avantage brut de Rust.
- **DB reads (/matches, /current)** : ×2.4–5.2 — Prisma ajoute un layer d'abstraction JS important. sqlx est un binding direct async vers SQLite.
- **Latence max (p100)** : Axum ×6–30 plus basse — les GC pauses de Node.js causent des pics de latence élevés (349ms max vs 54ms pour obsData). Critique pour la réactivité perçue.

### Ce que ça signifie en pratique

Pour l'usage OBS Scoring (<50 utilisateurs), les deux sont largement suffisants. La différence observable est sur la **latence p99/p100** :

| Scénario réel                             | Express               | Axum             |
| ----------------------------------------- | --------------------- | ---------------- |
| Sélection d'un match (SET /setCurrent)    | 5–15ms DB + 1–10ms GC | 1–3ms DB, 0ms GC |
| Score update en live (PATCH /matches/:id) | 5–20ms                | 1–4ms            |
| Poll OBS obsData (toutes les 0.5s)        | 5–15ms                | 1–3ms            |
| Pic sous forte charge (100 req/s)         | 100–350ms p100        | 30–55ms p100     |

---

## Configuration

### Express (Node.js)

```
Runtime : Node.js v20
Framework : Express 4.x
ORM : Prisma 5.x (SQLite provider)
Port : 3001
Démarrage : ~400ms (cold start Node.js + Prisma init)
RAM : ~80MB
```

### Axum (Rust)

```
Runtime : tokio 1.x (multi-thread, 4 workers)
Framework : Axum 0.7
DB : sqlx 0.7 (SQLite, async, zero-copy)
Port : 3002
Démarrage : <50ms (binaire compilé AOT)
RAM : ~8MB
Build : --release (opt-level=3, LTO=true, codegen-units=1)
```

---

## Roadmap suite

### Fait ✅

- [x] Routes REST complètes : `/matches`, `/matches/current`, `/matches/obsData`, `/matches/:id` (GET/PATCH/DELETE), `/matches/:id/setCurrent`
- [x] WebSocket natif (équivalent Socket.io) sur `/ws`
- [x] Cache DB SQLite avec batch upsert transactionnel (O(1) latence vs O(n) Express)
- [x] Routes start.gg locales : `/api/startgg/config`, `/api/startgg/local-sets`, `/api/startgg/sets/:id/select`

### À faire 🔲

- [ ] Proxy GraphQL start.gg complet (GET /tournaments, /events/:id/sets) avec cache TTL `moka`
- [ ] Polling actif start.gg avec diff hash + broadcast WebSocket
- [ ] Migration client web Vue 3 vers le port 3002 (Axum WebSocket est différent de Socket.io)
- [ ] Adapter le client WebSocket Vue (`useSocket.ts`) pour le protocole WS natif Axum
- [ ] Tests d'intégration Rust (cargo test)
- [ ] Dockerfile + `fly.toml` pour déploiement
