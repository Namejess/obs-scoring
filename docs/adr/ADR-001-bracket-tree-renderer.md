# ADR-001: Bracket Tree Renderer

**Status**: Accepted  
**Date**: 2026-03-06  
**Deciders**: Architect Agent, User

## Context

L'application OBS Scoring intègre start.gg pour récupérer les tournois et sets. L'utilisateur souhaite afficher les brackets sous forme d'arbre comme sur start.gg, avec des performances optimales.

### Contraintes

1. **Performance**: Rendu rapide même avec 64+ joueurs (~127 matchs)
2. **Interactivité**: Click sur un match pour le sélectionner
3. **Multi-plateforme**: Web (Vue 3) + Mobile (React Native)
4. **Dual elimination**: Support Winners/Losers brackets
5. **Real-time**: Mise à jour via Socket.io

### Audit de performance actuel

| Étape                   | Latence   | Optimisable       |
| ----------------------- | --------- | ----------------- |
| API start.gg GraphQL    | 200-400ms | ❌ Externe        |
| Parsing JSON            | <5ms      | ❌ Négligeable    |
| Transformation données  | <10ms     | ❌ Négligeable    |
| DB upsert Prisma/SQLite | 50-100ms  | ⚠️ Batch possible |
| Frontend rendering      | Variable  | ✅ Focus ici      |

**Bottleneck principal**: API start.gg (incompressible)  
**Solution**: Cache intelligent + rendering ultra-rapide

## Options considérées

### Option 1: React Tournament Brackets (Recommandé pour Mobile)

**Package**: `@g-loot/react-tournament-brackets`

**Pros**:

- Prêt à l'emploi, testé en production
- SVG-based, interactif (click handlers)
- Support single/double elimination
- Customisable via thèmes

**Cons**:

- React only (pas Vue)
- ~50KB bundle size
- Limité en customisation avancée

### Option 2: Custom SVG Component (Recommandé pour Web)

**Pros**:

- Contrôle total du rendu
- Léger, pas de dépendance externe
- Interactivité native (click sur `<rect>`)
- Zoom/Pan facile via `viewBox`
- Cross-framework (Vue, React, Svelte)

**Cons**:

- Plus de code à maintenir
- Calcul de layout à implémenter

### Option 3: Rust/WASM + Canvas 2D

**Pros**:

- Ultra-rapide pour rendering statique
- Optimal pour très grands brackets (1000+ matchs)

**Cons**:

- Overkill pour notre use case (<128 matchs)
- Complexité build (wasm-pack, Cargo)
- Interactivité complexe (hit-testing manuel)
- Overhead pour petits datasets

### Option 4: HTML5 Canvas pur (JavaScript)

**Pros**:

- Rapide pour rendering statique
- Pas de dépendance

**Cons**:

- Hit-testing manuel pour clicks
- Pas de texte natif crisp
- Accessibilité limitée

## Decision

**Architecture hybride**:

1. **Web (Vue 3)**: Custom SVG component `<BracketTree>`
   - SVG natif avec computed positions
   - Layout engine léger en TypeScript
   - Interactivité via events DOM natifs
   - Virtualisation pour grands brackets (render visible only)

2. **Mobile (React Native)**: `react-native-svg` + layout partagé
   - Même algorithme de layout (package shared)
   - `react-native-svg` pour le rendu
   - Touch handlers natifs

3. **Shared Layout Engine** (`@obs-scoring/bracket-layout`)
   - Package TypeScript pur
   - Calcule positions {x, y, width, height} pour chaque match
   - Support single/double elimination
   - Zero dependencies, tree-shakable

### Architecture des données

```typescript
// Input: sets from start.gg
interface BracketSet {
  id: string
  round: number // Positive = winners, negative = losers
  identifier: string // "A", "B", "AA", etc.
  fullRoundText: string // "Winners Final", "Losers Round 2"
  state: number // 1=created, 2=active, 3=completed
  player1Tag: string
  player2Tag: string
  player1Score: number
  player2Score: number
  winnerId: string | null
}

// Output: positioned nodes for rendering
interface BracketNode {
  set: BracketSet
  x: number
  y: number
  width: number
  height: number
  column: number // For horizontal layout
  row: number // Position in column
  connections: {
    from?: string // Previous set ID (loser feeds into)
    to?: string // Next set ID (winner advances to)
  }
}

// Layout options
interface BracketLayoutOptions {
  matchWidth: number // Default: 200
  matchHeight: number // Default: 60
  columnGap: number // Default: 50
  rowGap: number // Default: 20
  direction: 'ltr' | 'rtl'
}
```

### Layout Algorithm

```
Double Elimination Layout:
┌─────────────────────────────────────────────────────┐
│ Winners Bracket (top)                               │
│ R1 → R2 → R3 → WF → GF                              │
│                 ↓                                    │
│ Losers Bracket (bottom)                             │
│ LR1 ← LR2 ← LR3 ← LR4 ← LF                          │
└─────────────────────────────────────────────────────┘

Algorithm:
1. Group sets by round number
2. Winners (round > 0): left-to-right, top section
3. Losers (round < 0): left-to-right, bottom section
4. Grand Final: rightmost, centered
5. Calculate Y positions based on bracket progression
6. Draw connector lines between related sets
```

## Performance optimizations

1. **Memoization**: Cache computed layout (useMemo/computed)
2. **Virtualization**: Only render visible nodes for large brackets
3. **Debounced updates**: Batch Socket.io updates
4. **RequestAnimationFrame**: Smooth animations
5. **CSS transforms**: GPU-accelerated positioning

## Consequences

### Positives

- Full control over rendering and customization
- Shared layout logic between web and mobile
- No heavy dependencies
- Optimal performance for our scale

### Negatives

- More initial development time
- Need to maintain layout algorithm

### Risks

- Complex connector line calculations for double elimination
- Edge cases with byes and DQs

## Implementation Plan

1. **Phase 1**: Create `@obs-scoring/bracket-layout` package
   - Layout engine avec algorithme de positionnement
   - Tests unitaires avec différents bracket sizes

2. **Phase 2**: Web `<BracketTree>` component (Vue 3)
   - SVG renderer avec computed positions
   - Click handlers pour sélection
   - Zoom/pan support

3. **Phase 3**: Mobile bracket screen update
   - Intégrer layout engine
   - React Native SVG rendering

4. **Phase 4**: Polish
   - Animations (match state changes)
   - Themes (light/dark)
   - Accessibility

## References

- start.gg bracket UI: https://start.gg
- SVG coordinate system: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Positions
- react-tournament-brackets: https://github.com/g-loot/react-tournament-brackets
