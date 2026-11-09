# Flügelschlag Rechner · Wingspan Score Helper

A playful, bird-themed calculator for the end-of-game scoring of *Wingspan* (German: *Flügelschlag*). It is mobile first, and the interface is available in German and English.

- **Start player:** chosen at random with a nest-and-egg hatching animation.
- **Setup helper:** draws the four round goals (random side) from the expansions you own.
- **Score entry:** one category at a time.
  - Round goals: the competitive green side uses a placement grid with official tie splitting; the blue side is entered as a number.
  - Nectar (Oceania): placement grid per habitat.
  - Hummingbird track (Americas): typed in and may be negative.
  - Quick-sum pad to add up bird points, eggs, etc. card by card.
- **Result:** animated reveal of the final standings, with the official tie-breaker (unused food tokens) and shared victories.
- **History:** past games and statistics are stored locally in the browser.
- **Bonus card check:** settle debates at the table. See which birds count for a bonus card, or which bonus cards a bird counts for. It handles the German and English editions and shows official rulings.

The running game is saved on the device, so a reload or a closed tab resumes where you left off.

## Rules

The scoring rules are summarised in German in [`docs/REGELN.md`](docs/REGELN.md), which also lists the inconsistencies that were fixed. All rule logic lives in the framework-free module [`src/lib/rules/scoring.ts`](src/lib/rules/scoring.ts).

## Card data

The bonus card check uses the community card database of [wingsearch](https://github.com/navarog/wingsearch) (GPL-3.0). It is **not** part of this repository. The app downloads it at runtime from a pinned commit (`DATA_COMMIT` in [`src/lib/checker/source.ts`](src/lib/checker/source.ts)) and caches it on the device. *Wingspan* is a trademark of Stonemaier Games, and this is an unofficial fan project.

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
| `src/lib/setup/`, `src/lib/data/` | round goal tiles and the setup draw |
| `src/lib/quicksum/` | quick-sum tally logic and pad |
| `src/lib/checker/` | bonus card check: data loading, normalisation, rules |
| `src/lib/store.ts` | game state (Svelte store) built on the rules |
| `src/lib/ui/` | reusable SVG/animation building blocks (eggs, birds, feathers, motion) |
| `src/lib/*.svelte` | screens: Setup, StartPlayerSelection, SetupDraw, Scoring, Result, Stats |

## License

[MIT](LICENSE)
