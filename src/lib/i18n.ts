import { writable, derived } from 'svelte/store';

export type Language = 'en' | 'de';

const STORAGE_KEY = 'wingspan_language';

function detectLanguage(): Language {
    try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'de') return stored;
    } catch {
    /* storage unavailable */
    }
    try {
    if (navigator.language?.toLowerCase().startsWith('de')) return 'de';
    } catch {
    /* navigator unavailable */
    }
    return 'en';
}

export const language = writable<Language>(detectLanguage());

language.subscribe(lang => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
});

/** Change the UI language and remember the explicit choice. */
export function setLanguage(lang: Language) {
    language.set(lang);
    try {
    localStorage.setItem(STORAGE_KEY, lang);
    } catch {
    /* storage unavailable */
    }
}

const en = {
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
    hummingbirds: "Hummingbird Track",
    birds: "Birds",
    tucked: "Tucked Cards",
    eggs: "Eggs",
    food: "Food on Cards",
    // Scoring
    selectPlayerPlace: "Select Player to Place:",
    resetGrid: "Reset Grid",
    tapGrid: "Tap grid cells to place",
    selectAbove: "Select a player above to start placing",
    // Grids
    round: "Round",
    biome: "Habitat",
    forest: "Forest",
    grassland: "Grassland",
    wetland: "Wetland",
    rank1: "1st",
    rank2: "2nd",
    rank3: "3rd",
    none: "None",
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
    groupStats: "Group Stats vs Previous Games",
    currentGame: "Current Game",
    selectGame: "Select Game",
    scoreBreakdown: "Score Breakdown",
    historyTrend: "History Trend",
    totalWins: "Total Wins",
    accumulatedPoints: "Accumulated Points",
    totalAccumulated: "Total Accumulated",
    statRate: "Rate",
    statWins: "Wins",
    statAvg: "Avg",
    statHigh: "High",
    // --- Redesign additions ---
    appTagline: "field notes for the final tally",
    switchLanguage: "Switch language",
    gameOptions: "Game options",
    oceania: "Oceania expansion (nectar)",
    oceaniaHint: "Score nectar majorities per habitat",
    americas: "Americas expansion (hummingbirds)",
    americasHint: "Score your hummingbird track",
    roundGoalSide: "Round goal board",
    competitive: "Green · competitive",
    competitiveHint: "1st / 2nd / 3rd place per round",
    casual: "Blue · casual",
    casualHint: "1 point per item, max. 5 per round",
    maxPlayersReached: "The nest is full – up to {n} players.",
    removePlayerNamed: "Remove {name}",
    eggColor: "Egg colour {n}",
    nestEmpty: "The nest is empty – add the first player!",
    skip: "Skip",
    tapToSkip: "Tap to skip",
    letsGo: "Let's go!",
    hatching: "Who hatches first?",
    progressLabel: "Category {i} of {n}",
    plusOne: "One point more for {name}",
    minusOne: "One point less for {name}",
    toggleSign: "Toggle plus/minus for {name}",
    pointsFor: "Points for {name}",
    invalidRows: "Some placements don't add up – check the ties.",
    placeIn: "Place {name}: {row}, {rank}",
    hint_birds: "Points printed on your bird cards",
    hint_bonus: "Points from your bonus cards",
    hint_round_goals: "Place every player for each round",
    hint_round_goals_casual: "1 point per item, max. 5 per round (max. 20)",
    hint_eggs: "1 point per egg on your birds",
    hint_food: "1 point per food token cached on cards",
    hint_tucked: "1 point per card tucked under birds",
    hint_nectar: "Most nectar spent per habitat: 5 / 2 points",
    hint_hummingbirds: "Sum of the values beside your 5 markers – may be negative",
    revealing: "And the winner is …",
    sharedVictory: "Shared victory!",
    tieBreakerTitle: "Tie! Who has more food left?",
    tieBreakerHint: "Enter the unused food tokens in each tied player's supply.",
    foodTokens: "Food tokens",
    stillTied: "Still tied – the victory is shared.",
    noGameData: "No game data to display.",
    startNewGame: "Start new game",
    noHistoryYet: "No history yet",
    noGroupHistory: "No history for this exact group.",
    games: "games",
    home: "Home",
};

type TranslationKey = keyof typeof en;

