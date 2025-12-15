import { writable } from 'svelte/store';
import type { Category } from './store';

export interface GameRecord {
    id: string; // UUID of the game
    date: string; // ISO timestamp
    startPlayerName: string;
    players: Array<{
        name: string;
        total: number;
        scores: Record<Category, number>;
        winner: boolean;
        color: string; // Store color for UI consistency
    }>;
}

function createHistoryStore() {
    // Initialize from localStorage
    let initialHistory: GameRecord[] = [];
    try {
        const stored = localStorage.getItem('wingspan_game_history');
        if (stored) {
            initialHistory = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load game history", e);
    }

    const { subscribe, update, set } = writable<GameRecord[]>(initialHistory);

    return {
        subscribe,
        saveGame: (record: GameRecord) => {
            update(history => {
                const index = history.findIndex(g => g.id === record.id);
                let newHistory;
                if (index >= 0) {
                    // Update existing game (e.g. if scores were adjusted)
                    newHistory = [...history];
                    newHistory[index] = record;
                } else {
                    // Add new game to the top
                    newHistory = [record, ...history];
                }

                try {
                    localStorage.setItem('wingspan_game_history', JSON.stringify(newHistory));
                } catch (e) {
                    console.error("Failed to save history", e);
                }
                return newHistory;
            });
        },
        deleteGame: (id: string) => {
            update(history => {
                const newHistory = history.filter(g => g.id !== id);
                try {
                    localStorage.setItem('wingspan_game_history', JSON.stringify(newHistory));
                } catch (e) {
                    console.error("Failed to save history after delete", e);
                }
                return newHistory;
            });
        },
        clearHistory: () => {
            set([]);
            localStorage.removeItem('wingspan_game_history');
        }
    };
}

export const historyStore = createHistoryStore();
