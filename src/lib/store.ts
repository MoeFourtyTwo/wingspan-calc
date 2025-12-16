
import { writable, type Writable } from 'svelte/store';

export type Phase = 'SETUP' | 'SELECTION' | 'SCORING' | 'RESULT' | 'STATS';

export const CATEGORIES = [
    'birds',
    'bonus',
    'round_goals',
    'eggs',
    'food',
    'tucked',
    'nectar'
] as const;

export type Category = typeof CATEGORIES[number];

// Validation utility functions for placement grids
export function validateRoundGoalsRow(players: Player[], roundIndex: number): boolean {
    const c1 = players.filter(p => p.roundPlacements[roundIndex] === 1).length;
    const c2 = players.filter(p => p.roundPlacements[roundIndex] === 2).length;
    const c3 = players.filter(p => p.roundPlacements[roundIndex] === 3).length;
    const totalPlaced = c1 + c2 + c3;

    if (totalPlaced === 0) return true;
    if (c1 === 0) return false;

    if (c1 === 1) {
        if (c3 > 0 && c2 === 0) return false;
        if (c2 >= 2 && c3 > 0) return false;
    } else if (c1 === 2) {
        if (c2 > 0) return false;
    } else if (c1 >= 3) {
        if (c2 > 0 || c3 > 0) return false;
    }
    return true;
}

export function validateAllRoundGoals(players: Player[]): boolean {
    for (let r = 0; r < 4; r++) {
        if (!validateRoundGoalsRow(players, r)) return false;
    }
    return true;
}

export function validateNectarRow(players: Player[], biomeIndex: number): boolean {
    const c1 = players.filter(p => p.nectarPlacements[biomeIndex] === 1).length;
    const c2 = players.filter(p => p.nectarPlacements[biomeIndex] === 2).length;
    const totalPlaced = c1 + c2;

    if (totalPlaced === 0) return true;
    if (c1 === 0) return false;
    if (c1 >= 2 && c2 > 0) return false;
    return true;
}

export function validateAllNectar(players: Player[]): boolean {
    for (let b = 0; b < 3; b++) {
        if (!validateNectarRow(players, b)) return false;
    }
    return true;
}



export interface Player {
    id: string;
    name: string;
    color: string;
    roundPlacements: number[];
    nectarPlacements: number[]; // Index 0-2 for Forest, Grassland, Wetland. Values: 0=None, 1=1st, 2=2nd
    scores: Record<Category, number>;
    total: number;
}

export interface GameState {
    gameId: string;
    players: Player[];
    currentPhase: Phase;
    currentScoringCategoryIndex: number; // For iterating through categories in SCORING phase
    startPlayerId: string | null;
}

const initialState: GameState = {
    gameId: crypto.randomUUID(),
    players: [],
    currentPhase: 'SETUP',
    currentScoringCategoryIndex: 0,
    startPlayerId: null,
};

// Points per rank for each round (0-indexed: Round 1, 2, 3, 4)
// Arrays represent points for [1st place, 2nd place, 3rd place]
// Note: Logic handles ties by summing indices. e.g. Tie for 1st (2 players) uses index 0 and 1.
const ROUND_GOAL_POINTS = [
    [4, 1, 0], // Round 1
    [5, 2, 1], // Round 2
    [6, 3, 2], // Round 3
    [7, 4, 3]  // Round 4
];

const NECTAR_POINTS = [5, 2]; // 1st=5, 2nd=2. Applied to all 3 biomes.

