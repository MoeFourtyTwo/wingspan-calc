import { writable, get } from 'svelte/store';
import {
    CATEGORIES,
    HABITATS,
    MAX_PLAYERS,
    ROUND_COUNT,
    emptyScores,
    sanitizePoints,
    scoreNectar,
    scoreRoundGoals,
    sumScores,
    validateNectarRows,
    validateRoundGoalRows,
    type Category,
    type Placement,
    type Scores,
} from './rules/scoring';

export { CATEGORIES, type Category } from './rules/scoring';

export type Phase = 'SETUP' | 'SELECTION' | 'SCORING' | 'RESULT' | 'STATS';

/** Green (competitive, placement based) or blue (1 pt per item, max 5) goal board side. */
export type RoundGoalMode = 'competitive' | 'casual';

export interface GameOptions {
    roundGoalMode: RoundGoalMode;
    /** Oceania expansion: enables nectar scoring. */
    oceania: boolean;
}

export interface Player {
    id: string;
    name: string;
    color: string;
    /** Per round: 0 = none, 1 = 1st, 2 = 2nd, 3 = 3rd. */
    roundPlacements: Placement[];
    /** Per habitat (forest, grassland, wetland): 0 = none, 1 = 1st, 2 = 2nd. */
    nectarPlacements: Placement[];
    scores: Scores;
    total: number;
    /** Unused food tokens in the supply – official tie-breaker. */
    leftoverFood: number;
}

export interface GameState {
    gameId: string;
    players: Player[];
    currentPhase: Phase;
    /** Index into {@link activeCategories} while in the SCORING phase. */
    currentScoringCategoryIndex: number;
    startPlayerId: string | null;
    options: GameOptions;
}

export const DEFAULT_OPTIONS: GameOptions = { roundGoalMode: 'competitive', oceania: true };

function freshState(options: GameOptions = DEFAULT_OPTIONS): GameState {
    return {
        gameId: crypto.randomUUID(),
        players: [],
        currentPhase: 'SETUP',
        currentScoringCategoryIndex: 0,
        startPlayerId: null,
        options: { ...options },
    };
}

/** Categories that are scored in a game with the given options. */
export function activeCategories(options: GameOptions): Category[] {
    return CATEGORIES.filter(c => c !== 'nectar' || options.oceania);
}

/** Whether a category is entered via a placement grid instead of a number. */
export function isPlacementCategory(category: Category, options: GameOptions): boolean {
    if (category === 'nectar') return true;
    if (category === 'round_goals') return options.roundGoalMode === 'competitive';
    return false;
}

export function validateAllRoundGoals(players: Player[]): boolean {
    return validateRoundGoalRows(players.map(p => p.roundPlacements)).every(Boolean);
}

export function validateAllNectar(players: Player[]): boolean {
    return validateNectarRows(players.map(p => p.nectarPlacements)).every(Boolean);
}

export function validateRoundGoalsRow(players: Player[], round: number): boolean {
    return validateRoundGoalRows(players.map(p => p.roundPlacements))[round];
}

export function validateNectarRow(players: Player[], habitat: number): boolean {
    return validateNectarRows(players.map(p => p.nectarPlacements))[habitat];
}

/** Recompute all derived scores (placement categories + totals). */
export function recompute(players: Player[], options: GameOptions): Player[] {
    const round =
        options.roundGoalMode === 'competitive' ? scoreRoundGoals(players.map(p => p.roundPlacements)) : null;
    const nectar = options.oceania ? scoreNectar(players.map(p => p.nectarPlacements)) : null;

    return players.map((p, i) => {
        const scores: Scores = { ...p.scores };
        if (round) scores.round_goals = round[i];
        scores.nectar = nectar ? nectar[i] : 0;
        return { ...p, scores, total: sumScores(scores) };
    });
}

function createGameStore() {
    const store = writable<GameState>(freshState());
    const { subscribe, set, update } = store;

    const updatePlayers = (fn: (players: Player[], state: GameState) => Player[]) =>
        update(state => ({ ...state, players: recompute(fn(state.players, state), state.options) }));

    return {
        subscribe,

        addPlayer: (name: string, color: string) =>
            update(state => {
                if (state.players.length >= MAX_PLAYERS) return state;
                const player: Player = {
                    id: crypto.randomUUID(),
                    name,
                    color,
                    roundPlacements: Array(ROUND_COUNT).fill(0),
                    nectarPlacements: Array(HABITATS.length).fill(0),
                    scores: emptyScores(),
                    total: 0,
                    leftoverFood: 0,
                };
                return { ...state, players: [...state.players, player] };
            }),

        removePlayer: (id: string) => updatePlayers(players => players.filter(p => p.id !== id)),

        setOptions: (options: Partial<GameOptions>) =>
            update(state => {
                const merged = { ...state.options, ...options };
                return { ...state, options: merged, players: recompute(state.players, merged) };
            }),

        setStartPlayer: (id: string) => update(state => ({ ...state, startPlayerId: id })),
        setPhase: (phase: Phase) => update(state => ({ ...state, currentPhase: phase })),

        updateScore: (playerId: string, category: Category, points: number) =>
            updatePlayers(players =>
                players.map(p =>
                    p.id === playerId ? { ...p, scores: { ...p.scores, [category]: sanitizePoints(points) } } : p,
                ),
            ),

        setLeftoverFood: (playerId: string, amount: number) =>
            update(state => ({
                ...state,
                players: state.players.map(p =>
                    p.id === playerId ? { ...p, leftoverFood: sanitizePoints(amount) } : p,
                ),
            })),

        updateRoundPlacement: (playerId: string, round: number, rank: Placement) =>
            updatePlayers(players =>
                players.map(p =>
                    p.id === playerId ? { ...p, roundPlacements: p.roundPlacements.map((v, i) => (i === round ? rank : v)) } : p,
                ),
            ),

        resetAllRoundPlacements: () =>
            updatePlayers(players => players.map(p => ({ ...p, roundPlacements: Array(ROUND_COUNT).fill(0) }))),

        updateNectarPlacement: (playerId: string, habitat: number, rank: Placement) =>
            updatePlayers(players =>
                players.map(p =>
                    p.id === playerId ? { ...p, nectarPlacements: p.nectarPlacements.map((v, i) => (i === habitat ? rank : v)) } : p,
                ),
            ),

        resetAllNectarPlacements: () =>
            updatePlayers(players =>
                players.map(p => ({ ...p, nectarPlacements: Array(HABITATS.length).fill(0) })),
            ),

        nextCategory: () =>
            update(state => {
                const next = state.currentScoringCategoryIndex + 1;
                if (next >= activeCategories(state.options).length) return { ...state, currentPhase: 'RESULT' };
                return { ...state, currentScoringCategoryIndex: next };
            }),

        prevCategory: () =>
            update(state => {
                const prev = state.currentScoringCategoryIndex - 1;
                if (prev < 0) return { ...state, currentPhase: 'SETUP', currentScoringCategoryIndex: 0 };
                return { ...state, currentScoringCategoryIndex: prev };
            }),

        backToScoring: () =>
            update(state => ({
                ...state,
                currentPhase: 'SCORING',
                currentScoringCategoryIndex: activeCategories(state.options).length - 1,
            })),

        /** Start a new game, keeping the chosen options. */
        resetGame: () => set(freshState(get(store).options)),
    };
}

export const gameStore = createGameStore();