const de: Record<TranslationKey, string> = {
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
    hummingbirds: "Kolibri-Leiste",
    birds: "Vögel",
    tucked: "Karten unter Vögeln",
    eggs: "Eier",
    food: "Gelagertes Futter",
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
    wetland: "Feuchtgebiet",
    rank1: "1.",
    rank2: "2.",
    rank3: "3.",
    none: "Ohne",
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
    groupStats: "Gruppenstatistik vs Vorherige",
    currentGame: "Aktuelles Spiel",
    selectGame: "Spiel wählen",
    scoreBreakdown: "Punkteübersicht",
    historyTrend: "Verlaufstrend",
    totalWins: "Siege gesamt",
    accumulatedPoints: "Akkumulierte Punkte",
    totalAccumulated: "Gesamt akkumuliert",
    statRate: "Rate",
    statWins: "Siege",
    statAvg: "Ø",
    statHigh: "Max",
    // --- Redesign additions ---
    appTagline: "Feldnotizen zur Schlusswertung",
    switchLanguage: "Sprache wechseln",
    gameOptions: "Spieloptionen",
    oceania: "Ozeanien-Erweiterung (Nektar)",
    oceaniaHint: "Nektar-Mehrheiten je Lebensraum werten",
    americas: "Amerika-Erweiterung (Kolibris)",
    americasHint: "Mittel- und Südamerika: Kolibri-Leiste werten",
    roundGoalSide: "Rundenziel-Tableau",
    competitive: "Grün · Wettkampf",
    competitiveHint: "1. / 2. / 3. Platz je Runde",
    casual: "Blau · entspannt",
    casualHint: "1 Punkt pro Objekt, max. 5 je Runde",
    maxPlayersReached: "Das Nest ist voll – höchstens {n} Spieler.",
    removePlayerNamed: "{name} entfernen",
    eggColor: "Eierfarbe {n}",
    nestEmpty: "Das Nest ist leer – füge den ersten Spieler hinzu!",
    skip: "Überspringen",
    tapToSkip: "Tippen zum Überspringen",
    letsGo: "Los geht's!",
    hatching: "Wer schlüpft zuerst?",
    progressLabel: "Kategorie {i} von {n}",
    plusOne: "Ein Punkt mehr für {name}",
    minusOne: "Ein Punkt weniger für {name}",
    toggleSign: "Vorzeichen wechseln für {name}",
    pointsFor: "Punkte für {name}",
    invalidRows: "Einige Platzierungen passen nicht – prüfe die Gleichstände.",
    placeIn: "{name} platzieren: {row}, {rank}",
    hint_birds: "Punkte auf deinen Vogelkarten",
    hint_bonus: "Punkte deiner Bonuskarten",
    hint_round_goals: "Platziere alle Spieler in jeder Runde",
    hint_round_goals_casual: "1 Punkt pro Objekt, max. 5 je Runde (max. 20)",
    hint_eggs: "1 Punkt pro Ei auf deinen Vögeln",
    hint_food: "1 Punkt pro gelagertem Nahrungsplättchen",
    hint_tucked: "1 Punkt pro Karte unter deinen Vögeln",
    hint_nectar: "Meister Nektar je Lebensraum: 5 bzw. 2 Punkte",
    hint_hummingbirds: "Summe der Werte neben deinen 5 Markern – auch negativ möglich",
    revealing: "Und es gewinnt …",
    sharedVictory: "Geteilter Sieg!",
    tieBreakerTitle: "Gleichstand! Wer hat mehr Nahrung übrig?",
    tieBreakerHint: "Gib die unbenutzten Nahrungsplättchen im Vorrat der gleichauf liegenden Spieler ein.",
    foodTokens: "Nahrung",
    stillTied: "Immer noch gleichauf – der Sieg wird geteilt.",
    noGameData: "Keine Spieldaten vorhanden.",
    startNewGame: "Neues Spiel starten",
    noHistoryYet: "Noch kein Verlauf",
    noGroupHistory: "Kein Verlauf für genau diese Gruppe.",
    games: "Spiele",
    home: "Startseite",
};

const translations: Record<Language, Record<TranslationKey, string>> = { en, de };

export type { TranslationKey };

/** Translate a key, replacing `{placeholders}` with the given values. */
export const t = derived(language, $language => {
    return (key: TranslationKey, vars?: Record<string, string | number>) => {
    let val = translations[$language][key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) val = val.replaceAll(`{${k}}`, String(v));
    return val;
    };
});