function createGameStore() {
    const { subscribe, set, update } = writable<GameState>(initialState);

    // Helper to recalculate round goal scores for all players
    const recalculateRoundScores = (players: Player[]): Player[] => {
        // We need to calculate points for each player based on roundPlacements

        // Initialize round points for everyone to 0
        const playerRoundPoints = new Map<string, number>();
        players.forEach(p => playerRoundPoints.set(p.id, 0));

        // Iterate through each round (0 to 3)
        for (let r = 0; r < 4; r++) {
            const pointsTable = ROUND_GOAL_POINTS[r];

            // Group players by rank in this round
            const rankGroups = {
                1: [] as string[],
                2: [] as string[],
                3: [] as string[] // "3rd" rank from UI
            };

            players.forEach(p => {
                const rank = p.roundPlacements[r];
                if (rank >= 1 && rank <= 3) {
                    rankGroups[rank as 1 | 2 | 3].push(p.id);
                }
            });

            // Calculate points based on occupied slots
            let currentSlot = 0; // 0 = 1st, 1 = 2nd, 2 = 3rd, etc.

            // Process Rank 1
            const count1 = rankGroups[1].length;
            if (count1 > 0) {
                let sum = 0;
                for (let i = 0; i < count1; i++) {
                    // Add points for the slot if available, else 0
                    sum += (currentSlot < pointsTable.length ? pointsTable[currentSlot] : 0);
                    currentSlot++;
                }
                const pointsPerPlayer = Math.floor(sum / count1);
                rankGroups[1].forEach(pid => {
                    playerRoundPoints.set(pid, (playerRoundPoints.get(pid) || 0) + pointsPerPlayer);
                });
            }

            // Process Rank 2
            const count2 = rankGroups[2].length;
            if (count2 > 0) {
                let sum = 0;
                for (let i = 0; i < count2; i++) {
                    sum += (currentSlot < pointsTable.length ? pointsTable[currentSlot] : 0);
                    currentSlot++;
                }
                const pointsPerPlayer = Math.floor(sum / count2);
                rankGroups[2].forEach(pid => {
                    playerRoundPoints.set(pid, (playerRoundPoints.get(pid) || 0) + pointsPerPlayer);
                });
            }

            // Process Rank 3
            const count3 = rankGroups[3].length;
            if (count3 > 0) {
                let sum = 0;
                for (let i = 0; i < count3; i++) {
                    sum += (currentSlot < pointsTable.length ? pointsTable[currentSlot] : 0);
                    currentSlot++;
                }
                const pointsPerPlayer = Math.floor(sum / count3);
                rankGroups[3].forEach(pid => {
                    playerRoundPoints.set(pid, (playerRoundPoints.get(pid) || 0) + pointsPerPlayer);
                });
            }
        }

        // Apply calculated points to players
        return players.map(p => {
            const roundPoints = playerRoundPoints.get(p.id) || 0;
            const newScores = { ...p.scores, round_goals: roundPoints };
            const total = Object.values(newScores).reduce((acc, curr) => acc + curr, 0);
            return { ...p, scores: newScores, total };
        });
    };

    // Helper to recalculate nectar scores
    const recalculateNectarScores = (players: Player[]): Player[] => {
        const playerNectarPoints = new Map<string, number>();
        players.forEach(p => playerNectarPoints.set(p.id, 0));

        // Iterate through 3 biomes (0=Forest, 1=Grassland, 2=Wetland)
        for (let b = 0; b < 3; b++) {
            const rankGroups = { 1: [] as string[], 2: [] as string[] };

            players.forEach(p => {
                const rank = p.nectarPlacements[b];
                if (rank === 1 || rank === 2) rankGroups[rank].push(p.id);
            });

            let currentSlot = 0;
            // Rank 1
            const count1 = rankGroups[1].length;
            if (count1 > 0) {
                let sum = 0;
                for (let i = 0; i < count1; i++) {
                    sum += (currentSlot < NECTAR_POINTS.length ? NECTAR_POINTS[currentSlot] : 0);
                    currentSlot++;
                }
                const points = Math.floor(sum / count1);
                rankGroups[1].forEach(pid => playerNectarPoints.set(pid, (playerNectarPoints.get(pid) || 0) + points));
            }

            // Rank 2
            const count2 = rankGroups[2].length;
            if (count2 > 0) {
                let sum = 0;
                for (let i = 0; i < count2; i++) {
                    sum += (currentSlot < NECTAR_POINTS.length ? NECTAR_POINTS[currentSlot] : 0);
                    currentSlot++;
                }
                const points = Math.floor(sum / count2);
                rankGroups[2].forEach(pid => playerNectarPoints.set(pid, (playerNectarPoints.get(pid) || 0) + points));
            }
        }

        return players.map(p => {
            const nectarPoints = playerNectarPoints.get(p.id) || 0;
            const newScores = { ...p.scores, nectar: nectarPoints };
            const total = Object.values(newScores).reduce((acc, curr) => acc + curr, 0);
            return { ...p, scores: newScores, total };
        });
    };

    return {
        subscribe,
        addPlayer: (name: string, color: string) => update(state => {
            const newPlayer: Player = {
                id: crypto.randomUUID(),
                name,
                color,
                roundPlacements: [0, 0, 0, 0], // 0 = None, 1 = 1st, 2 = 2nd, 3 = 3rd
                nectarPlacements: [0, 0, 0], // Init 3 biomes
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
                    // If we are Manually updating round_goals (via input), simpler logic might be needed
                    // BUT with the Grid UI, we usually update placements. 
                    // However, if the user manually types in the "Result" view or falls back, we respect it.
                    // Recalculate total immediately
                    const total = Object.values(newScores).reduce((acc, curr) => acc + curr, 0);
                    return { ...p, scores: newScores, total };
                }
                return p;
            });
            return { ...state, players: updatedPlayers };
        }),

        updateRoundPlacement: (playerId: string, roundIndex: number, rank: number) => update(state => {
            // 1. Update placement
            let updatedPlayers = state.players.map(p => {
                if (p.id === playerId) {
                    const newPlacements = [...p.roundPlacements];
                    newPlacements[roundIndex] = rank;
                    return { ...p, roundPlacements: newPlacements };
                }
                return p;
            });

            // 2. Recalculate scores for ALL players based on new placements
            updatedPlayers = recalculateRoundScores(updatedPlayers);

            return { ...state, players: updatedPlayers };
        }),

        resetAllRoundPlacements: () => update(state => {
            let updatedPlayers = state.players.map(p => ({
                ...p,
                roundPlacements: [0, 0, 0, 0]
            }));

            // Recalculate (will set all round_goals to 0)
            updatedPlayers = recalculateRoundScores(updatedPlayers);

            return { ...state, players: updatedPlayers };
        }),

        updateNectarPlacement: (playerId: string, biomeIndex: number, rank: number) => update(state => {
            let updatedPlayers = state.players.map(p => {
                if (p.id === playerId) {
                    const newPlacements = [...p.nectarPlacements];
                    newPlacements[biomeIndex] = rank;
                    return { ...p, nectarPlacements: newPlacements };
                }
                return p;
            });
            updatedPlayers = recalculateNectarScores(updatedPlayers);
            return { ...state, players: updatedPlayers };
        }),

        resetAllNectarPlacements: () => update(state => {
            let updatedPlayers = state.players.map(p => ({
                ...p,
                nectarPlacements: [0, 0, 0]
            }));
            updatedPlayers = recalculateNectarScores(updatedPlayers);
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
        resetGame: () => set({
            ...initialState,
            gameId: crypto.randomUUID()
        })
    };
}

export const gameStore = createGameStore();
