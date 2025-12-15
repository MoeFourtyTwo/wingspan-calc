import { writable, derived } from 'svelte/store';

export type Language = 'en' | 'de';

export const language = writable<Language>('en');

const translations = {
    en: {
        appTitle: "Wingspan Score Helper",
        back: "Back",
        next: "Next",
        // Setup
        addPlayer: "Add Player",
        playerName: "Player Name",
        players: "Players",
        noPlayers: "No players added yet.",
        startGame: "Start Game",
        // Categories
        round_goals: "Round Goals",
        bonus: "Bonus Cards",
        nectar: "Nectar",
        birds: "Birds",
        tucked: "Tucked Cards",
        eggs: "Eggs",
        food: "Food on Material",
        // Scoring
        selectPlayerPlace: "Select Player to Place:",
        resetGrid: "Reset Grid",
        tapGrid: "Tap grid cells to place",
        selectAbove: "Select a player above to start placing",
        // Grids
        round: "Round",
        biome: "Biome",
        forest: "Forest",
        grassland: "Grassland",
        wetland: "Wetland",
        rank1: "1st",
        rank2: "2nd",
        rank3: "3rd",
        none: "Other",
        // Result
        winner: "Winner",
        leaderboard: "Leaderboard",
        adjustScores: "Adjust Scores",
        viewStats: "View Detailed Stats",
        newGame: "New Game",
        confirmNewGame: "Start a new game?",
        // Start Selection
        whoStarts: "Who starts?",
        randomize: "Randomize",
        start: "Start",
        selectingFirst: "Selecting First Player...",
        firstSelected: "First Player Selected!",
        turnStartPre: "It's ",
        turnStartPost: "'s turn to start!",
        finishScoring: "Finish Scoring",
        pts: "pts",
        categoryTitle: "Category",
        total: "Total",
        backToResults: "Back to Results",
        // Stats
        statsTitle: "Statistics",
        scoreDistribution: "Score Distribution",
        avgScore: "Average Score",
        maxScore: "Max Score",
        minScore: "Min Score",
        recentPlayers: "Recent Players",
        clearHistory: "Clear History",
        // History
        history: "History",
        noHistory: "No games played yet.",
        date: "Date",
        delete: "Delete",
        compareGroup: "Compare Group",
        groupStats: "Group Stats vs Previous Games"
    },
    de: {
        appTitle: "Flügelschlag Rechner",
        back: "Zurück",
        next: "Weiter",
        // Setup
        addPlayer: "Spieler hinzufügen",
        playerName: "Spielername",
        players: "Spieler",
        noPlayers: "Noch keine Spieler.",
        startGame: "Spiel starten",
        // Categories
        round_goals: "Rundenziele",
        bonus: "Bonuskarten",
        nectar: "Nektar",
        birds: "Vögel",
        tucked: "Gelagerte Karten",
        eggs: "Eier",
        food: "Futter",
        // Scoring
        selectPlayerPlace: "Spieler platzieren:",
        resetGrid: "Zurücksetzen",
        tapGrid: "Tippe zum Platzieren für",
        selectAbove: "Wähle einen Spieler zum Platzieren",
        // Grids
        round: "Runde",
        biome: "Lebensraum",
        forest: "Wald",
        grassland: "Grasland",
        wetland: "Wasser",
        rank1: "1.",
        rank2: "2.",
        rank3: "3.",
        none: "Rest",
        // Result
        winner: "Gewinner",
        leaderboard: "Rangliste",
        adjustScores: "Punkte korrigieren",
        viewStats: "Statistiken",
        newGame: "Neues Spiel",
        confirmNewGame: "Neues Spiel starten?",
        // Start Selection
        whoStarts: "Wer beginnt?",
        randomize: "Zufällig",
        start: "Start",
        selectingFirst: "Wähle Startspieler...",
        firstSelected: "Startspieler ausgewählt!",
        turnStartPre: "",
        turnStartPost: " beginnt!",
        finishScoring: "Abschließen",
        pts: "Pkt.",
        categoryTitle: "Kategorie",
        total: "Gesamt",
        backToResults: "Zurück zu Ergebnissen",
        // Stats
        statsTitle: "Statistiken",
        scoreDistribution: "Punkteverteilung",
        avgScore: "Durchschnitt",
        maxScore: "Max",
        minScore: "Min",
        recentPlayers: "Letzte Spieler",
        clearHistory: "Verlauf löschen",
        // History
        history: "Verlauf",
        noHistory: "Noch keine Spiele.",
        date: "Datum",
        delete: "Löschen",
        compareGroup: "Gruppe vergleichen",
        groupStats: "Gruppenstatistik vs Vorherige"
    }
};

export const t = derived(language, ($language) => {
    return (key: keyof typeof translations['en']) => {
        const val = translations[$language][key];
        return val !== undefined ? val : key;
    };
});
