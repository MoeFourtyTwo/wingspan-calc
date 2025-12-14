
import { writable, type Writable } from 'svelte/store';

export type Phase = 'SETUP' | 'SELECTION' | 'SCORING' | 'RESULT' | 'STATS';

export type Category =
    | 'round_goals'
    | 'bonus'
    | 'nectar'
    | 'birds'
    | 'tucked'
    | 'eggs'
    | 'food';

export const CATEGORIES: Category[] = [
    'round_goals',
    'bonus',
    'birds',
    'eggs',
    'food',
    'tucked',
    'nectar'
];

export const CATEGORY_LABELS: Record<Category, string> = {
    round_goals: 'Round Goals',
    bonus: 'Bonus Cards',
    nectar: 'Nectar',
    birds: 'Birds',
    tucked: 'Tucked Cards',
    eggs: 'Eggs',
    food: 'Food on Material',
};

export interface Player {
    id: string;
    name: string;
    color: string;
    scores: Record<Category, number>;
    total: number;
}

export interface GameState {
    players: Player[];
    currentPhase: Phase;
    currentScoringCategoryIndex: number; // For iterating through categories in SCORING phase
    startPlayerId: string | null;
}

const initialState: GameState = {
    players: [],
    currentPhase: 'SETUP',
    currentScoringCategoryIndex: 0,
    startPlayerId: null,
};

function createGameStore() {
    const { subscribe, set, update } = writable<GameState>(initialState);

    return {
        subscribe,
        addPlayer: (name: string, color: string) => update(state => {
            const newPlayer: Player = {
                id: crypto.randomUUID(),
                name,
                color,
                scores: {
                    round_goals: 0,
                    bonus: 0,
                    nectar: 0,
                    birds: 0,
                    tucked: 0,
                    eggs: 0,
                    food: 0
                },
                total: 0
            };
            return { ...state, players: [...state.players, newPlayer] };
        }),
        removePlayer: (id: string) => update(state => ({
            ...state,
            players: state.players.filter(p => p.id !== id)
        })),
        setStartPlayer: (id: string) => update(state => ({ ...state, startPlayerId: id })),
        setPhase: (phase: Phase) => update(state => ({ ...state, currentPhase: phase })),

        // Scoring Logic
        updateScore: (playerId: string, category: Category, points: number) => update(state => {
            const updatedPlayers = state.players.map(p => {
                if (p.id === playerId) {
                    const newScores = { ...p.scores, [category]: points };
                    // Recalculate total immediately
                    const total = Object.values(newScores).reduce((acc, curr) => acc + curr, 0);
                    return { ...p, scores: newScores, total };
                }
                return p;
            });
            return { ...state, players: updatedPlayers };
        }),

        nextCategory: () => update(state => {
            const nextIndex = state.currentScoringCategoryIndex + 1;
            if (nextIndex >= CATEGORIES.length) {
                return { ...state, currentPhase: 'RESULT' }; // Done with all categories
            }
            return { ...state, currentScoringCategoryIndex: nextIndex };
        }),
        prevCategory: () => update(state => {
            const prevIndex = state.currentScoringCategoryIndex - 1;
            if (prevIndex < 0) {
                return { ...state, currentPhase: 'SETUP', currentScoringCategoryIndex: 0 };
            }
            return { ...state, currentScoringCategoryIndex: prevIndex };
        }),
        backToScoring: () => update(state => ({
            ...state,
            currentPhase: 'SCORING',
            currentScoringCategoryIndex: CATEGORIES.length - 1
        })),
        resetGame: () => set(initialState)
    };
}

export const gameStore = createGameStore();
