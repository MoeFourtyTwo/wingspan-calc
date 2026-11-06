import { writable, get } from 'svelte/store';
import {
    CATEGORIES,
    HABITATS,
    MAX_PLAYERS,
    ROUND_COUNT,
    emptyScores,
    sanitizeCategoryPoints,
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

export type Phase = 'SETUP' | 'SELECTION' | 'DRAW' | 'SCORING' | 'RESULT' | 'STATS';

/**
 * Result of the setup helper, stored by id so it survives a reload.
 * goals[round] = tile id + face-up side; bonus[playerId] = dealt card ids.
 */
export interface SetupRecord {
    goals: { tileId: string; side: 0 | 1 }[];
    bonus: Record<string, number[]>;
}

/** Green (competitive, placement based) or blue (1 pt per item, max 5) goal board side. */
export type RoundGoalMode = 'competitive' | 'casual';

export interface GameOptions {
    roundGoalMode: RoundGoalMode;
    /** Oceania expansion: enables nectar scoring. */
    oceania: boolean;
    /** Americas expansion: enables hummingbird track scoring. */
    americas: boolean;
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
    /** Round goals and bonus cards drawn with the setup helper (optional). */
    setup: SetupRecord | null;
}

export const DEFAULT_OPTIONS: GameOptions = { roundGoalMode: 'competitive', oceania: true, americas: false };

function freshState(options: GameOptions = DEFAULT_OPTIONS): GameState {
    return {
        gameId: crypto.randomUUID(),
        players: [],
        currentPhase: 'SETUP',
        currentScoringCategoryIndex: 0,
        startPlayerId: null,
        setup: null,
        options: { ...options },
    };
}

/** Categories that are scored in a game with the given options. */
export function activeCategories(options: GameOptions): Category[] {
    return CATEGORIES.filter(
        c => (c !== 'nectar' || options.oceania) && (c !== 'hummingbirds' || options.americas),
    );
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
        if (!options.americas) scores.hummingbirds = 0;
        return { ...p, scores, total: sumScores(scores) };
    });
}

const ACTIVE_GAME_KEY = 'wingspan_active_game';
const PHASES: readonly Phase[] = ['SETUP', 'SELECTION', 'DRAW', 'SCORING', 'RESULT', 'STATS'];

/**
 * Restore a game that was interrupted (reload, phone killed the tab, ...).
 * Anything malformed is discarded; derived scores are recomputed.
 */
export function restoreGame(raw: unknown): GameState | null {
    if (!raw || typeof raw !== 'object') return null;
    const g = raw as Partial<GameState>;
    if (typeof g.gameId !== 'string' || !Array.isArray(g.players) || !PHASES.includes(g.currentPhase as Phase)) {
        return null;
    }
    const options: GameOptions = { ...DEFAULT_OPTIONS, ...(g.options ?? {}) };
    const players: Player[] = g.players
        .filter((p): p is Player => !!p && typeof p.id === 'string' && typeof p.name === 'string')
        .slice(0, MAX_PLAYERS)
        .map(p => ({
            id: p.id,
            name: p.name,
            color: typeof p.color === 'string' ? p.color : '#8FB8DE',
            roundPlacements: Array.from({ length: ROUND_COUNT }, (_, i) => Number(p.roundPlacements?.[i]) || 0),
            nectarPlacements: Array.from({ length: HABITATS.length }, (_, i) => Number(p.nectarPlacements?.[i]) || 0),
            scores: Object.fromEntries(
                CATEGORIES.map(c => [c, sanitizeCategoryPoints(c, p.scores?.[c] ?? 0)]),
            ) as Scores,
            total: 0,
            leftoverFood: sanitizePoints(p.leftoverFood ?? 0),
        }));
    const maxIndex = Math.max(0, activeCategories(options).length - 1);
    return {
        gameId: g.gameId,
        players: recompute(players, options),
        currentPhase: players.length === 0 ? 'SETUP' : (g.currentPhase as Phase),
        currentScoringCategoryIndex: Math.min(maxIndex, Math.max(0, Number(g.currentScoringCategoryIndex) || 0)),
        startPlayerId: players.some(p => p.id === g.startPlayerId) ? g.startPlayerId! : null,
        setup: restoreSetup(g.setup, players),
        options,
    };
}

function restoreSetup(raw: unknown, players: Player[]): SetupRecord | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Partial<SetupRecord>;
    if (!Array.isArray(r.goals) || r.goals.length !== ROUND_COUNT) return null;
    const goals = r.goals.map(g => ({ tileId: String(g?.tileId ?? ''), side: (g?.side === 1 ? 1 : 0) as 0 | 1 }));
    if (goals.some(g => !g.tileId)) return null;
    const bonus: Record<string, number[]> = {};
    for (const p of players) {
        const ids = r.bonus?.[p.id];
        if (Array.isArray(ids)) bonus[p.id] = ids.map(Number).filter(Number.isInteger);
    }
    return { goals, bonus };
}

function loadActiveGame(): GameState | null {
    try {
        const stored = globalThis.localStorage?.getItem(ACTIVE_GAME_KEY);
        return stored ? restoreGame(JSON.parse(stored)) : null;
    } catch {
        return null;
    }
}

function persistActiveGame(state: GameState) {
    try {
        globalThis.localStorage?.setItem(ACTIVE_GAME_KEY, JSON.stringify(state));
    } catch {
        /* storage unavailable or full – the game simply isn't resumable */
    }
}

function createGameStore() {
    const store = writable<GameState>(loadActiveGame() ?? freshState());
    store.subscribe(persistActiveGame);
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
        setSetup: (setup: SetupRecord | null) => update(state => ({ ...state, setup })),
        setPhase: (phase: Phase) => update(state => ({ ...state, currentPhase: phase })),

        updateScore: (playerId: string, category: Category, points: number) =>
            updatePlayers(players =>
                players.map(p =>
                    p.id === playerId ? { ...p, scores: { ...p.scores, [category]: sanitizeCategoryPoints(category, points) } } : p,
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
