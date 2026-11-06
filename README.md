# Flügelschlag Rechner · Wingspan Score Helper

A playful, bird-themed calculator for the end-of-game scoring of *Wingspan* (German: *Flügelschlag*). It is mobile first, and the interface is available in German and English.

- **Start player:** chosen at random with a nest-and-egg hatching animation.
- **Score entry:** one category at a time.
  - Round goals: the competitive green side uses a placement grid with official tie splitting; the blue side is entered as a number.
  - Nectar (Oceania): placement grid per habitat.
  - Hummingbird track (Americas): typed in and may be negative.
- **Result:** animated reveal of the final standings, with the official tie-breaker (unused food tokens) and shared victories.
- **History:** past games and statistics are stored locally in the browser.

## Rules

The scoring rules are summarised in German in [`docs/REGELN.md`](docs/REGELN.md), which also lists the inconsistencies that were fixed. All rule logic lives in the framework-free module [`src/lib/rules/scoring.ts`](src/lib/rules/scoring.ts).

## Development

```bash
npm ci
npm run dev      # dev server
npm test         # vitest rule & store test suite
npm run check    # svelte-check + tsc
npm run build    # production build (GitHub Pages, base /wingspan-calc/)
```

## Structure

| Path | Contents |
|---|---|
| `src/lib/rules/` | pure scoring rules + tests |
| `src/lib/store.ts` | game state (Svelte store) built on the rules |
| `src/lib/ui/` | reusable SVG/animation building blocks (eggs, birds, feathers, motion) |
| `src/lib/*.svelte` | screens: Setup, StartPlayerSelection, Scoring, Result, Stats |
